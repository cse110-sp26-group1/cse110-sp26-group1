import { requireAuth } from '../src/lib/auth.js';
import { requireTeamAdmin } from '../src/lib/teams.js';
// test comment to push

/**
 * Handles all /invites routes: GET (list by user), POST (create), PATCH accept/reject, DELETE.
 * @param {Request} request - The incoming Worker request.
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @returns {Promise<Response>}
 *   200 — invites list (GET), accept/reject result (PATCH), delete result (DELETE)
 *   201 — invite created (POST)
 *   400 — missing or invalid query/body fields or invite id
 *   403 — not team admin (POST/DELETE) or not the invited user (PATCH accept/reject)
 *   404 — invite not found or route not matched
 *   409 — user already on team, duplicate pending invite, or invite already handled
 */
export async function handleInvites(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const inviteId = pathParts[2];

	// GET /invites — pending invites for logged-in user
	if (method === 'GET' && !inviteId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const { results } = await env.DB.prepare(
			`
				SELECT invites.*, teams.team_name FROM invites
				JOIN teams ON invites.team_id = teams.id
				WHERE invites.invited_user_id = ?
			`,
		)
			.bind(auth.userId)
			.all();

		return Response.json(results);
	}

	// POST /invites — admin only; invited_username in body
	if (method === 'POST' && !inviteId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();
		if (!body.team_id || !body.invited_username) {
			return Response.json({ error: 'team_id and invited_username are required' }, { status: 400 });
		}

		const parsedTeamId = Number(body.team_id);
		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'team_id must be a positive integer' }, { status: 400 });
		}

		const admin = await requireTeamAdmin(env, auth.userId, parsedTeamId);
		if (admin.error) return admin.error;

		const invited = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(body.invited_username.trim()).first();
		if (!invited) {
			return Response.json({ error: 'User not found' }, { status: 404 });
		}

		const existingMember = await env.DB.prepare(
			`
				SELECT *
				FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
		)
			.bind(parsedTeamId, invited.id)
			.first();

		if (existingMember) {
			return Response.json({ error: 'User is already a team member' }, { status: 409 });
		}

		const existingInvite = await env.DB.prepare(
			`
				SELECT *
				FROM invites
				WHERE team_id = ? AND invited_user_id = ? AND status = 'pending'
			`,
		)
			.bind(parsedTeamId, invited.id)
			.first();

		if (existingInvite) {
			return Response.json({ error: 'Pending invite already exists' }, { status: 409 });
		}

		const now = new Date().toISOString();

		const result = await env.DB.prepare(
			`
				INSERT INTO invites (team_id, inviter_user_id, invited_user_id, status, created_at)
				VALUES (?, ?, ?, 'pending', ?)
			`,
		)
			.bind(parsedTeamId, auth.userId, invited.id, now)
			.run();

		return Response.json(
			{
				success: true,
				invite_id: result.meta.last_row_id,
			},
			{ status: 201 },
		);
	}

	// PATCH /invites/:id/accept — invitee only; join as member
	if (method === 'PATCH' && inviteId && pathParts[3] === 'accept') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const invite = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();
		if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 });
		if (invite.invited_user_id !== auth.userId) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}
		if (invite.status !== 'pending') {
			return Response.json({ error: 'Invite already handled' }, { status: 409 });
		}

		await env.DB.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").bind(inviteId).run();
		await env.DB.prepare('INSERT INTO team_members (user_id, team_id, role) VALUES (?, ?, ?)')
			.bind(auth.userId, invite.team_id, 'member')
			.run();

		return Response.json({ success: true, message: 'Invite accepted' });
	}

	// PATCH /invites/:id/reject — invitee only
	if (method === 'PATCH' && inviteId && pathParts[3] === 'reject') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

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

		const { success } = await env.DB.prepare("UPDATE invites SET status = 'declined' WHERE id = ?").bind(inviteId).run();

		return Response.json({
			success,
			message: 'Invite declined',
		});
	}

	// DELETE /invites/:id — team admin only
	if (method === 'DELETE' && inviteId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const invite = await env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();
		if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 });

		const admin = await requireTeamAdmin(env, auth.userId, invite.team_id);
		if (admin.error) return admin.error;

		await env.DB.prepare('DELETE FROM invites WHERE id = ?').bind(inviteId).run();
		return Response.json({ success: true });
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
