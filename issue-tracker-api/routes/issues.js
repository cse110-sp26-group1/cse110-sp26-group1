import { requireAuth } from '../src/lib/auth.js';
import { requireTeamMember } from '../src/lib/teams.js';
import { processIssue } from '../src/llm.js';

const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ALLOWED_CATEGORIES = ['Bug', 'Feature', 'Task'];

/**
 * Picks the user value if present, otherwise the LLM value if it's in the
 * allowed enum list, otherwise the fallback. Empty strings/null are skipped.
 * @param userVal
 * @param llmVal
 * @param allowed
 * @param fallback
 */
function pickEnum(userVal, llmVal, allowed, fallback) {
	if (userVal && allowed.includes(userVal)) return userVal;
	if (typeof llmVal === 'string' && allowed.includes(llmVal)) return llmVal;
	return fallback;
}

/**
 * Coerces a value into an array. The LLM parser may return a string, null, or
 * an array; user input may already be an array.
 * @param userVal
 * @param llmVal
 */
function coerceArray(userVal, llmVal) {
	if (Array.isArray(userVal)) return userVal;
	if (Array.isArray(llmVal)) return llmVal;
	return [];
}

/**
 * Returns user value if non-empty string, else LLM value if non-empty (and not
 * the literal "null" sentinel from the parser), else null.
 * @param userVal
 * @param llmVal
 */
function coerceText(userVal, llmVal) {
	if (typeof userVal === 'string' && userVal.trim() !== '') return userVal;
	if (typeof llmVal === 'string' && llmVal.trim() !== '' && llmVal !== 'null') return llmVal;
	return null;
}

/**
 * Stores LLM array fields (missing_information, steps_to_reproduce) as JSON
 * strings, plain text otherwise. The schema column is TEXT either way.
 * @param userVal
 * @param llmVal
 */
