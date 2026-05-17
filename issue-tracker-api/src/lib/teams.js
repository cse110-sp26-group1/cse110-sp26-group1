/** @typedef {'admin' | 'member'} TeamRole */

/**
 * Valid values for `team_members.role`, matches schema.sql
 * @type {readonly TeamRole[]}
 */
export const ALLOWED_ROLES = ['admin', 'member'];

/**
 * Validates and normalizes a role string for inserts (e.g. invite accept).
 * @param {string | undefined} role - Role from request body; omitted uses default.
 * @param {TeamRole} [defaultRole='member'] - Used when `role` is undefined.
 * @returns {{ role: TeamRole } | { error: Response }}
 */
export function validateRole(role, defaultRole = 'member') {
	const r = role ?? defaultRole;
	if (!ALLOWED_ROLES.includes(r)) {
		return {
			error: Response.json(
				{
					error: `Invalid role. Must be one of: ${ALLOWED_ROLES.join(', ')}`,
				},
				{ status: 400 },
			),
		};
	}
	return { role: r };
}

/**
 * Ensures `userId` belongs to `teamId`. Use after `requireAuth`.
 * @param {{ DB: D1Database }} env - Worker env (`env.DB` from index.js).
 * @param {number} userId - Authenticated user id from `requireAuth`.
 * @param {number} teamId - Team scope for the operation.
 * @returns {Promise<{ role: TeamRole } | { error: Response }>}
 */
export async function requireTeamMember(env, userId, teamId) {
	const row = await env.DB.prepare('SELECT role FROM team_members WHERE user_id = ? AND team_id = ?').bind(userId, teamId).first();

	if (!row) {
		return {
			error: Response.json({ error: 'Forbidden' }, { status: 403 }),
		};
	}
	return { role: row.role };
}

/**
 * Ensures `userId` is an **admin** of `teamId`. Use for invites, team delete, remove member.
 * @param {{ DB: D1Database }} env
 * @param {number} userId
 * @param {number} teamId
 * @returns {Promise<{ role: 'admin' } | { error: Response }>}
 */
export async function requireTeamAdmin(env, userId, teamId) {
	const membership = await requireTeamMember(env, userId, teamId);
	if (membership.error) return membership;
	if (membership.role !== 'admin') {
		return {
			error: Response.json({ error: 'Forbidden' }, { status: 403 }),
		};
	}
	return { role: 'admin' };
}
