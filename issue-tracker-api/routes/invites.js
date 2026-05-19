import { requireAuth } from '../src/lib/auth.js';
import { requireTeamAdmin } from '../src/lib/teams.js';

/**
 * Handles invite-related endpoints.
 *
 * This file controls invite creation, invite viewing, accepting/declining
 * invites, and deleting/canceling invites.
 *
 * All protected routes use requireAuth so we know which user is making
 * the request. Admin-only invite creation uses requireTeamAdmin.
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
 * @param {Request} request - Incoming HTTP request.
 * @param {Env} env - Cloudflare Worker environment with DB binding.
 * @returns {Promise<Response>} JSON response.
 */
export async function handleInvites(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const inviteId = pathParts[2];

	// GET /invites
	// Returns only pending invites for the logged-in user.
	// The join includes team_name and inviter_username so the frontend can show:
	// "@alex invited you to Backend Team."
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
	// Returns one invite with team and inviter details.
	// Used when a user clicks an invite notification and needs full info.
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

		// Only the invited user or inviter can view this invite.
		if (invite.invited_user_id !== auth.userId && invite.inviter_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}

		return Response.json(invite);
	}

	// POST /invites
	// Creates an invite using team_id and invited_user_id from the body.
	// The inviter is always auth.userId, so users cannot spoof who sent it.
	if (url.pathname === '/invites' && method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();

		return createInvite(env, auth.userId, body.team_id, body.invited_user_id);
	}

	// PATCH /invites/:id/accept
	// Accepts a pending invite and adds the invited user to team_members.
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

		// Only the invited user can accept their invite.
		if (invite.invited_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}

		if (invite.status !== 'pending') {
			return Response.json({ error: 'Invite already handled' }, { status: 409 });
		}

		// Extra guardrail: make sure user is not already in the team.
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
	// Declines a pending invite by changing status to declined.
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

		// Only the invited user can reject their invite.
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
	// Deletes/cancels an invite by ID.
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
	// Alternate invite route for when the frontend is already inside a team page.
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
 *
 * This helper is shared by POST /invites and POST /teams/:teamId/invite
 * so both routes use the same validation and DB behavior.
 *
 * @param {Env} env - Cloudflare Worker environment.
 * @param {number} inviterUserId - Logged-in user sending the invite.
 * @param {number|string} teamId - Team ID.
 * @param {number|string} invitedUserId - User ID being invited.
 * @returns {Promise<Response>} JSON response.
 */
async function createInvite(env, inviterUserId, teamId, invitedUserId) {
	// Validate IDs before doing DB work.
	if (!teamId || !invitedUserId || !Number.isInteger(Number(teamId)) || !Number.isInteger(Number(invitedUserId))) {
		return Response.json({ error: 'Invalid team_id or invited_user_id' }, { status: 400 });
	}

	// Users cannot invite themselves.
	if (Number(invitedUserId) === Number(inviterUserId)) {
		return Response.json({ error: 'Cannot invite yourself' }, { status: 400 });
	}

	// Only team admins can invite users.
	const adminCheck = await requireTeamAdmin(env, inviterUserId, Number(teamId));
	if (adminCheck.error) return adminCheck.error;

	// Do not invite users who are already members.
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

	// Look for any existing invite between the same inviter, invitee, and team.
	// This matters because schema uniqueness can block inserting a new row
	// if a declined invite already exists.
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
		// If the invite is still pending, do not create a duplicate.
		if (existingInvite.status === 'pending') {
			return Response.json({ error: 'Pending invite already exists' }, { status: 409 });
		}

		// If the invite was declined/handled before, reactivate it as pending.
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

	// No existing invite, so create a new pending invite.
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
