import { requireAuth } from '../src/lib/auth.js';
import { requireTeamMember } from '../src/lib/teams.js';

const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ALLOWED_CATEGORIES = ['Bug', 'Feature', 'Task'];

/**
 * Handles all /issues routes: GET (list by team), POST (create), PATCH (update), DELETE (remove).
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

		const { results } = await env.issue_tracker_db.prepare('SELECT * FROM issues WHERE team_id = ?').bind(teamId).all();

		const formatted = results.map((row) => ({
			...row,
			tags: JSON.parse(row.tags || '[]'),
			stack_trace: JSON.parse(row.stack_trace || '[]'),
			affected_files: JSON.parse(row.affected_files || '[]'),
		}));

		return Response.json(formatted);
	}

	// POST /issues
	if (method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();

		// Manual Validation
		if (!body.title || !body.team_id || !body.created_by) {
			return Response.json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Title Type Validation
		if (typeof body.title !== 'string' || body.title.trim() === '') {
			return Response.json({ error: 'Invalid title format. Must be a non-empty string.' }, { status: 400 });
		}

		// IDs Type Validation
		const parsedTeamId = Number(body.team_id);
		const parsedCreatedBy = Number(body.created_by);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team_id. Must be a positive integer.' }, { status: 400 });
		}
		if (!Number.isInteger(parsedCreatedBy) || parsedCreatedBy <= 0) {
			return Response.json({ error: 'Invalid created_by user ID. Must be a positive integer.' }, { status: 400 });
		}

		// Enum Value Validations
		if (body.status && !ISSUE_STATUSES.includes(body.status)) {
			return Response.json({ error: `Invalid status. Must be one of: ${ISSUE_STATUSES.join(', ')}` }, { status: 400 });
		}
		if (body.priority && !ISSUE_PRIORITIES.includes(body.priority)) {
			return Response.json({ error: `Invalid priority. Must be one of: ${ISSUE_PRIORITIES.join(', ')}` }, { status: 400 });
		}
		if (body.category && !ALLOWED_CATEGORIES.includes(body.category)) {
			return Response.json({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 });
		}

		const now = new Date().toISOString();

		const { success } = await env.DB.prepare(
			`
			INSERT INTO issues (
				team_id, created_by, title, description, summary,
				status, priority, category, tags, difficulty,
				entry_point, error_type, error_message, stack_trace,
				affected_files, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`,
		)
			.bind(
				body.team_id,
				body.created_by,
				body.title,
				body.description || null,
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
		const now = new Date().toISOString();

		// Dynamically build update query for provided fields
		const { success } = await env.issue_tracker_db
			.prepare(
				`
            UPDATE issues SET 
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                assigned_to = COALESCE(?, assigned_to),
                updated_at = ?
            WHERE id = ?
        `,
			)
			.bind(body.status || null, body.priority || null, body.assigned_to || null, now, issueId)
			.run();

		return Response.json({ success });
	}

	// DELETE /issues/:id
	if (method === 'DELETE' && issueId) {
		const { success } = await env.issue_tracker_db.prepare('DELETE FROM issues WHERE id = ?').bind(issueId).run();
		return Response.json({ success });
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
