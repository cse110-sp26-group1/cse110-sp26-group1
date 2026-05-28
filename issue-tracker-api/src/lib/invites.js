import { requireTeamAdmin } from './teams.js';

/**
 * Resolves `invited_user_id` from a request body that may use id, username, or email
 * since front end sends EITHER username or email
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @param {{ invited_user_id?: number, username?: string, email?: string }} body - Invite recipient fields.
 * @returns {Promise<{ invitedUserId: number } | { error: Response }>}
 */
export async function resolveInvitedUserId(env, body) {
	let invitedUserId = body.invited_user_id;

	if (!invitedUserId) {
		if (!body.username && !body.email) {
			return {
				error: Response.json({ error: 'invited_user_id, username, or email is required' }, { status: 400 }),
			};
		}

		const lookup = body.username
			? await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(body.username.trim()).first()
			: await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(body.email.trim().toLowerCase()).first();

		if (!lookup) {
			return { error: Response.json({ error: 'User not found' }, { status: 404 }) };
		}

		invitedUserId = lookup.id;
	}

	return { invitedUserId };
}

/**
 * Creates or reactivates an invite.
 *
 * Shared by POST /invites and POST /teams/:teamId/invite so both routes use the same
 * validation and DB behavior.
 *
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @param {number} inviterUserId - Logged-in user sending the invite.
 * @param {number|string} teamId - Team ID.
 * @param {number|string} invitedUserId - User ID being invited.
 * @returns {Promise<Response>} JSON response.
 */
export async function createInvite(env, inviterUserId, teamId, invitedUserId) {
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
            AND invited_user_id = ?
            AND status = 'pending'
        `,
	)
		.bind(teamId, invitedUserId)
		.first();

	if (existingInvite) {
		return Response.json({ error: 'Pending invite already exists' }, { status: 409 });
	}

	const priorInvite = await env.DB.prepare(
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

	if (priorInvite) {
		const result = await env.DB.prepare(
			`
                UPDATE invites
                SET status = 'pending', created_at = ?
                WHERE id = ?
            `,
		)
			.bind(now, priorInvite.id)
			.run();

		return Response.json(
			{
				success: result.success,
				invite_id: priorInvite.id,
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
