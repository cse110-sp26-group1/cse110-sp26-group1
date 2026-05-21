import { requireAuth } from '../src/lib/auth.js';
import { requireTeamMember } from '../src/lib/teams.js';

const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ALLOWED_CATEGORIES = ['Bug', 'Feature', 'Task'];

/**
 * Handles all /issues routes: GET (list by team or view single), POST (create), PATCH (update), DELETE (remove).
 * @param {Request} request
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 */
export async function handleIssues(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const issueId = pathParts[2];

	// Validate issueId early
	if (issueId) {
		const parsedIssueId = Number(issueId);
		if (!Number.isInteger(parsedIssueId) || parsedIssueId <= 0) {
			return Response.json({ error: 'Invalid issue ID format. Must be a positive integer.' }, { status: 400 });
		}
	}

	// GET /issues?team_id=X
	if (method === 'GET' && !issueId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const teamId = Number(url.searchParams.get('team_id'));
		if (!teamId) {
			return Response.json({ error: 'team_id query param required' }, { status: 400 });
		}

		if (!Number.isInteger(teamId) || teamId <= 0) {
			return Response.json({ error: 'Invalid team_id format. Must be a positive integer.' }, { status: 400 });
		}

		const membership = await requireTeamMember(env, auth.userId, teamId);
		if (membership.error) return membership.error;

		// Point 3 Change: Dynamic filtering logic based on optional query string parameters
		// Rather than executing a blanket select, we check for presence of individual filters
		// Point 4 Change: Dynamic & Optional Query Parameters using a baseline array for conditions and query bindings
		// Extracts optional additions using url.searchParams and safely appends placeholder bindings to preserve injection safety.

		//Provides flexible filtering of issues based on optional query parameters such as status, priority, assigned_to, category, and difficulty. This allows clients to retrieve a customized list of issues that match specific criteria without needing separate endpoints for each filter combination.
		//The base query starts with filtering by team_id, and additional conditions are appended dynamically based on the presence of optional parameters. Each parameter is validated for correct format before being included in the query, ensuring robust and secure data retrieval.
		let query = 'SELECT * FROM issues WHERE team_id = ?';
		const bindings = [teamId];

		const statusParam = url.searchParams.get('status');
		if (statusParam !== null) {
			query += ' AND status = ?';
			bindings.push(statusParam);
		}

		const priorityParam = url.searchParams.get('priority');
		if (priorityParam !== null) {
			query += ' AND priority = ?';
			bindings.push(priorityParam);
		}

		const assignedToParam = url.searchParams.get('assigned_to');
		if (assignedToParam !== null) {
			query += ' AND assigned_to = ?';
			bindings.push(Number(assignedToParam));
		}

		const categoryParam = url.searchParams.get('category');
		if (categoryParam !== null) {
			query += ' AND category = ?';
			bindings.push(categoryParam);
		}

		const difficultyParam = url.searchParams.get('difficulty');
		if (difficultyParam !== null) {
			query += ' AND difficulty = ?';
			bindings.push(difficultyParam);
		}

		// Point 5 Change: Support optional sort_by and order parameters (Urgency Sorting Context)
		// Instead of a native weighted SQL clause, standard columns can be sorted dynamically following updated context rules.
		const sortBy = url.searchParams.get('sort_by');
		const order = url.searchParams.get('order');

		if (sortBy) {
			const allowedSortColumns = ['id', 'title', 'status', 'priority', 'category', 'difficulty', 'created_at', 'updated_at', 'assigned_to'];
			if (allowedSortColumns.includes(sortBy)) {
				let direction = 'ASC';
				if (order && order.toLowerCase() === 'desc') {
					direction = 'DESC';
				}
				query += ` ORDER BY ${sortBy} ${direction}`;
			}
		}

		const { results } = await env.DB.prepare(query)
			.bind(...bindings)
			.all();

		const formatted = results.map((row) => ({
			...row,
			tags: JSON.parse(row.tags || '[]'),
			stack_trace: JSON.parse(row.stack_trace || '[]'),
			affected_files: JSON.parse(row.affected_files || '[]'),
		}));

		return Response.json(formatted);
	}

	// GET /issues/:id
	if (method === 'GET' && issueId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		// Fetch the requested single issue from the database
		const issue = await env.DB.prepare('SELECT * FROM issues WHERE id = ?').bind(Number(issueId)).first();

		if (!issue) {
			return Response.json({ error: 'Issue not found' }, { status: 404 });
		}

		// Ensure multi-tenant boundaries: requestor must be a member of the team the issue belongs to
		const membership = await requireTeamMember(env, auth.userId, issue.team_id);
		if (membership.error) return membership.error;

		// Parse stringified JSON fields back into proper arrays/objects to match the list output schema conventions
		const formatted = {
			...issue,
			tags: JSON.parse(issue.tags || '[]'),
			stack_trace: JSON.parse(issue.stack_trace || '[]'),
			affected_files: JSON.parse(issue.affected_files || '[]'),
		};

		return Response.json(formatted);
	}

	// POST /issues
	if (method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();

		// Enforce required constraint validation for description alongside title and team_id
		if (!body.title || !body.team_id || !body.description) {
			return Response.json({ error: 'title, team_id, and description are required' }, { status: 400 });
		}

		if (typeof body.title !== 'string' || body.title.trim() === '') {
			return Response.json({ error: 'Invalid title format. Must be a non-empty string.' }, { status: 400 });
		}

		// Strictly validate that description is a valid non-empty text string type
		if (typeof body.description !== 'string' || body.description.trim() === '') {
			return Response.json({ error: 'Invalid description format. Must be a non-empty string.' }, { status: 400 });
		}

		const parsedTeamId = Number(body.team_id);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team_id. Must be a positive integer.' }, { status: 400 });
		}

		const membership = await requireTeamMember(env, auth.userId, parsedTeamId);
		if (membership.error) return membership.error;

		// Point 2 Change: Mid-flight workspace membership validation when an assignment is requested during initialization
		//Checks valid assigned member for new issue
		let assignedTo = null;
		if (body.assigned_to !== undefined && body.assigned_to !== null) {
			assignedTo = Number(body.assigned_to);
			if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
				return Response.json({ error: 'Invalid assigned_to format. Must be a positive integer.' }, { status: 400 });
			}

			const assigneeMembership = await requireTeamMember(env, assignedTo, parsedTeamId);
			if (assigneeMembership.error) {
				return Response.json({ error: 'Invalid assignment. Assignee must be an established member of the team.' }, { status: 400 });
			}
		}

		// Point 6 Change: Strict Array Schema Validation for Tags in POST payload
		// Assures type-safety to prevent runtime exceptions upon JSON parsing of malicious payloads.
		//Checks that tag is array not invalid object type to protect GET fetches that parse tags with JSON.parse; if tags is provided in the body, it must be an array of strings. If it's not, return a 400 error indicating invalid format. This validation ensures that the tags field adheres to the expected structure, preventing potential issues during data processing and retrieval.
		if (body.tags !== undefined && body.tags !== null) {
			if (!Array.isArray(body.tags) || !body.tags.every((t) => typeof t === 'string')) {
				return Response.json({ error: 'Invalid tags format' }, { status: 400 });
			}
		}

		const status = body.status?.trim();
		const priority = body.priority?.trim();
		const category = body.category?.trim();

		if (status && !ISSUE_STATUSES.includes(status)) {
			return Response.json({ error: `Invalid status. Must be one of: ${ISSUE_STATUSES.join(', ')}` }, { status: 400 });
		}

		if (priority && !ISSUE_PRIORITIES.includes(priority)) {
			return Response.json({ error: `Invalid priority. Must be one of: ${ISSUE_PRIORITIES.join(', ')}` }, { status: 400 });
		}

		if (category && !ALLOWED_CATEGORIES.includes(category)) {
			return Response.json({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 });
		}

		const now = new Date().toISOString();

		const { success } = await env.DB.prepare(
			`
			INSERT INTO issues (
				team_id, created_by, title, description, summary,
				status, priority, category, tags, difficulty,
				entry_point, error_type, error_message, stack_trace,
				affected_files, assigned_to, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
		)
			.bind(
				parsedTeamId,
				auth.userId,
				body.title.trim(),
				body.description.trim(),
				body.summary || null,
				status || 'Open',
				priority || 'Medium',
				category || 'Bug',
				JSON.stringify(body.tags || []),
				body.difficulty || null,
				body.details?.entry_point || null,
				body.details?.error_type || null,
				body.details?.error_message || null,
				JSON.stringify(body.details?.stack_trace || []),
				JSON.stringify(body.details?.affected_files || []),
				assignedTo,
				now,
				now,
			)
			.run();

		return Response.json({ success }, { status: 201 });
	}

	// PATCH /issues/:id
	if (method === 'PATCH' && issueId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const issue = await env.DB.prepare('SELECT team_id FROM issues WHERE id = ?').bind(Number(issueId)).first();

		if (!issue) {
			return Response.json({ error: 'Issue not found' }, { status: 404 });
		}

		const membership = await requireTeamMember(env, auth.userId, issue.team_id);
		if (membership.error) return membership.error;

		const body = await request.json();

		// Check if at least one valid mutable column is supplied in the request payload
		//Checks if any of the allowed fields are present in the request body for update; if not, returns a 400 error indicating no valid fields were provided. This prevents empty or irrelevant PATCH requests that don't specify any updatable fields.
		const hasValidField =
			body.title !== undefined ||
			body.description !== undefined ||
			body.summary !== undefined ||
			body.status !== undefined ||
			body.priority !== undefined ||
			body.category !== undefined ||
			body.difficulty !== undefined ||
			body.tags !== undefined ||
			body.assigned_to !== undefined;

		if (!hasValidField) {
			return Response.json({ error: 'No valid fields provided' }, { status: 400 });
		}

		// Validation rules for Point 1
		if (body.title !== undefined) {
			if (typeof body.title !== 'string' || body.title.trim() === '') {
				return Response.json({ error: 'Invalid title format. Must be a non-empty string.' }, { status: 400 });
			}
		}

		// Enforce non-empty constraint if description is optionally supplied for a slide update
		if (body.description !== undefined) {
			if (typeof body.description !== 'string' || body.description.trim() === '') {
				return Response.json({ error: 'Invalid description format. Must be a non-empty string.' }, { status: 400 });
			}
		}

		// Point 6 Change: Strict Array Schema Validation for Tags in PATCH payload
		// Rejects variations to guard downstream workflows when updating tags.
		//Checks that tag is array not invalid object type to protect GET fetches that parse tags with JSON.parse; if invalid, returns a 400 error indicating invalid tags format. This ensures that the tags field maintains consistent data structure for proper handling in retrieval and display logic.
		if (body.tags !== undefined && body.tags !== null) {
			if (!Array.isArray(body.tags) || !body.tags.every((t) => typeof t === 'string')) {
				return Response.json({ error: 'Invalid tags format' }, { status: 400 });
			}
		}

		const status = body.status?.trim();
		const priority = body.priority?.trim();
		const category = body.category?.trim();

		if (status && !ISSUE_STATUSES.includes(status)) {
			return Response.json({ error: 'Invalid status value' }, { status: 400 });
		}
		if (priority && !ISSUE_PRIORITIES.includes(priority)) {
			return Response.json({ error: 'Invalid priority value' }, { status: 400 });
		}
		if (category && !ALLOWED_CATEGORIES.includes(category)) {
			return Response.json({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 });
		}

		let assignedTo = null;
		if (body.assigned_to !== undefined) {
			assignedTo = Number(body.assigned_to);
			if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
				return Response.json({ error: 'Invalid assigned_to format. Must be a positive integer.' }, { status: 400 });
			}

			// Point 2 Change: Mid-flight workspace membership validation when an assignment update is requested
			//Checks if issue is assigned to member of same team before allowing assignment update; if not, returns a 400 error indicating invalid assignment. This ensures that issues cannot be assigned to users who are not part of the issue's team, maintaining data integrity and proper access control.
			//Checks valid assigned member for issue update
			const assigneeMembership = await requireTeamMember(env, assignedTo, issue.team_id);
			if (assigneeMembership.error) {
				return Response.json({ error: 'Invalid assignment. Assignee must be an established member of the team.' }, { status: 400 });
			}
		}

		// Prepare bindings for text/JSON items following original database fallback conventions
		const title = body.title?.trim() || null;
		const description = body.description?.trim() || null;
		const summary = body.summary || null;
		const difficulty = body.difficulty || null;
		const tags = body.tags !== undefined ? JSON.stringify(body.tags) : null;

		// System timestamp is generated server-side; body overrides are completely ignored
		const now = new Date().toISOString();

		//manual updates to all columns except updated_at follows system update (not manual)
		const { success } = await env.DB.prepare(
			`
			UPDATE issues SET
				title = COALESCE(?, title),
				description = COALESCE(?, description),
				summary = COALESCE(?, summary),
				status = COALESCE(?, status),
				priority = COALESCE(?, priority),
				category = COALESCE(?, category),
				difficulty = COALESCE(?, difficulty),
				tags = COALESCE(?, tags),
				assigned_to = COALESCE(?, assigned_to),
				updated_at = ?
			WHERE id = ?
			`,
		)
			.bind(
				title,
				description,
				summary,
				status || null,
				priority || null,
				category || null,
				difficulty,
				tags,
				assignedTo,
				now,
				Number(issueId),
			)
			.run();

		return Response.json({ success });
	}

	// DELETE /issues/:id
	if (method === 'DELETE' && issueId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const issue = await env.DB.prepare('SELECT team_id FROM issues WHERE id = ?').bind(Number(issueId)).first();

		if (!issue) {
			return Response.json({ error: 'Issue not found' }, { status: 404 });
		}

		const membership = await requireTeamMember(env, auth.userId, issue.team_id);
		if (membership.error) return membership.error;

		const { success } = await env.DB.prepare('DELETE FROM issues WHERE id = ?').bind(Number(issueId)).run();

		return Response.json({ success });
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
