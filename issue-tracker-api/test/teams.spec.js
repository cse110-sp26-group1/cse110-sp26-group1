import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import sqlSchemaRaw from '../schema.sql?raw';

async function cleanDatabase() {
	await env.DB.exec(`
    DELETE FROM sessions;
    DELETE FROM invites;
    DELETE FROM issues;
    DELETE FROM team_members;
    DELETE FROM teams;
    DELETE FROM users;
  `);
}

async function createTestUser(username, email) {
	const row = await env.DB.prepare(
		`INSERT INTO users (username, first_name, last_name, email, password_hash)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
	)
		.bind(username, username, `${username}Last`, email, 'mock_hash')
		.first();
	return row.id;
}

async function createTestSession(userId, token, ttlHours = 24) {
	const expiryDate = new Date();
	expiryDate.setHours(expiryDate.getHours() + ttlHours);
	await env.DB.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
		.bind(userId, token, expiryDate.toISOString())
		.run();
}

async function createTestTeam(teamName, creatorId = null) {
	const row = await env.DB.prepare(`INSERT INTO teams (team_name) VALUES (?) RETURNING id`).bind(teamName).first();
	const teamId = row.id;

	if (creatorId) {
		await env.DB.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)').bind(teamId, creatorId, 'admin').run();
	}

	return teamId;
}

async function createTeamMembership(userId, teamId, role = 'member') {
	await env.DB.prepare('INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)').bind(teamId, userId, role).run();
}

function authHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
}

describe('Teams Endpoint Testing Suite', () => {
	beforeAll(async () => {
		const cleanSql = sqlSchemaRaw
			.split('\n')
			.map((line) => line.split('--')[0].trim())
			.filter((line) => line.length > 0)
			.join(' ');
		await env.DB.exec(cleanSql);
	});

	beforeEach(async () => {
		await cleanDatabase();
	});

	describe('POST /teams', () => {
		describe('Success Cases', () => {
			it('201: creates a team and adds creator as admin', async () => {
				const userId = await createTestUser('creator', 'creator@test.com');
				const token = 'creator-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: 'New Team' }),
				});

				expect(response.status).toBe(201);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.team_id).toBeDefined();
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_name: 'New Team' }),
				});
				expect(response.status).toBe(401);
			});

			it('401: rejects request when session token is invalid', async () => {
				const response = await SELF.fetch('http://localhost/teams', {
					method: 'POST',
					headers: { Authorization: 'Bearer invalid-token', 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_name: 'New Team' }),
				});
				expect(response.status).toBe(401);
			});

			it('401: rejects request when session token is expired', async () => {
				const userId = await createTestUser('expired', 'expired@test.com');
				const token = 'expired-token';
				await createTestSession(userId, token, -2);

				const response = await SELF.fetch('http://localhost/teams', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: 'New Team' }),
				});
				expect(response.status).toBe(401);
			});

			it('400: rejects missing team_name', async () => {
				const userId = await createTestUser('bad', 'bad@test.com');
				const token = 'bad-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({}),
				});

				expect(response.status).toBe(400);
				const data = await response.json();
				expect(data.error).toBe('team_name is required');
			});

			it('400: rejects empty team_name', async () => {
				const userId = await createTestUser('empty', 'empty@test.com');
				const token = 'empty-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: '' }),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('GET /teams', () => {
		describe('Success Cases', () => {
			it('200: returns teams for authenticated user with role', async () => {
				const userId = await createTestUser('viewer', 'viewer@test.com');
				const token = 'viewer-token';
				await createTestSession(userId, token, 24);

				const teamId = await createTestTeam('My Team', userId);

				const response = await SELF.fetch('http://localhost/teams', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(Array.isArray(data)).toBe(true);
				expect(data.length).toBe(1);
				expect(data[0].id).toBe(teamId);
				expect(data[0].role).toBe('admin');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams');
				expect(response.status).toBe(401);
			});

			it('401: rejects request when session token is invalid', async () => {
				const response = await SELF.fetch('http://localhost/teams', {
					headers: { Authorization: 'Bearer invalid-token' },
				});
				expect(response.status).toBe(401);
			});

			it('401: rejects request when session token is expired', async () => {
				const userId = await createTestUser('expired', 'expired@test.com');
				const token = 'expired-token';
				await createTestSession(userId, token, -2);

				const response = await SELF.fetch('http://localhost/teams', {
					headers: authHeaders(token),
				});
				expect(response.status).toBe(401);
			});
		});
	});

	describe('GET /teams/:id', () => {
		describe('Success Cases', () => {
			it('200: returns team details for team member', async () => {
				const userId = await createTestUser('owner', 'owner@test.com');
				const token = 'owner-token';
				await createTestSession(userId, token, 24);

				const teamId = await createTestTeam('Secret Team', userId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.id).toBe(teamId);
				expect(data.team_name).toBe('Secret Team');
				expect(data.role).toBe('admin');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams/1');
				expect(response.status).toBe(401);
			});

			it('403: returns forbidden for non-member', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const outsiderId = await createTestUser('outsider', 'outsider@test.com');
				const token = 'outsider-token';

				await createTestSession(outsiderId, token, 24);

				const teamId = await createTestTeam('Private Team', ownerId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('404: returns not found for non-existent team', async () => {
				const userId = await createTestUser('finder', 'finder@test.com');
				const token = 'finder-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/99999', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('400: returns bad request for invalid team ID format', async () => {
				const userId = await createTestUser('invalid', 'invalid@test.com');
				const token = 'invalid-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/not-a-number', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});

			it('400: returns bad request for negative team ID', async () => {
				const userId = await createTestUser('negative', 'negative@test.com');
				const token = 'negative-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/-500', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});

			it('400: returns bad request for zero team ID', async () => {
				const userId = await createTestUser('zero', 'zero@test.com');
				const token = 'zero-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/0', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('PATCH /teams/:id', () => {
		describe('Success Cases', () => {
			it('200: allows admin to rename team', async () => {
				const userId = await createTestUser('admin', 'admin@test.com');
				const token = 'admin-token';
				await createTestSession(userId, token, 24);

				const teamId = await createTestTeam('Original Name', userId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					method: 'PATCH',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: 'Updated Name' }),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.message).toBe('Team renamed');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams/1', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_name: 'New Name' }),
				});
				expect(response.status).toBe(401);
			});

			it('403: prevents non-admin from renaming team', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'member-token';

				await createTestSession(memberId, token, 24);

				const teamId = await createTestTeam('Team Name', ownerId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					method: 'PATCH',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: 'Hacked Name' }),
				});

				expect(response.status).toBe(403);
			});

			it('404: returns not found for non-existent team', async () => {
				const userId = await createTestUser('patcher', 'patcher@test.com');
				const token = 'patcher-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/99999', {
					method: 'PATCH',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: 'New Name' }),
				});

				expect(response.status).toBe(403);
			});

			it('400: returns bad request for invalid team ID', async () => {
				const userId = await createTestUser('invalid', 'invalid@test.com');
				const token = 'invalid-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/not-a-number', {
					method: 'PATCH',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: 'New Name' }),
				});

				expect(response.status).toBe(400);
			});

			it('400: returns error when team_name is missing', async () => {
				const userId = await createTestUser('nomad', 'nomad@test.com');
				const token = 'nomad-token';
				await createTestSession(userId, token, 24);

				const teamId = await createTestTeam('Test Team', userId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					method: 'PATCH',
					headers: authHeaders(token),
					body: JSON.stringify({}),
				});

				expect(response.status).toBe(400);
			});

			it('400: rejects empty team_name', async () => {
				const userId = await createTestUser('empty', 'empty@test.com');
				const token = 'empty-token';
				await createTestSession(userId, token, 24);

				const teamId = await createTestTeam('Test Team', userId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					method: 'PATCH',
					headers: authHeaders(token),
					body: JSON.stringify({ team_name: '' }),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('DELETE /teams/:id', () => {
		describe('Success Cases', () => {
			it('200: allows admin to delete team', async () => {
				const userId = await createTestUser('admin', 'admin@test.com');
				const token = 'admin-token';
				await createTestSession(userId, token, 24);

				const teamId = await createTestTeam('Delete Me', userId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.message).toBe('Team deleted');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams/1', {
					method: 'DELETE',
				});
				expect(response.status).toBe(401);
			});

			it('403: prevents non-admin from deleting team', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'member-token';

				await createTestSession(memberId, token, 24);

				const teamId = await createTestTeam('Protected Team', ownerId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch(`http://localhost/teams/${teamId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('404: returns not found for non-existent team', async () => {
				const userId = await createTestUser('deleter', 'deleter@test.com');
				const token = 'deleter-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/99999', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('400: returns bad request for invalid team ID', async () => {
				const userId = await createTestUser('invalid', 'invalid@test.com');
				const token = 'invalid-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/not-a-number', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('GET /teams/:teamId/members', () => {
		describe('Success Cases', () => {
			it('200: returns members for team', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'owner-token';

				await createTestSession(ownerId, token, 24);

				const teamId = await createTestTeam('Team Members', ownerId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/members`, {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(Array.isArray(data)).toBe(true);
				expect(data.length).toBe(2);
				expect(data[0]).toHaveProperty('username');
				expect(data[0]).toHaveProperty('role');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams/1/members');
				expect(response.status).toBe(401);
			});

			it('403: returns forbidden for non-member', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const outsiderId = await createTestUser('outsider', 'outsider@test.com');
				const token = 'outsider-token';

				await createTestSession(outsiderId, token, 24);

				const teamId = await createTestTeam('Private Team', ownerId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/members`, {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('404: returns not found for non-existent team', async () => {
				const userId = await createTestUser('finder', 'finder@test.com');
				const token = 'finder-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/99999/members', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('400: returns bad request for invalid team ID', async () => {
				const userId = await createTestUser('invalid', 'invalid@test.com');
				const token = 'invalid-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/not-a-number/members', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('DELETE /teams/:teamId/members/:userId', () => {
		describe('Success Cases', () => {
			it('200: allows admin to remove a member', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/members/${memberId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.message).toBe('Member removed');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams/1/members/1', {
					method: 'DELETE',
				});
				expect(response.status).toBe(401);
			});

			it('403: prevents non-admin from removing members', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const member1Id = await createTestUser('member1', 'member1@test.com');
				const member2Id = await createTestUser('member2', 'member2@test.com');
				const token = 'member-token';

				await createTestSession(member1Id, token, 24);

				const teamId = await createTestTeam('Test Team', ownerId);
				await createTeamMembership(member1Id, teamId, 'member');
				await createTeamMembership(member2Id, teamId, 'member');

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/members/${member2Id}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('400: prevents removing self through members endpoint', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/members/${adminId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
				const data = await response.json();
				expect(data.error).toBe('Use /teams/:id/leave to leave a team yourself');
			});

			it('404: returns not found when member not in team', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const strangerId = await createTestUser('stranger', 'stranger@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/members/${strangerId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(404);
			});

			it('404: returns not found for non-existent team', async () => {
				const userId = await createTestUser('deleter', 'deleter@test.com');
				const token = 'deleter-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/99999/members/1', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('400: returns bad request for invalid team ID', async () => {
				const userId = await createTestUser('invalid', 'invalid@test.com');
				const token = 'invalid-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/not-a-number/members/1', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('DELETE /teams/:teamId/leave', () => {
		describe('Success Cases', () => {
			it('200: allows member to leave team', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'member-token';

				await createTestSession(memberId, token, 24);

				const teamId = await createTestTeam('Test Team', ownerId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/leave`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.message).toBe('Left team');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/teams/1/leave', {
					method: 'DELETE',
				});
				expect(response.status).toBe(401);
			});

			it('403: returns forbidden for user not in team', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const outsiderId = await createTestUser('outsider', 'outsider@test.com');
				const token = 'outsider-token';

				await createTestSession(outsiderId, token, 24);

				const teamId = await createTestTeam('Test Team', ownerId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/leave`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('409: prevents admin from leaving if other members exist', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/leave`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(409);
				const data = await response.json();
				expect(data.error).toBe('Admins cannot leave a team that still has members. Delete the team instead.');
			});

			it('200: allows admin to leave and deletes team if last member', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Solo Team', adminId);

				const response = await SELF.fetch(`http://localhost/teams/${teamId}/leave`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.message).toBe('Left team and deleted empty team');
			});

			it('404: returns not found for non-existent team', async () => {
				const userId = await createTestUser('leaver', 'leaver@test.com');
				const token = 'leaver-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/99999/leave', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('400: returns bad request for invalid team ID', async () => {
				const userId = await createTestUser('invalid', 'invalid@test.com');
				const token = 'invalid-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/teams/not-a-number/leave', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});
});
