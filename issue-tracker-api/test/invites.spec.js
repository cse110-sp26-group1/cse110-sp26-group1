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

async function createTestInvite(teamId, inviterId, invitedId, status = 'pending') {
	const row = await env.DB.prepare(
		`INSERT INTO invites (team_id, inviter_user_id, invited_user_id, status, created_at)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
	)
		.bind(teamId, inviterId, invitedId, status, new Date().toISOString())
		.first();
	return row.id;
}

function authHeaders(token) {
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
}

describe('Invites Endpoint Testing Suite', () => {
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

	describe('GET /invites - RequireAuth & Access Verification', () => {
		describe('Success Cases', () => {
			it('200: returns pending invites for authenticated user with team and inviter info', async () => {
				const inviterId = await createTestUser('alex', 'alex@test.com');
				const inviteeId = await createTestUser('jamie', 'jamie@test.com');
				const token = 'valid-session-token';

				await createTestSession(inviteeId, token, 24);

				const teamId = await createTestTeam('Backend Team', inviterId);
				await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch('http://localhost/invites', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(Array.isArray(data)).toBe(true);
				expect(data.length).toBe(1);
				expect(data[0]).toHaveProperty('team_name');
				expect(data[0]).toHaveProperty('inviter_username');
				expect(data[0].status).toBe('pending');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects request when Authorization header is missing', async () => {
				const response = await SELF.fetch('http://localhost/invites');
				expect(response.status).toBe(401);
			});

			it('401: rejects request when session token is invalid', async () => {
				const response = await SELF.fetch('http://localhost/invites', {
					headers: { Authorization: 'Bearer invalid-token' },
				});
				expect(response.status).toBe(401);
			});

			it('401: rejects request when session token is expired', async () => {
				const userId = await createTestUser('expired', 'expired@test.com');
				const token = 'expired-session-token';
				await createTestSession(userId, token, -2);

				const response = await SELF.fetch('http://localhost/invites', {
					headers: authHeaders(token),
				});
				expect(response.status).toBe(401);
			});
		});
	});

	describe('GET /invites/:id', () => {
		describe('Success Cases', () => {
			it('200: returns invite details for the invited user', async () => {
				const inviterId = await createTestUser('alex', 'alex@test.com');
				const inviteeId = await createTestUser('jamie', 'jamie@test.com');
				const token = 'valid-token';

				await createTestSession(inviteeId, token, 24);

				const teamId = await createTestTeam('Backend Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}`, {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.id).toBe(inviteId);
				expect(data.team_name).toBe('Backend Team');
				expect(data.inviter_username).toBe('alex');
				expect(data.status).toBe('pending');
			});

			it('200: allows inviter to view the invite', async () => {
				const inviterId = await createTestUser('alex', 'alex@test.com');
				const inviteeId = await createTestUser('jamie', 'jamie@test.com');
				const token = 'inviter-token';

				await createTestSession(inviterId, token, 24);

				const teamId = await createTestTeam('Backend Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}`, {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
			});
		});

		describe('Failure Cases', () => {
			it('403: returns forbidden for user not involved with invite', async () => {
				const inviterId = await createTestUser('alex', 'alex@test.com');
				const inviteeId = await createTestUser('jamie', 'jamie@test.com');
				const outsiderId = await createTestUser('outsider', 'outsider@test.com');
				const token = 'outsider-token';

				await createTestSession(outsiderId, token, 24);

				const teamId = await createTestTeam('Backend Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}`, {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('404: returns not found for non-existent invite', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/99999', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(404);
			});

			it('400: returns bad request for invalid invite ID format', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/not-a-number', {
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('POST /invites', () => {
		describe('Success Cases', () => {
			it('201: creates pending invite when admin invites user', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId, invited_user_id: userId }),
				});

				expect(response.status).toBe(201);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.invite_id).toBeDefined();
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects unauthenticated request', async () => {
				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_id: 1, invited_user_id: 2 }),
				});
				expect(response.status).toBe(401);
			});

			it('400: rejects self-invite', async () => {
				const userId = await createTestUser('self', 'self@test.com');
				const token = 'self-token';

				await createTestSession(userId, token, 24);

				const teamId = await createTestTeam('Test Team', userId);

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId, invited_user_id: userId }),
				});

				expect(response.status).toBe(400);
				const data = await response.json();
				expect(data.error).toBe('Cannot invite yourself');
			});

			it('403: rejects if inviter is not admin', async () => {
				const ownerId = await createTestUser('owner', 'owner@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'member-token';

				await createTestSession(memberId, token, 24);

				const teamId = await createTestTeam('Test Team', ownerId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId, invited_user_id: 99999 }),
				});

				expect(response.status).toBe(403);
			});

			it('409: rejects inviting existing team member', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const memberId = await createTestUser('member', 'member@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);
				await createTeamMembership(memberId, teamId, 'member');

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId, invited_user_id: memberId }),
				});

				expect(response.status).toBe(409);
				const data = await response.json();
				expect(data.error).toBe('User already in team');
			});

			it('409: rejects duplicate pending invite', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);

				await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId, invited_user_id: userId }),
				});

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId, invited_user_id: userId }),
				});

				expect(response.status).toBe(409);
				const data = await response.json();
				expect(data.error).toBe('Pending invite already exists');
			});

			it('200: reactivates a declined invite', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);
				await createTestInvite(teamId, adminId, userId, 'declined');

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId, invited_user_id: userId }),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.message).toBe('Invite resent');
			});

			it('400: returns error when team_id is missing', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ invited_user_id: userId }),
				});

				expect(response.status).toBe(400);
			});

			it('400: returns error when invited_user_id is missing', async () => {
				const adminId = await createTestUser('admin', 'admin@test.com');
				const token = 'admin-token';

				await createTestSession(adminId, token, 24);

				const teamId = await createTestTeam('Test Team', adminId);

				const response = await SELF.fetch('http://localhost/invites', {
					method: 'POST',
					headers: authHeaders(token),
					body: JSON.stringify({ team_id: teamId }),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('PATCH /invites/:id/accept', () => {
		describe('Success Cases', () => {
			it('200: accepts invite and adds user to team', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const token = 'invitee-token';

				await createTestSession(inviteeId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}/accept`, {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.message).toBe('Invite accepted');
			});
		});

		describe('Failure Cases', () => {
			it('403: rejects accept if not the invited user', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const otherId = await createTestUser('other', 'other@test.com');
				const token = 'other-token';

				await createTestSession(otherId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}/accept`, {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('409: rejects accept if invite already handled', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const token = 'invitee-token';

				await createTestSession(inviteeId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'accepted');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}/accept`, {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(409);
			});

			it('404: returns not found when invite does not exist', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/99999/accept', {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(404);
			});

			it('400: returns bad request when invite ID is not a valid number', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/not-a-number/accept', {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('PATCH /invites/:id/reject', () => {
		describe('Success Cases', () => {
			it('200: declines invite without adding to team', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const token = 'invitee-token';

				await createTestSession(inviteeId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}/reject`, {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.message).toBe('Invite declined');
			});
		});

		describe('Failure Cases', () => {
			it('403: rejects decline if not the invited user', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const otherId = await createTestUser('other', 'other@test.com');
				const token = 'other-token';

				await createTestSession(otherId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}/reject`, {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('404: returns not found when invite does not exist', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/99999/reject', {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(404);
			});

			it('400: returns bad request when invite ID is not a valid number', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/not-a-number/reject', {
					method: 'PATCH',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});

	describe('DELETE /invites/:id', () => {
		describe('Success Cases', () => {
			it('200: allows inviter to delete invite', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const token = 'inviter-token';

				await createTestSession(inviterId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
			});

			it('200: allows invited user to delete invite', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const token = 'invitee-token';

				await createTestSession(inviteeId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(200);
			});
		});

		describe('Failure Cases', () => {
			it('403: returns forbidden for unauthorized user', async () => {
				const inviterId = await createTestUser('inviter', 'inviter@test.com');
				const inviteeId = await createTestUser('invitee', 'invitee@test.com');
				const outsiderId = await createTestUser('outsider', 'outsider@test.com');
				const token = 'outsider-token';

				await createTestSession(outsiderId, token, 24);

				const teamId = await createTestTeam('Test Team', inviterId);
				const inviteId = await createTestInvite(teamId, inviterId, inviteeId, 'pending');

				const response = await SELF.fetch(`http://localhost/invites/${inviteId}`, {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(403);
			});

			it('404: returns not found when invite does not exist', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/99999', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(404);
			});

			it('400: returns bad request when invite ID is not a valid number', async () => {
				const userId = await createTestUser('user', 'user@test.com');
				const token = 'user-token';
				await createTestSession(userId, token, 24);

				const response = await SELF.fetch('http://localhost/invites/not-a-number', {
					method: 'DELETE',
					headers: authHeaders(token),
				});

				expect(response.status).toBe(400);
			});
		});
	});
});
