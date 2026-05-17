import { requireAuth } from '../src/lib/auth.js';
import { requireTeamMember } from '../src/lib/teams.js';

/**
 * Handles all /teams routes: GET (list by user), POST (create), GET /teams/:teamId/members.
 * @param {Request} request - The incoming Worker request.
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @returns {Promise<Response>}
 *   200 — teams list (GET) or team members (GET …/members)
 *   201 — team created (POST)
 *   400 — missing team_name (POST)
 *   403 — not a team member (GET …/members)
 *   404 — route not matched
 */
export async function handleTeams(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const teamId = pathParts[2];

	if (method === 'GET' && !teamId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const { results } = await env.DB.prepare(
			`
				SELECT teams.*
				FROM teams
				JOIN team_members
				ON teams.id = team_members.team_id
				WHERE team_members.user_id = ?
			`,
		)
			.bind(auth.userId)
			.all();

		return Response.json(results);
	}

	// POST /teams
	if (method === 'POST' && !teamId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();

		if (!body.team_name || typeof body.team_name !== 'string' || body.team_name.trim() === '') {
			return Response.json({ error: 'team_name is required' }, { status: 400 });
		}

		const now = new Date().toISOString();

		const result = await env.DB.prepare(
			`
				INSERT INTO teams (team_name, created_at)
				VALUES (?, ?)
			`,
		)
			.bind(body.team_name.trim(), now)
			.run();

		const newTeamId = result.meta.last_row_id;

		await env.DB.prepare(
			`
				INSERT INTO team_members (user_id, team_id, role)
				VALUES (?, ?, ?)
			`,
		)
			.bind(auth.userId, newTeamId, 'admin')
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
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const parsedTeamId = Number(teamId);
		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team ID format. Must be a positive integer.' }, { status: 400 });
		}

		const membership = await requireTeamMember(env, auth.userId, parsedTeamId);
		if (membership.error) return membership.error;

		const { results } = await env.DB.prepare(
			`
				SELECT users.id, users.username, users.email, team_members.role
				FROM users
				JOIN team_members
				ON users.id = team_members.user_id
				WHERE team_members.team_id = ?
			`,
		)
			.bind(parsedTeamId)
			.all();

		return Response.json(results);
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
