import { requireAuth } from '../src/lib/auth.js';
import { requireTeamAdmin, requireTeamMember } from '../src/lib/teams.js';

/**
 * Handles all /teams routes.
 *
 * Endpoints:
 * GET    /teams
 * GET    /teams/:teamId
 * POST   /teams
 * PATCH  /teams/:teamId
 * DELETE /teams/:teamId
 * GET    /teams/:teamId/members
 * DELETE /teams/:teamId/members/:userId
 * DELETE /teams/:teamId/leave
 *
 * @param {Request} request - Incoming Worker request.
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @returns {Promise<Response>}
 */
export async function handleTeams(request, env) {
	const url = new URL(request.url);
	const method = request.method;
	const pathParts = url.pathname.split('/');

	const teamId = pathParts[2];
	const subresource = pathParts[3];
	const memberUserId = pathParts[4];

	// GET /teams
	// Returns all teams the authenticated user belongs to.
	// Includes team_members.role so the frontend knows whether the user is an
	// admin or a normal member in each workspace.
	if (method === 'GET' && !teamId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const { results } = await env.DB.prepare(
			`
				SELECT teams.*, team_members.role
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

	// GET /teams/:teamId
	// Returns one team's basic details for a user who belongs to that team.
	// Useful when the UI opens a specific workspace and needs team metadata.
	if (method === 'GET' && teamId && !subresource) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const parsedTeamId = Number(teamId);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team ID format. Must be a positive integer.' }, { status: 400 });
		}

		const membership = await requireTeamMember(env, auth.userId, parsedTeamId);
		if (membership.error) return membership.error;

		const team = await env.DB.prepare(
			`
				SELECT teams.*, team_members.role
				FROM teams
				JOIN team_members
				ON teams.id = team_members.team_id
				WHERE teams.id = ? AND team_members.user_id = ?
			`,
		)
			.bind(parsedTeamId, auth.userId)
			.first();

		if (!team) {
			return Response.json({ error: 'Team not found' }, { status: 404 });
		}

		return Response.json(team);
	}

	// POST /teams
	// Creates a new team and adds the authenticated user as its first admin.
	// Duplicate team names are allowed for now.
	if (method === 'POST' && !teamId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const body = await request.json();

		if (!body.team_name || typeof body.team_name !== 'string' || body.team_name.trim() === '') {
			return Response.json({ error: 'team_name is required' }, { status: 400 });
		}

		const now = new Date().toISOString();

		// Create the team first.
		const result = await env.DB.prepare(
			`
				INSERT INTO teams (team_name, created_at)
				VALUES (?, ?)
			`,
		)
			.bind(body.team_name.trim(), now)
			.run();

		const newTeamId = result.meta.last_row_id;

		// Then add the creator as admin of that team.
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

	// PATCH /teams/:teamId
	// Renames a team.
	// Only a team admin may rename the team.
	if (method === 'PATCH' && teamId && !subresource) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const parsedTeamId = Number(teamId);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team ID format. Must be a positive integer.' }, { status: 400 });
		}

		const body = await request.json();

		if (!body.team_name || typeof body.team_name !== 'string' || body.team_name.trim() === '') {
			return Response.json({ error: 'team_name is required' }, { status: 400 });
		}

		const adminCheck = await requireTeamAdmin(env, auth.userId, parsedTeamId);
		if (adminCheck.error) return adminCheck.error;

		const existingTeam = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(parsedTeamId).first();

		if (!existingTeam) {
			return Response.json({ error: 'Team not found' }, { status: 404 });
		}

		await env.DB.prepare(
			`
				UPDATE teams
				SET team_name = ?
				WHERE id = ?
			`,
		)
			.bind(body.team_name.trim(), parsedTeamId)
			.run();

		return Response.json({
			success: true,
			message: 'Team renamed',
		});
	}

	// DELETE /teams/:teamId
	// Deletes an entire team.
	// Only a team admin may delete the team.
	if (method === 'DELETE' && teamId && !subresource) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const parsedTeamId = Number(teamId);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team ID format. Must be a positive integer.' }, { status: 400 });
		}

		const adminCheck = await requireTeamAdmin(env, auth.userId, parsedTeamId);
		if (adminCheck.error) return adminCheck.error;

		const existingTeam = await env.DB.prepare('SELECT id FROM teams WHERE id = ?').bind(parsedTeamId).first();

		if (!existingTeam) {
			return Response.json({ error: 'Team not found' }, { status: 404 });
		}

		// Deleting the team should cascade to related membership rows because
		// team_members.team_id references teams(id) ON DELETE CASCADE.
		await env.DB.prepare(
			`
				DELETE FROM teams
				WHERE id = ?
			`,
		)
			.bind(parsedTeamId)
			.run();

		return Response.json({
			success: true,
			message: 'Team deleted',
		});
	}

	// GET /teams/:teamId/members
	// Returns members for a team if the authenticated user belongs to that team.
	if (method === 'GET' && teamId && subresource === 'members' && !memberUserId) {
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

	// DELETE /teams/:teamId/members/:userId
	// Removes a member from the team.
	// Only a team admin may remove members.
	if (method === 'DELETE' && teamId && subresource === 'members' && memberUserId) {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const parsedTeamId = Number(teamId);
		const parsedUserId = Number(memberUserId);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team ID format. Must be a positive integer.' }, { status: 400 });
		}

		if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
			return Response.json({ error: 'Invalid user ID format. Must be a positive integer.' }, { status: 400 });
		}

		const adminCheck = await requireTeamAdmin(env, auth.userId, parsedTeamId);
		if (adminCheck.error) return adminCheck.error;

		const targetMembership = await env.DB.prepare(
			`
				SELECT role
				FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
		)
			.bind(parsedTeamId, parsedUserId)
			.first();

		if (!targetMembership) {
			return Response.json({ error: 'Member not found in team' }, { status: 404 });
		}

		// Prevent an admin from removing themselves through the admin-remove route.
		// Self-removal should go through /leave so the special admin-leave rules are enforced.
		if (parsedUserId === auth.userId) {
			return Response.json({ error: 'Use /teams/:id/leave to leave a team yourself' }, { status: 400 });
		}

		await env.DB.prepare(
			`
				DELETE FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
		)
			.bind(parsedTeamId, parsedUserId)
			.run();

		return Response.json({
			success: true,
			message: 'Member removed',
		});
	}

	// DELETE /teams/:teamId/leave
	// Lets the authenticated user leave a team they belong to.
	// Special rule:
	// - if the user is an admin and other members still exist, deny with 409
	// - if the user is the last member/admin, allow leaving by deleting the team
	if (method === 'DELETE' && teamId && subresource === 'leave') {
		const auth = await requireAuth(request, env);
		if (auth.error) return auth.error;

		const parsedTeamId = Number(teamId);

		if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
			return Response.json({ error: 'Invalid team ID format. Must be a positive integer.' }, { status: 400 });
		}

		const membership = await env.DB.prepare(
			`
				SELECT role
				FROM team_members
				WHERE team_id = ? AND user_id = ?
			`,
		)
			.bind(parsedTeamId, auth.userId)
			.first();

		if (!membership) {
			return Response.json({ error: 'Forbidden' }, { status: 403 });
		}

		const { results: members } = await env.DB.prepare(
			`
				SELECT user_id, role
				FROM team_members
				WHERE team_id = ?
			`,
		)
			.bind(parsedTeamId)
			.all();

		// Non-admin members can simply leave by removing their membership row.
		if (membership.role !== 'admin') {
			await env.DB.prepare(
				`
					DELETE FROM team_members
					WHERE team_id = ? AND user_id = ?
				`,
			)
				.bind(parsedTeamId, auth.userId)
				.run();

			return Response.json({
				success: true,
				message: 'Left team',
			});
		}

		// If this admin is not the last person in the team, do not allow them to
		// leave and strand the remaining members without admin handling.
		if (members.length > 1) {
			return Response.json(
				{
					error: 'Admins cannot leave a team that still has members. Delete the team instead.',
				},
				{ status: 409 },
			);
		}

		// If this admin is the last remaining member, leaving should also remove
		// the team itself.
		await env.DB.prepare(
			`
				DELETE FROM teams
				WHERE id = ?
			`,
		)
			.bind(parsedTeamId)
			.run();

		return Response.json({
			success: true,
			message: 'Left team and deleted empty team',
		});
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
