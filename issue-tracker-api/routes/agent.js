/** @type {string[]} Valid issue status values. */
const ISSUE_STATUSES = ['open', 'in progress', 'resolved', 'closed'];

/** @type {string[]} Valid issue priority values. */
const ISSUE_PRIORITIES = ['low', 'medium', 'high', 'critical'];

/** @type {string[]} Valid issue category values. */
const ALLOWED_CATEGORIES = ['bug', 'feature', 'task'];

/**
 * Fields the agent is explicitly not allowed to set or update.
 * - `id`, `team_id`, `created_by`, `created_at`, `updated_at` are immutable
 *   record metadata that neither humans nor agents can directly edit.
 * - `description` is reserved for human input only.
 * - `assigned_to` is reserved for human assignment only.
 * @type {Set<string>}
 */
const AGENT_BLOCKED_FIELDS = new Set(['id', 'team_id', 'created_by', 'created_at', 'updated_at', 'description', 'assigned_to']);
/**
 * Array fields that must be stored as JSON strings in the database.
 * On read these are parsed back into arrays for the agent.
 * @type {string[]}
 */
const JSON_ARRAY_FIELDS = ['tags', 'stack_trace', 'affected_files'];

/**
 * Handles all /agents routes for AI agent access to the issues table.
 *
 * @param {Request} request - The incoming Worker request.
 * @param {{ issue_tracker_db: D1Database }} env - Worker environment with the D1 database binding.
 * @returns {Promise<Response>}
 *   200 — issue returned (GET), issue updated (PATCH)
 *   201 — issue created (POST)
 *   400 — invalid id, invalid JSON, missing/invalid required fields, or blocked fields
 *   404 — issue not found, or route not matched
 */
