import { requireAuth } from '../src/lib/auth.js';
import { createInvite, resolveInvitedUserId } from '../src/lib/invites.js';
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
 * TODO: add all comments necessary for understanding in docs file
 *
 * Endpoints:
 * GET    /invites
 * GET    /invites/:id
 * POST   /invites
 * PATCH  /invites/:id/accept
 * PATCH  /invites/:id/reject
 * DELETE /invites/:id
 *
 * @param {Request} request - Incoming HTTP request.
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
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
	// Also supports the admin/settings use case where a team admin opens one invite
	// before deciding whether to cancel it.
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

		// If the invite does not exist, stop here.
		if (!invite) {
			return Response.json({ error: 'Invite not found' }, { status: 404 });
		}

		// Check whether this user can manage the invite as the inviter or a team admin.
		const canManage = await canManageInvite(env, auth.userId, invite);

		// Allow access if the user:
		// 1. can manage the invite (admin),
		// 2. is the invited user,
		// 3. or is the inviter.
		if (!canManage && invite.invited_user_id !== auth.userId && invite.inviter_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}

		return Response.json(invite);
	}

	// POST /invites
	// Creates an invite using team_id and invited_user_id from the body.
	// The inviter is always auth.userId, so users cannot spoof who sent it.
	// This is the generic route for when the frontend is not already scoped to
	// a specific team page, currently unused
	if (url.pathname === '/invites' && method === 'POST') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();
		const resolved = await resolveInvitedUserId(env, body);
		if (resolved.error) return resolved.error;

		return createInvite(env, auth.userId, body.team_id, resolved.invitedUserId);
	}

	// PATCH /invites/:id/accept
	// Accepts a pending invite and adds the invited user to team_members.
	// Only the invited user can accept their own invite.
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
		// This protects against stale invites or race conditions where membership
		// was added some other way after the invite was sent.
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

		// Perform both actions together:
		// 1. add the user to the team
		// 2. mark the invite as accepted
		// This is safer than updating the invite first
		// and inserting membership later, and makes performance better.
		await env.DB.batch([
			env.DB.prepare(
				`
                    INSERT INTO team_members (team_id, user_id, role)
                    VALUES (?, ?, ?)
                `,
			).bind(invite.team_id, invite.invited_user_id, 'member'),
			env.DB.prepare(
				`
                    UPDATE invites
                    SET status = 'accepted'
                    WHERE id = ?
                `,
			).bind(inviteId),
		]);

		return Response.json({
			success: true,
			message: 'Invite accepted',
		});
	}

	// PATCH /invites/:id/reject
	// Declines a pending invite by changing status to declined.
	// Only the invited user can reject their own invite.
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
	// This supports cases like:
	// - the inviter canceling an invite they sent
	// - the invited user removing an invite from their side
	// - a team admin canceling an invite from settings/admin UI
	if (url.pathname.startsWith('/invites/') && method === 'DELETE') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		if (!Number.isInteger(Number(inviteId))) {
			return Response.json({ error: 'Invalid invite ID' }, { status: 400 });
		}

		const invite = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();

		if (!invite) {
			return Response.json({ error: 'Invite not found' }, { status: 404 });
		}

		// Check whether this user can manage the invite as the inviter or a team admin.
		const canManage = await canManageInvite(env, auth.userId, invite);

		// Allow delete if the user:
		// 1. can manage the invite,
		// 2. is the invited user,
		// 3. or is the inviter.
		if (!canManage && invite.invited_user_id !== auth.userId && invite.inviter_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
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

	return Response.json({ error: 'Not Found' }, { status: 404 });
}

/**
 * Returns whether a user can manage an invite as either:
 * 1. the original inviter
 * 2. or a team admin for that invite's team
 *
 * This is used for routes like GET /invites/:id and DELETE /invites/:id
 * where admins may need access even if they were not the original sender.
 *
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @param {number} userId - Logged-in user ID.
 * @param {{ inviter_user_id: number, team_id: number }} invite - Invite row.
 * @returns {Promise<boolean>} True if the user can manage the invite.
 */
async function canManageInvite(env, userId, invite) {
	// The original sender can manage their own invite.
	if (invite.inviter_user_id === userId) return true;

	// Otherwise, allow team admins to manage it.
	const adminCheck = await requireTeamAdmin(env, userId, Number(invite.team_id));
	return !adminCheck.error;
}
