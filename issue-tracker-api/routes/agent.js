/**
 * Handles all /agents routes: GET (list or by id), POST (create), PATCH (update), DELETE.
 * @param {Request} request - The incoming Worker request.
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @returns {Promise<Response>}
 *   200 — agent list (GET), single agent (GET :id), update/delete confirmation (PATCH/DELETE)
 *   201 — agent created (POST)
 *   400 — invalid id, invalid JSON, or validation errors
 *   404 — agent not found or route not matched
 */
export async function handleAgents(request, env) {
	const url = new URL(request.url);
	const pathname = url.pathname;

	const agentIdMatch = pathname.match(/^\/agents\/([^/]+)$/);
	const agentId = agentIdMatch ? agentIdMatch[1] : null;

	const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
	const isValidId = (value) => /^\d+$/.test(value) && Number(value) > 0;
	const allowedFields = ['name', 'type', 'token'];

	if (request.method === 'GET' && pathname === '/agents') {
		const { results } = await env.DB.prepare('SELECT * FROM agents').all();

		return Response.json(results);
	}

	if (agentId && !isValidId(agentId)) {
		return new Response('Invalid agent id', { status: 400 });
	}

	if (request.method === 'GET' && agentId) {
		const agent = await env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agentId).first();

		if (!agent) {
			return new Response('Agent not found', { status: 404 });
		}

		return Response.json(agent);
	}

	if (request.method === 'POST' && pathname === '/agents') {
		let body;

		try {
			body = await request.json();
		} catch (_error) {
			return new Response('Invalid JSON request body', { status: 400 });
		}

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return new Response('Request body must be a JSON object', { status: 400 });
		}

		if (!isNonEmptyString(body.name)) {
			return new Response("Field 'name' is required and must be a non-empty string", { status: 400 });
		}

		if (!isNonEmptyString(body.type)) {
			return new Response("Field 'type' is required and must be a non-empty string", { status: 400 });
		}

		if (body.token !== undefined && body.token !== null && typeof body.token !== 'string') {
			return new Response("Field 'token' must be a string or null", { status: 400 });
		}

		await env.DB.prepare('INSERT INTO agents (name, type, token) VALUES (?, ?, ?)')
			.bind(body.name.trim(), body.type.trim(), body.token === undefined ? null : body.token)
			.run();

		return new Response('Agent created', { status: 201 });
	}

	if (request.method === 'PATCH' && agentId) {
		let body;

		try {
			body = await request.json();
		} catch (_error) {
			return new Response('Invalid JSON request body', { status: 400 });
		}

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			return new Response('Request body must be a JSON object', { status: 400 });
		}

		const invalidFields = Object.keys(body).filter((key) => !allowedFields.includes(key));

		if (invalidFields.length > 0) {
			return new Response(`Invalid field(s): ${invalidFields.join(', ')}`, { status: 400 });
		}

		const fields = allowedFields.filter((key) => body[key] !== undefined);

		if (fields.length === 0) {
			return new Response('No valid fields provided for update', { status: 400 });
		}

		if (body.name !== undefined && !isNonEmptyString(body.name)) {
			return new Response("Field 'name' must be a non-empty string", { status: 400 });
		}

		if (body.type !== undefined && !isNonEmptyString(body.type)) {
			return new Response("Field 'type' must be a non-empty string", { status: 400 });
		}

		if (body.token !== undefined && body.token !== null && typeof body.token !== 'string') {
			return new Response("Field 'token' must be a string or null", { status: 400 });
		}

		const setClause = fields.map((key) => `${key} = ?`).join(', ');
		const values = fields.map((key) => {
			if (typeof body[key] === 'string') {
				return body[key].trim();
			}

			return body[key];
		});

		const result = await env.DB.prepare(`UPDATE agents SET ${setClause} WHERE id = ?`)
			.bind(...values, agentId)
			.run();

		if (result.meta.changes === 0) {
			return new Response('Agent not found', { status: 404 });
		}

		return new Response('Agent updated', { status: 200 });
	}

	if (request.method === 'DELETE' && agentId) {
		const result = await env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(agentId).run();

		if (result.meta.changes === 0) {
			return new Response('Agent not found', { status: 404 });
		}

		return new Response('Agent deleted', { status: 200 });
	}

	return new Response('Not Found', { status: 404 });
}
