// Validations based on research/backend-research/schema-example.js
const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ALLOWED_CATEGORIES = ['Bug', 'Feature', 'Task'];

/**
 *
 * @param request
 * @param env
 */
export async function handleIssues(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const issueId = pathParts[2]; // /issues/:id

	// GET /issues?team_id=X (Fetch all issues for a team)
	if (method === 'GET' && !issueId) {
		const teamId = url.searchParams.get('team_id');
		if (!teamId) return Response.json({ error: 'team_id query param required' }, { status: 400 });

		const { results } = await env.issue_tracker_db.prepare('SELECT * FROM issues WHERE team_id = ?').bind(teamId).all();

		// Parse JSON strings back into arrays for the frontend
		const formatted = results.map((row) => ({
			...row,
			tags: JSON.parse(row.tags || '[]'),
			stack_trace: JSON.parse(row.stack_trace || '[]'),
			affected_files: JSON.parse(row.affected_files || '[]'),
		}));

		return Response.json(formatted);
	}

	// POST /issues (Create a new user-reported issue)
	if (method === 'POST') {
		const body = await request.json();

		// Manual Validation
		if (!body.title || !body.team_id || !body.created_by) {
			return Response.json({ error: 'Missing required fields' }, { status: 400 });
		}

		const now = new Date().toISOString();
		const { success } = await env.issue_tracker_db
			.prepare(
				`
            INSERT INTO issues (
                team_id, created_by, title, description, summary, 
                status, priority, category, tags, difficulty, entry_point, 
                error_type, error_message, stack_trace, affected_files,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
			)
			.bind(
				body.team_id,
				body.created_by,
				body.title,
				body.description || null,
				body.summary || null,
				body.status || 'Open',
				body.priority || 'Medium',
				body.category || 'Bug',
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

	// PATCH /issues/:id (Update status, priority, or details)
	if (method === 'PATCH' && issueId) {
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