function stringifyMaybeArray(userVal, llmVal) {
	const v = userVal ?? llmVal ?? null;
	if (v === null) return null;
	if (Array.isArray(v)) return JSON.stringify(v);
	if (typeof v === 'string' && v.trim() === '') return null;
	if (v === 'null') return null;
	return String(v);
}

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

		const teamIdParam = url.searchParams.get('team_id');
		if (teamIdParam === null || teamIdParam.trim() === '') {
			return Response.json({ error: 'team_id query param required' }, { status: 400 });
		}

		const teamId = Number(teamIdParam);
		if (Number.isNaN(teamId) || !Number.isInteger(teamId) || teamId <= 0) {
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
			const assignedTo = Number(assignedToParam);
			if (Number.isNaN(assignedTo) || !Number.isInteger(assignedTo) || assignedTo <= 0) {
				return Response.json({ error: 'Invalid assigned_to format. Must be a positive integer.' }, { status: 400 });
			}
			query += ' AND assigned_to = ?';
			bindings.push(assignedTo);
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
	//POST accepts .txt and .log as well
	if (method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		let body = {};
		const contentType = request.headers.get('content-type') || '';

		// Dynamically handle form data vs traditional raw JSON payloads
		if (contentType.includes('multipart/form-data')) {
			const formData = await request.formData();
			body.title = formData.get('title');
			body.description = formData.get('description');
			body.team_id = formData.get('team_id');
			body.status = formData.get('status');
			body.priority = formData.get('priority');
			body.category = formData.get('category');
			body.summary = formData.get('summary');
			body.difficulty = formData.get('difficulty');
			body.assigned_to = formData.get('assigned_to');

			const tagsRaw = formData.get('tags');
			if (tagsRaw) {
				try {
					body.tags = JSON.parse(tagsRaw);
				} catch (_) {
					body.tags = tagsRaw.split(',').map((t) => t.trim());
				}
			}

			body.details = {
				entry_point: formData.get('entry_point'),
				error_type: formData.get('error_type'),
				error_message: formData.get('error_message'),
			};

			const stackTraceRaw = formData.get('stack_trace');
			if (stackTraceRaw) {
				try {
					body.details.stack_trace = JSON.parse(stackTraceRaw);
				} catch (_) {}
			}
			const affectedFilesRaw = formData.get('affected_files');
			if (affectedFilesRaw) {
				try {
					body.details.affected_files = JSON.parse(affectedFilesRaw);
				} catch (_) {}
			}

			// Feature implementation: Extract file content from attachments for the LLM enrichment layer
			const attachments = formData.getAll('attachments');
			let fileContents = '';
			for (const file of attachments) {
				if (file && typeof file.text === 'function') {
					const text = await file.text();
					if (text) {
						fileContents += `\n\n--- Attachment: ${file.name} ---\n${text}`;
					}
				}
			}
			if (fileContents && typeof body.description === 'string') {
				body.description += fileContents;
			}
		} else {
			body = await request.json();
		}

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

		// LLM enrichment: ask DeepSeek to infer structured fields from the user's
		// raw title + description. Failures (missing key, network, parse error)
		// are non-fatal — we just fall back to user-supplied values + defaults.
		let llm = {};
		if (env.DEEPSEEK_API) {
			try {
				const rawInput = `${body.title.trim()}\n\n${body.description.trim()}`;
				llm = await processIssue(rawInput, env.DEEPSEEK_API);
			} catch (error) {
				console.error('LLM enrichment failed:', error?.message ?? error);
			}
		}

		const finalStatus = pickEnum(status, llm.status, ISSUE_STATUSES, 'Open');
		const finalPriority = pickEnum(priority, llm.priority, ISSUE_PRIORITIES, 'Medium');
		const finalCategory = pickEnum(category, llm.category, ALLOWED_CATEGORIES, 'Bug');
		const finalDifficulty = body.difficulty || (llm.difficulty && llm.difficulty !== 'null' ? llm.difficulty : null);
		const finalSummary = coerceText(body.summary, llm.summary);
		const finalTags = JSON.stringify(coerceArray(body.tags, llm.tags));

		const finalEntryPoint = coerceText(body.details?.entry_point, llm.entry_point ?? llm.details?.entry_point);
		const finalErrorType = coerceText(body.details?.error_type, llm.error_type ?? llm.details?.error_type);
		const finalErrorMessage = coerceText(body.details?.error_message, llm.error_message ?? llm.details?.error_message);
		const finalStackTrace = JSON.stringify(coerceArray(body.details?.stack_trace, llm.stack_trace ?? llm.details?.stack_trace));
		const finalAffectedFiles = JSON.stringify(coerceArray(body.details?.affected_files, llm.affected_files ?? llm.details?.affected_files));

		const finalExpectedBehavior = coerceText(body.expected_behavior, llm.expected_behavior);
		const finalActualBehavior = coerceText(body.actual_behavior, llm.actual_behavior);
		const finalMissingInformation = stringifyMaybeArray(body.missing_information, llm.missing_information);
		const finalStepsToReproduce = stringifyMaybeArray(body.steps_to_reproduce, llm.steps_to_reproduce);
		const finalHypothesis = coerceText(body.hypothesis, llm.hypothesis);

		const now = new Date().toISOString();

		const result = await env.DB.prepare(
			`
			INSERT INTO issues (
				team_id, created_by, title, description, summary,
				status, priority, category, tags, difficulty,
				entry_point, error_type, error_message, stack_trace, affected_files,
				expected_behavior, actual_behavior, missing_information, steps_to_reproduce, hypothesis,
				assigned_to, created_at, updated_at
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING id
			`,
		)
			.bind(
				parsedTeamId,
				auth.userId,
				body.title.trim(),
				body.description.trim(),
				finalSummary,
				finalStatus,
				finalPriority,
				finalCategory,
				finalTags,
				finalDifficulty,
				finalEntryPoint,
				finalErrorType,
				finalErrorMessage,
				finalStackTrace,
				finalAffectedFiles,
				finalExpectedBehavior,
				finalActualBehavior,
				finalMissingInformation,
				finalStepsToReproduce,
				finalHypothesis,
				assignedTo,
				now,
				now,
			)
			.first();

		return Response.json(
			{
				success: true,
				id: result?.id ?? null,
				enriched: {
					summary: finalSummary,
					status: finalStatus,
					priority: finalPriority,
					category: finalCategory,
					difficulty: finalDifficulty,
					tags: JSON.parse(finalTags),
					entry_point: finalEntryPoint,
					error_type: finalErrorType,
					error_message: finalErrorMessage,
					stack_trace: JSON.parse(finalStackTrace),
					affected_files: JSON.parse(finalAffectedFiles),
					expected_behavior: finalExpectedBehavior,
					actual_behavior: finalActualBehavior,
					missing_information: finalMissingInformation,
					steps_to_reproduce: finalStepsToReproduce,
					hypothesis: finalHypothesis,
				},
			},
			{ status: 201 },
		);
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
		// Included newly exposed agent analysis parameters into verification flow
		const hasValidField =
			body.title !== undefined ||
			body.description !== undefined ||
			body.summary !== undefined ||
			body.status !== undefined ||
			body.priority !== undefined ||
			body.category !== undefined ||
			body.difficulty !== undefined ||
			body.tags !== undefined ||
			body.assigned_to !== undefined ||
			body.hypothesis !== undefined ||
			body.steps_to_reproduce !== undefined ||
			body.expected_behavior !== undefined ||
			body.actual_behavior !== undefined ||
			body.missing_information !== undefined ||
			body.attempt_notes !== undefined ||
			body.resolution_notes !== undefined ||
			body.affected_files !== undefined;

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

		// Strictly validate type matching for affected_files array syntax representation
		if (body.affected_files !== undefined && body.affected_files !== null) {
			if (!Array.isArray(body.affected_files) || !body.affected_files.every((f) => typeof f === 'string')) {
				return Response.json({ error: 'Invalid affected_files format. Must be an array of strings.' }, { status: 400 });
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

		// Bind agent-mutable details safely to variables
		const hypothesis = body.hypothesis || null;
		const stepsToReproduce = body.steps_to_reproduce || null;
		const expectedBehavior = body.expected_behavior || null;
		const actualBehavior = body.actual_behavior || null;
		const missingInformation = body.missing_information || null;
		const attemptNotes = body.attempt_notes || null;
		const resolutionNotes = body.resolution_notes || null;
		const affectedFiles = body.affected_files !== undefined ? JSON.stringify(body.affected_files) : null;

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
				hypothesis = COALESCE(?, hypothesis),
				steps_to_reproduce = COALESCE(?, steps_to_reproduce),
				expected_behavior = COALESCE(?, expected_behavior),
				actual_behavior = COALESCE(?, actual_behavior),
				missing_information = COALESCE(?, missing_information),
				attempt_notes = COALESCE(?, attempt_notes),
				resolution_notes = COALESCE(?, resolution_notes),
				affected_files = COALESCE(?, affected_files),
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
				hypothesis,
				stepsToReproduce,
				expectedBehavior,
				actualBehavior,
				missingInformation,
				attemptNotes,
				resolutionNotes,
				affectedFiles,
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