export async function handleAgents(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const issueId = pathParts[2]; // /agents/:id

	// --- Global id validation for any route that includes an id ---
	if (issueId) {
		const parsedIssueId = Number(issueId);
		if (!Number.isInteger(parsedIssueId) || parsedIssueId <= 0) {
			return Response.json({ error: 'Invalid issue ID format. Must be a positive integer.' }, { status: 400 });
		}
	}

	// -----------------------------------------------------------------------
	// GET /agents/:id
	// Fetch a single issue by id. Returns all fields as JSON so the agent has
	// full context before starting work (stack trace, steps to reproduce, etc.).
	// Array fields (tags, stack_trace, affected_files) are parsed from their
	// stored JSON strings back into arrays.
	// -----------------------------------------------------------------------
	if (method === 'GET' && issueId) {
		const issue = await env.issue_tracker_db.prepare('SELECT * FROM issues WHERE id = ?').bind(Number(issueId)).first();

		if (!issue) {
			return Response.json({ error: 'Issue not found' }, { status: 404 });
		}

		// Parse JSON array fields back into arrays for the agent
		const formatted = {
			...issue,
			tags: JSON.parse(issue.tags || '[]'),
			stack_trace: JSON.parse(issue.stack_trace || '[]'),
			affected_files: JSON.parse(issue.affected_files || '[]'),
		};

		return Response.json(formatted);
	}

	// -----------------------------------------------------------------------
	// POST /agents
	// Agent creates a new issue directly from the CLI into the issues table,
	// so it shows up on the frontend like any human-created issue. Unlike the
	// human endpoint where the LLM fills in details, the agent populates all
	// fields itself with full structured context.
	// -----------------------------------------------------------------------
	if (method === 'POST' && !issueId) {
		const body = await request.json().catch(() => null);

		if (body === null) {
			return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
		}

		// Body must be a plain object, not an array or primitive
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return Response.json({ error: 'Request body must be a JSON object' }, { status: 400 });
		}

		// --- Required field validation ---

		if (!body.title || !body.team_id || !body.created_by) {
			return Response.json({ error: 'Missing required fields: team_id, created_by, title' }, { status: 400 });
		}

		if (typeof body.title !== 'string' || body.title.trim() === '') {
			return Response.json({ error: 'Invalid title format. Must be a non-empty string.' }, { status: 400 });
		}

		const parsedTeamId = Number(body.team_id);
		const parsedCreatedBy = Number(body.created_by);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team_id. Must be a positive integer.' }, { status: 400 });
		}

		if (!Number.isInteger(parsedCreatedBy) || parsedCreatedBy <= 0) {
			return Response.json({ error: 'Invalid created_by. Must be a positive integer.' }, { status: 400 });
		}

		// --- Enum validation for optional fields ---

		if (body.status && !ISSUE_STATUSES.includes(body.status)) {
			return Response.json({ error: `Invalid status. Must be one of: ${ISSUE_STATUSES.join(', ')}` }, { status: 400 });
		}

		if (body.priority && !ISSUE_PRIORITIES.includes(body.priority)) {
			return Response.json({ error: `Invalid priority. Must be one of: ${ISSUE_PRIORITIES.join(', ')}` }, { status: 400 });
		}

		if (body.category && !ALLOWED_CATEGORIES.includes(body.category)) {
			return Response.json({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 });
		}

		if (body.token_usage !== undefined && !Number.isInteger(body.token_usage)) {
			return Response.json({ error: 'Invalid token_usage. Must be an integer.' }, { status: 400 });
		}

		const now = new Date().toISOString();

		// Insert all fields the agent provides. Array fields are stringified for storage.
		const { success } = await env.issue_tracker_db
			.prepare(
				`
				INSERT INTO issues (
					team_id, created_by, title, summary,
					status, priority, category, difficulty, tags,
					entry_point, error_type, error_message, stack_trace, affected_files,
					expected_behavior, actual_behavior, missing_information,
					steps_to_reproduce, hypothesis, token_usage, resolution_notes,
					created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`,
			)
			.bind(
				parsedTeamId,
				parsedCreatedBy,
				body.title.trim(),
				body.summary || null,
				body.status || 'open',
				body.priority || 'medium',
				body.category || 'bug',
				body.difficulty || null,
				JSON.stringify(body.tags || []),
				body.entry_point || null,
				body.error_type || null,
				body.error_message || null,
				JSON.stringify(body.stack_trace || []),
				JSON.stringify(body.affected_files || []),
				body.expected_behavior || null,
				body.actual_behavior || null,
				body.missing_information || null,
				body.steps_to_reproduce || null,
				body.hypothesis || null,
				body.token_usage || null,
				body.resolution_notes || null,
				now,
				now,
			)
			.run();

		return Response.json({ success }, { status: 201 });
	}

	// -----------------------------------------------------------------------
	// PATCH /agents/:id
	// Agent updates issue fields as it works on a fix. The agent can update
	// any field EXCEPT immutable record metadata and fields reserved for
	// human input (description, assigned_to). updated_at is always refreshed.
	// -----------------------------------------------------------------------
	if (method === 'PATCH' && issueId) {
		const body = await request.json().catch(() => null);

		if (body === null) {
			return Response.json({ error: 'Invalid JSON request body' }, { status: 400 });
		}

		// Body must be a plain object, not an array or primitive
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return Response.json({ error: 'Request body must be a JSON object' }, { status: 400 });
		}

		// Reject any explicitly blocked fields
		const blockedFields = Object.keys(body).filter((key) => AGENT_BLOCKED_FIELDS.has(key));
		if (blockedFields.length > 0) {
			return Response.json({ error: `Field(s) not allowed for agent update: ${blockedFields.join(', ')}` }, { status: 400 });
		}

		// Must have at least one field to update
		if (Object.keys(body).length === 0) {
			return Response.json({ error: 'No fields provided for update' }, { status: 400 });
		}

		// --- Enum validation for fields being patched ---

		if (body.status && !ISSUE_STATUSES.includes(body.status)) {
			return Response.json({ error: `Invalid status. Must be one of: ${ISSUE_STATUSES.join(', ')}` }, { status: 400 });
		}

		if (body.priority && !ISSUE_PRIORITIES.includes(body.priority)) {
			return Response.json({ error: `Invalid priority. Must be one of: ${ISSUE_PRIORITIES.join(', ')}` }, { status: 400 });
		}

		if (body.category && !ALLOWED_CATEGORIES.includes(body.category)) {
			return Response.json({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 });
		}

		if (body.token_usage !== undefined && !Number.isInteger(body.token_usage)) {
			return Response.json({ error: 'Invalid token_usage. Must be an integer.' }, { status: 400 });
		}

		const now = new Date().toISOString();

		// Build SET clause dynamically from provided fields.
		// Array fields are stringified for storage, strings are trimmed.
		const fields = Object.keys(body);
		const setClause = fields.map((key) => `${key} = ?`).join(', ');
		const values = fields.map((key) => {
			if (JSON_ARRAY_FIELDS.includes(key)) return JSON.stringify(body[key]);
			if (typeof body[key] === 'string') return body[key].trim();
			return body[key];
		});

		const result = await env.issue_tracker_db
			.prepare(`UPDATE issues SET ${setClause}, updated_at = ? WHERE id = ?`)
			.bind(...values, now, Number(issueId))
			.run();

		if (result.meta.changes === 0) {
			return Response.json({ error: 'Issue not found' }, { status: 404 });
		}

		return Response.json({ success: true });
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
