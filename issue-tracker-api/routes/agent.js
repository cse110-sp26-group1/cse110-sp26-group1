/**
 * Handles all agent-related API routes.
 *
 * Routes:
 *   GET    /agents       - List all agents
 *   GET    /agents/:id   - Get a specific agent by ID
 *   POST   /agents       - Create a new agent
 *   PATCH  /agents/:id   - Partially update an agent by ID
 *   DELETE /agents/:id   - Delete an agent by ID
 *
 * @param {Request} request
 * @param {object} env
 */
export async function handleAgents(request, env) {
	const url = new URL(request.url);
	const pathname = url.pathname;

	// Match /agents/:id — capture the id segment
	const agentIdMatch = pathname.matgit ch(/^\/agents\/([^/]+)$/);
	const agentId = agentIdMatch ? agentIdMatch[1] : null;

	// GET /agents
	if (request.method === 'GET' && pathname === '/agents') {
		const { results } = await env.issue_tracker_db.prepare('SELECT * FROM agents').all();

		return Response.json(results);
	}

	// GET /agents/:id
	if (request.method === 'GET' && agentId) {
		const agent = await env.issue_tracker_db
			.prepare('SELECT * FROM agents WHERE id = ?')
			.bind(agentId)
			.first();

		if (!agent) {
			return new Response('Agent not found', { status: 404 });
		}

		return Response.json(agent);
	}

	// POST /agents
	if (request.method === 'POST' && pathname === '/agents') {
		const body = await request.json();

		if (!body.name || !body.type) {
			return new Response("Missing required fields: 'name' and 'type'", { status: 400 });
		}

		await env.issue_tracker_db
			.prepare('INSERT INTO agents (name, type, token) VALUES (?, ?, ?)')
			.bind(body.name, body.type, body.token ?? null)
			.run();

		return new Response('Agent created', { status: 201 });
	}

	// PATCH /agents/:id
	if (request.method === 'PATCH' && agentId) {
		const body = await request.json();

		// Build SET clause dynamically from whichever fields were provided
		const allowed = ['name', 'type', 'token'];
		const fields = allowed.filter((key) => body[key] !== undefined);

		if (fields.length === 0) {
			return new Response('No valid fields provided for update', { status: 400 });
		}

		const setClause = fields.map((key) => `${key} = ?`).join(', ');
		const values = fields.map((key) => body[key]);

		const result = await env.issue_tracker_db
			.prepare(`UPDATE agents SET ${setClause} WHERE id = ?`)
			.bind(...values, agentId)
			.run();

		if (result.meta.changes === 0) {
			return new Response('Agent not found', { status: 404 });
		}

		return new Response('Agent updated', { status: 200 });
	}

	// DELETE /agents/:id
	if (request.method === 'DELETE' && agentId) {
		const result = await env.issue_tracker_db
			.prepare('DELETE FROM agents WHERE id = ?')
			.bind(agentId)
			.run();

		if (result.meta.changes === 0) {
			return new Response('Agent not found', { status: 404 });
		}

		return new Response('Agent deleted', { status: 200 });
	}

	return new Response('Not Found', { status: 404 });
}