import { requireAuth } from '../src/lib/auth.js';
import { requireTeamAdmin } from '../src/lib/teams.js';

/**
 * Handles invite-related endpoints.
 *
 * Endpoints:
 * GET    /invites
 * GET    /invites/:id
 * POST   /invites
 * PATCH  /invites/:id/accept
 * PATCH  /invites/:id/reject
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
	const inviteId = pathParts[2];

	// GET /invites
	if (url.pathname === '/invites' && method === 'GET') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const { results } = await env.DB.prepare(
			`
				SELECT invites.*, teams.team_name, inviter.username AS inviter_username
				FROM invites
				JOIN teams
				ON invites.team_id = teams.id
				JOIN users AS inviter
				ON invites.inviter_user_id = inviter.id
				WHERE invites.invited_user_id = ?
				AND invites.status = 'pending'
			`,
		)
			.bind(auth.userId)
			.all();

		return Response.json(results);
	}

	// GET /invites/:id
	if (url.pathname.startsWith('/invites/') && method === 'GET') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		if (!Number.isInteger(Number(inviteId))) {
			return Response.json({ error: 'Invalid invite ID' }, { status: 400 });
		}

		const invite = await env.DB.prepare(
			`
				SELECT invites.*, teams.team_name, inviter.username AS inviter_username
				FROM invites
				JOIN teams
				ON invites.team_id = teams.id
				JOIN users AS inviter
				ON invites.inviter_user_id = inviter.id
				WHERE invites.id = ?
			`,
		)
			.bind(inviteId)
			.first();

		if (!invite) {
			return Response.json({ error: 'Invite not found' }, { status: 404 });
		}

		if (invite.invited_user_id !== auth.userId && invite.inviter_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}

		return Response.json(invite);
	}

	// POST /invites
	if (url.pathname === '/invites' && method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();

		return createInvite(env, auth.userId, body.team_id, body.invited_user_id);
	}

	// PATCH /invites/:id/accept
	if (url.pathname.startsWith('/invites/') && pathParts[3] === 'accept' && method === 'PATCH') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		if (!Number.isInteger(Number(inviteId))) {
			return Response.json({ error: 'Invalid invite ID' }, { status: 400 });
		}

		const invite = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();

		if (!invite) {
			return Response.json({ error: 'Invite not found' }, { status: 404 });
		}

		if (invite.invited_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}

		if (invite.status !== 'pending') {
			return Response.json({ error: 'Invite already handled' }, { status: 409 });
		}

		const existingMember = await env.DB.prepare(
			`
				SELECT *
				FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
		)
			.bind(invite.team_id, invite.invited_user_id)
			.first();

		if (existingMember) {
			return Response.json({ error: 'User already in team' }, { status: 409 });
		}

		await env.DB.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").bind(inviteId).run();

		await env.DB.prepare(
			`
				INSERT INTO team_members (team_id, user_id, role)
				VALUES (?, ?, ?)
			`,
		)
			.bind(invite.team_id, invite.invited_user_id, 'member')
			.run();

		return Response.json({
			success: true,
			message: 'Invite accepted',
		});
	}

	// PATCH /invites/:id/reject
	if (url.pathname.startsWith('/invites/') && pathParts[3] === 'reject' && method === 'PATCH') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		if (!Number.isInteger(Number(inviteId))) {
			return Response.json({ error: 'Invalid invite ID' }, { status: 400 });
		}

		const invite = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();

		if (!invite) {
			return Response.json({ error: 'Invite not found' }, { status: 404 });
		}

		if (invite.invited_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}

		if (invite.status !== 'pending') {
			return Response.json({ error: 'Invite already handled' }, { status: 409 });
		}

		await env.DB.prepare("UPDATE invites SET status = 'declined' WHERE id = ?").bind(inviteId).run();

		return Response.json({
			success: true,
			message: 'Invite declined',
		});
	}

	// DELETE /invites/:id
	if (url.pathname.startsWith('/invites/') && method === 'DELETE') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

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
		const body = await request.json();

		return createInvite(env, auth.userId, teamId, body.invited_user_id);
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}

/**
 * Creates or reactivates an invite.
 * @param {Env} env - Worker environment.
 * @param {number} inviterUserId - Authenticated inviter user ID.
 * @param {number|string} teamId - Team ID.
 * @param {number|string} invitedUserId - Invited user ID.
 * @returns {Promise<Response>}
 */
async function createInvite(env, inviterUserId, teamId, invitedUserId) {
	if (!teamId || !invitedUserId || !Number.isInteger(Number(teamId)) || !Number.isInteger(Number(invitedUserId))) {
		return Response.json({ error: 'Invalid team_id or invited_user_id' }, { status: 400 });
	}

	if (Number(invitedUserId) === Number(inviterUserId)) {
		return Response.json({ error: 'Cannot invite yourself' }, { status: 400 });
	}

	const adminCheck = await requireTeamAdmin(env, inviterUserId, Number(teamId));
	if (adminCheck.error) return adminCheck.error;

	const existingMember = await env.DB.prepare(
		`
			SELECT *
			FROM team_members
			WHERE team_id = ? AND user_id = ?
		`,
	)
		.bind(teamId, invitedUserId)
		.first();

	if (existingMember) {
		return Response.json({ error: 'User already in team' }, { status: 409 });
	}

	const existingInvite = await env.DB.prepare(
		`
			SELECT *
			FROM invites
			WHERE team_id = ?
			AND inviter_user_id = ?
			AND invited_user_id = ?
		`,
	)
		.bind(teamId, inviterUserId, invitedUserId)
		.first();

	const now = new Date().toISOString();

	if (existingInvite) {
		if (existingInvite.status === 'pending') {
			return Response.json({ error: 'Pending invite already exists' }, { status: 409 });
		}

		const { success } = await env.DB.prepare(
			`
				UPDATE invites
				SET status = 'pending', created_at = ?
				WHERE id = ?
			`,
		)
			.bind(now, existingInvite.id)
			.run();

		return Response.json(
			{
				success,
				invite_id: existingInvite.id,
				message: 'Invite resent',
			},
			{ status: 200 },
		);
	}

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
		.bind(teamId, inviterUserId, invitedUserId, 'pending', now)
		.run();

	return Response.json(
		{
			success: true,
			invite_id: result.meta.last_row_id,
		},
		{ status: 201 },
	);
}
