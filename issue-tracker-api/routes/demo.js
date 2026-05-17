/**
 * Demo handler for /issues routes (GET all, POST create). Used for early prototyping only.
 * @param {Request} request - The incoming Worker request.
 * @param {{ DB: D1Database }} env - Worker environment with the D1 database binding.
 * @returns {Promise<Response>}
 *   200 — issues list (GET) or plain-text confirmation (POST)
 *   404 — route not matched
 */
export async function handleIssues(request, env) {
	const url = new URL(request.url);

	// GET /issues
	if (request.method === 'GET' && url.pathname === '/issues') {
		const { results } = await env.DB.prepare('SELECT * FROM issues').all();

		return Response.json(results);
	}

	// POST /issues
	if (request.method === 'POST' && url.pathname === '/issues') {
		const body = await request.json();

		await env.DB
			.prepare('INSERT INTO issues (team_id, title, description) VALUES (?, ?, ?)')
			.bind(body.team_id, body.title, body.description)
			.run();

		return new Response('Issue created');
	}

	return new Response('Not Found', { status: 404 });
}
