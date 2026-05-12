/**
 *
 * @param request
 * @param env
 */
export async function handleTeams(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const teamId = pathParts[2];

	// GET /teams?user_id=X
	if (method === 'GET' && !teamId) {
		const userId = url.searchParams.get('user_id');

		if (!userId) {
			return Response.json({ error: 'user_id query param required' }, { status: 400 });
		}

		const { results } = await env.issue_tracker_db
			.prepare(
				`
				SELECT teams.*
				FROM teams
				JOIN team_members
				ON teams.id = team_members.team_id
				WHERE team_members.user_id = ?
			`,
			)
			.bind(userId)
			.all();

		return Response.json(results);
	}

	// POST /teams
	if (method === 'POST' && !teamId) {
		const body = await request.json();

		if (!body.team_name || !body.created_by) {
			return Response.json({ error: 'Missing required fields' }, { status: 400 });
		}

		const now = new Date().toISOString();

		const result = await env.issue_tracker_db
			.prepare(
				`
				INSERT INTO teams (team_name, created_at)
				VALUES (?, ?)
			`,
			)
			.bind(body.team_name, now)
			.run();

		const newTeamId = result.meta.last_row_id;

		await env.issue_tracker_db
			.prepare(
				`
				INSERT INTO team_members (user_id, team_id, role)
				VALUES (?, ?, ?)
			`,
			)
			.bind(body.created_by, newTeamId, 'admin')
			.run();

		return Response.json(
			{
				success: true,
				team_id: newTeamId,
			},
			{ status: 201 },
		);
	}

	// GET /teams/:teamId/members
	if (method === 'GET' && teamId && pathParts[3] === 'members') {
		const { results } = await env.issue_tracker_db
			.prepare(
				`
				SELECT users.id, users.username, users.email, team_members.role
				FROM users
				JOIN team_members
				ON users.id = team_members.user_id
				WHERE team_members.team_id = ?
			`,
			)
			.bind(teamId)
			.all();

		return Response.json(results);
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
