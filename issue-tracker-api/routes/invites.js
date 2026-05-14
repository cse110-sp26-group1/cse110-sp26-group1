/**
 * Handle invite-related API endpoints.
 *
 * Supported endpoints:
 * - GET /invites?user_id=X
 *   Fetches invites for a specific invited user.
 *
 * - POST /invites
 *   Creates a pending invite from one existing team member to another user.
 *
 * - PATCH /invites/:id/accept
 *   Accepts a pending invite, updates invite status, and adds the invited user
 *   to the team_members table.
 *
 * - PATCH /invites/:id/reject
 *   Declines a pending invite and updates invite status.
 *
 * - DELETE /invites/:id
 *   Deletes an invite by id.
 *
 * @param {Request} request Incoming HTTP request.
 * @param {Env} env Cloudflare Worker environment with D1 database binding.
 */
export async function handleInvites(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');
	const inviteId = pathParts[2];

	// GET /invites?user_id=X
	if (method === 'GET' && !inviteId) {
		const userId = url.searchParams.get('user_id');

		if (!userId) {
			return Response.json({ error: 'user_id query param required' }, { status: 400 });
		}

		if (Number.isNaN(Number(userId))) {
			return Response.json({ error: 'user_id must be a number' }, { status: 400 });
		}

		const { results } = await env.issue_tracker_db
			.prepare(
				`
				SELECT invites.*, teams.team_name
				FROM invites
				JOIN teams
				ON invites.team_id = teams.id
				WHERE invites.invited_user_id = ?
			`,
			)
			.bind(userId)
			.all();

		return Response.json(results);
	}

	// POST /invites
	if (method === 'POST' && !inviteId) {
		const body = await request.json();

		if (!body.team_id || !body.inviter_user_id || !body.invited_user_id) {
			return Response.json({ error: 'Missing required fields' }, { status: 400 });
		}

		if (Number.isNaN(Number(body.team_id)) || Number.isNaN(Number(body.inviter_user_id)) || Number.isNaN(Number(body.invited_user_id))) {
			return Response.json({ error: 'team_id, inviter_user_id, and invited_user_id must be numbers' }, { status: 400 });
		}

		const inviterMembership = await env.issue_tracker_db
			.prepare(
				`
				SELECT *
				FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
			)
			.bind(body.team_id, body.inviter_user_id)
			.first();

		if (!inviterMembership) {
			return Response.json({ error: 'Inviter is not a member of this team' }, { status: 403 });
		}

		const existingMember = await env.issue_tracker_db
			.prepare(
				`
				SELECT *
				FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
			)
			.bind(body.team_id, body.invited_user_id)
			.first();

		if (existingMember) {
			return Response.json({ error: 'User is already a team member' }, { status: 409 });
		}

		const existingInvite = await env.issue_tracker_db
			.prepare(
				`
				SELECT *
				FROM invites
				WHERE team_id = ? AND invited_user_id = ? AND status = 'pending'
			`,
			)
			.bind(body.team_id, body.invited_user_id)
			.first();

		if (existingInvite) {
			return Response.json({ error: 'Pending invite already exists' }, { status: 409 });
		}

		const now = new Date().toISOString();

		const result = await env.issue_tracker_db
			.prepare(
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
			.bind(body.team_id, body.inviter_user_id, body.invited_user_id, 'pending', now)
			.run();

		return Response.json(
			{
				success: true,
				invite_id: result.meta.last_row_id,
			},
			{ status: 201 },
		);
	}

	// PATCH /invites/:id/accept
	if (method === 'PATCH' && inviteId && pathParts[3] === 'accept') {
		if (Number.isNaN(Number(inviteId))) {
			return Response.json({ error: 'invite id must be a number' }, { status: 400 });
		}

		const invite = await env.issue_tracker_db.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();

		if (!invite) {
			return Response.json({ error: 'Invite not found' }, { status: 404 });
		}

		if (invite.status !== 'pending') {
			return Response.json({ error: 'Invite already handled' }, { status: 409 });
		}

		await env.issue_tracker_db.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").bind(inviteId).run();

		const { success } = await env.issue_tracker_db
			.prepare(
				`
				INSERT INTO team_members (user_id, team_id, role)
				VALUES (?, ?, ?)
			`,
			)
			.bind(invite.invited_user_id, invite.team_id, 'dev')
			.run();

		return Response.json({
			success,
			message: 'Invite accepted',
		});
	}

	// PATCH /invites/:id/reject
	if (method === 'PATCH' && inviteId && pathParts[3] === 'reject') {
		if (Number.isNaN(Number(inviteId))) {
			return Response.json({ error: 'invite id must be a number' }, { status: 400 });
		}

		const invite = await env.issue_tracker_db.prepare('SELECT * FROM invites WHERE id = ?').bind(inviteId).first();

		if (!invite) {
			return Response.json({ error: 'Invite not found' }, { status: 404 });
		}

		if (invite.status !== 'pending') {
			return Response.json({ error: 'Invite already handled' }, { status: 409 });
		}

		const { success } = await env.issue_tracker_db.prepare("UPDATE invites SET status = 'declined' WHERE id = ?").bind(inviteId).run();

		return Response.json({
			success,
			message: 'Invite declined',
		});
	}

	// DELETE /invites/:id
	if (method === 'DELETE' && inviteId) {
		if (Number.isNaN(Number(inviteId))) {
			return Response.json({ error: 'invite id must be a number' }, { status: 400 });
		}

		const { success } = await env.issue_tracker_db.prepare('DELETE FROM invites WHERE id = ?').bind(inviteId).run();

		return Response.json({ success });
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
