import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import worker from '../src';
// Raw import loads the schema file as a string at build time,
// bypassing all runtime path resolution issues on different OSes.
import sqlSchemaRaw from '../schema.sql?raw';

// --- SEED HELPERS ---
/**
 *
 * @param username
 * @param email
 */
async function createTestUser(username, email) {
	const row = await env.DB.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id')
		.bind(username, email, 'mock_hash')
		.first();
	return row.id;
}

/**
 *
 * @param teamName
 */
async function createTestTeam(teamName) {
	const row = await env.DB.prepare('INSERT INTO teams (team_name) VALUES (?) RETURNING id').bind(teamName).first();
	return row.id;
}

/**
 *
 * @param teamId
 * @param createdById
 * @param title
 */
async function createTestIssue(teamId, createdById, title = 'Sample Bug') {
	const row = await env.DB.prepare('INSERT INTO issues (team_id, created_by, title) VALUES (?, ?, ?) RETURNING id')
		.bind(teamId, createdById, title)
		.first();
	return row.id;
}

describe('Issues Endpoint Testing Suite', () => {
	beforeAll(async () => {
		// Clean the SQL string to remove comments and decorative headers
		// that can cause parsing errors in the D1 internal engine.
		const cleanSql = sqlSchemaRaw
			.split('\n')
			.map((line) => line.split('--')[0].trim()) // Strip comments
			.filter((line) => line.length > 0) // Strip empty lines
			.join(' '); // Join into a single execution string

		// Initialize the temporary D1 test database with your schema
		await env.DB.exec(cleanSql);
	});

	beforeEach(async () => {
		// Clear all tables to ensure test isolation and a clean state for every run
		await env.DB.exec(`
			DELETE FROM agent_attempts;
			DELETE FROM invites;
			DELETE FROM issues;
			DELETE FROM team_members;
			DELETE FROM teams;
			DELETE FROM users;
		`);
	});

	// ==========================================
	// GET /issues Testing
	// ==========================================
	describe('GET /issues', () => {
		describe('Success Cases', () => {
			it('200: returns an array of issues for a valid team_id (Unit Style)', async () => {
				const userId = await createTestUser('johndoe', 'john@ucsd.edu');
				const teamId = await createTestTeam('Alpha Team');
				await createTestIssue(teamId, userId, 'Crash on load');

				const req = new Request(`http://localhost/issues?team_id=${teamId}`);
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(Array.isArray(data)).toBe(true);
				expect(data.length).toBe(1);
				expect(data[0].title).toBe('Crash on load');
			});

			it('200: returns an empty array if team has no issues (Integration Style)', async () => {
				const teamId = await createTestTeam('Empty Team');
				const res = await SELF.fetch(`http://localhost/issues?team_id=${teamId}`);

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data).toEqual([]);
			});
		});

		describe('Failure Cases', () => {
			it('400: rejects missing team_id query parameter', async () => {
				const res = await SELF.fetch('http://localhost/issues');
				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('team_id query param required');
			});

			it('400: rejects invalid non-numeric team_id format', async () => {
				const res = await SELF.fetch('http://localhost/issues?team_id=not-a-number');
				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid team_id format');
			});
		});
	});

	// ==========================================
	// POST /issues Testing
	// ==========================================
	describe('POST /issues', () => {
		describe('Success Cases', () => {
			it('201: successfully creates a valid issue (Integration Style)', async () => {
				const userId = await createTestUser('dev_user', 'dev@ucsd.edu');
				const teamId = await createTestTeam('Beta Team');

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						team_id: teamId,
						created_by: userId,
						title: 'UI alignment bug',
						priority: 'High',
						category: 'Bug',
					}),
				});

				expect(res.status).toBe(201);
				const data = await res.json();
				expect(data.success).toBe(true);
			});
		});

		describe('Failure Cases', () => {
			it('400: fails when required tracking fields are missing', async () => {
				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Missing team and user data' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Missing required fields');
			});

			it('400: fails if title payload is not a valid string', async () => {
				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_id: 1, created_by: 1, title: 12345 }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid title format');
			});

			it('400: fails if team_id or created_by inputs are malformed', async () => {
				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_id: 'crazy-id', created_by: 1, title: 'Valid Title' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid team_id');
			});

			it('400: fails when given illegal enum values for status configurations', async () => {
				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_id: 1, created_by: 1, title: 'Bug', status: 'SuperCritical' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid status');
			});
		});
	});

	// ==========================================
	// PATCH /issues/:id Testing
	// ==========================================
	describe('PATCH /issues/:id', () => {
		describe('Success Cases', () => {
			it('200: updates fields of an existing issue tracker entry', async () => {
				const userId = await createTestUser('updater', 'update@ucsd.edu');
				const teamId = await createTestTeam('Delta Team');
				const issueId = await createTestIssue(teamId, userId, 'Old Title');

				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status: 'In Progress', priority: 'Critical' }),
				});

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.success).toBe(true);
			});
		});

		describe('Failure Cases', () => {
			it('400: fails if issue path parameter is non-numeric', async () => {
				const res = await SELF.fetch('http://localhost/issues/invalid-id-string', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status: 'Resolved' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid issue ID format');
			});
		});
	});

	// ==========================================
	// DELETE /issues/:id Testing
	// ==========================================
	describe('DELETE /issues/:id', () => {
		describe('Success Cases', () => {
			it('200: deletes database entry successfully', async () => {
				const userId = await createTestUser('remover', 'remove@ucsd.edu');
				const teamId = await createTestTeam('Omega Team');
				const issueId = await createTestIssue(teamId, userId, 'Temporary Bug');

				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, { method: 'DELETE' });
				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.success).toBe(true);
			});
		});

		describe('Failure Cases', () => {
			it('400: handles malformed route configurations cleanly', async () => {
				const res = await SELF.fetch('http://localhost/issues/-500', { method: 'DELETE' });
				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid issue ID format');
			});
		});
	});
});
