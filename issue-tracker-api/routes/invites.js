import { requireAuth } from '../src/lib/auth.js';
import { requireTeamAdmin } from '../src/lib/teams.js';

/**
 * Handles invite-related endpoints.
 *
 * Endpoints:
 * GET    /invites
 * POST   /invites
 * DELETE /invites/:id
 * POST   /teams/:teamId/invite
 *
 * @param {Request} request
 * @param {Env} env
 * @returns {Promise<Response>}
 */
export async function handleInvites(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');

	// GET /invites
	if (url.pathname === '/invites' && method === 'GET') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const { results } = await env.DB.prepare(
			`
				SELECT invites.*, teams.team_name
				FROM invites
				JOIN teams
				ON invites.team_id = teams.id
				WHERE invites.invited_user_id = ?
				AND invites.status = 'pending'
			`,
		)
			.bind(auth.userId)
			.all();

		return Response.json(results);
	}

	// POST /invites
	if (url.pathname === '/invites' && method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();

		if (
			!body.team_id ||
			!body.invited_user_id ||
			!Number.isInteger(Number(body.team_id)) ||
			!Number.isInteger(Number(body.invited_user_id))
		) {
			return Response.json({ error: 'Invalid team_id or invited_user_id' }, { status: 400 });
		}

		if (Number(body.invited_user_id) === Number(auth.userId)) {
			return Response.json({ error: 'Cannot invite yourself' }, { status: 400 });
		}

		const adminCheck = await requireTeamAdmin(env, auth.userId, Number(body.team_id));

		if (adminCheck.error) return adminCheck.error;

		const existingMember = await env.DB.prepare(
			`
				SELECT *
				FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
		)
			.bind(body.team_id, body.invited_user_id)
			.first();

		if (existingMember) {
			return Response.json({ error: 'User already in team' }, { status: 409 });
		}

		const existingInvite = await env.DB.prepare(
			`
				SELECT *
				FROM invites
				WHERE team_id = ?
				AND invited_user_id = ?
				AND status = 'pending'
			`,
		)
			.bind(body.team_id, body.invited_user_id)
			.first();

		if (existingInvite) {
			return Response.json({ error: 'Pending invite already exists' }, { status: 409 });
		}

		const now = new Date().toISOString();

		const result = await env.DB.prepare(
			`
				INSERT INTO invites (
					team_id,
					inviter_user_id,
					invited_user_id,
					status,
					created_at
				)
				VALUES (?, ?, ?, ?, ?)
			`,
		)
			.bind(body.team_id, auth.userId, body.invited_user_id, 'pending', now)
			.run();

		return Response.json(
			{
				success: true,
				invite_id: result.meta.last_row_id,
			},
			{ status: 201 },
		);
	}

	// DELETE /invites/:id
	if (url.pathname.startsWith('/invites/') && method === 'DELETE') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const inviteId = pathParts[2];

		if (!Number.isInteger(Number(inviteId))) {
			return Response.json({ error: 'Invalid invite ID' }, { status: 400 });
		}

		await env.DB.prepare(
			`
				DELETE FROM invites
				WHERE id = ?
			`,
		)
			.bind(inviteId)
			.run();

		return Response.json({
			success: true,
		});
	}

	// POST /teams/:teamId/invite
	if (url.pathname.startsWith('/teams/') && url.pathname.endsWith('/invite') && method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const teamId = pathParts[2];

		if (!Number.isInteger(Number(teamId))) {
			return Response.json({ error: 'Invalid team ID' }, { status: 400 });
		}

		const body = await request.json();

		if (!body.invited_user_id || !Number.isInteger(Number(body.invited_user_id))) {
			return Response.json({ error: 'Invalid invited_user_id' }, { status: 400 });
		}

		if (Number(body.invited_user_id) === Number(auth.userId)) {
			return Response.json({ error: 'Cannot invite yourself' }, { status: 400 });
		}

		const adminCheck = await requireTeamAdmin(env, auth.userId, Number(teamId));

		if (adminCheck.error) return adminCheck.error;

		const now = new Date().toISOString();

		const result = await env.DB.prepare(
			`
				INSERT INTO invites (
					team_id,
					inviter_user_id,
					invited_user_id,
					status,
					created_at
				)
				VALUES (?, ?, ?, ?, ?)
			`,
		)
			.bind(teamId, auth.userId, body.invited_user_id, 'pending', now)
			.run();

		return Response.json(
			{
				success: true,
				invite_id: result.meta.last_row_id,
			},
			{ status: 201 },
		);
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
