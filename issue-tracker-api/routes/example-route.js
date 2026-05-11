export async function handleIssues(request, env) {
	const url = new URL(request.url);

	// GET /issues
	if (request.method === 'GET' && url.pathname === '/issues') {
		const { results } = await env.issue_tracker_db.prepare('SELECT * FROM issues').all();

		return Response.json(results);
	}

	// POST /issues
	if (request.method === 'POST' && url.pathname === '/issues') {
		const body = await request.json();

		await env.issue_tracker_db
			.prepare('INSERT INTO issues (team_id, title, description) VALUES (?, ?, ?)')
			.bind(body.team_id, body.title, body.description)
			.run();

		return new Response('Issue created');
	}

	return new Response('Not Found', { status: 404 });
}
