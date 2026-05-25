import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import worker from '../src';
// Raw import loads the schema file as a string at build time,
// bypassing all runtime path resolution issues on different OSes.
import sqlSchemaRaw from '../schema.sql?raw';

// ==========================================
// --- SECTION 1: SEED & MOCK HELPERS ---
// ==========================================

/**
 * Creates a mock user record in the database.
 * @param {string} username
 * @param {string} email
 * @returns {Promise<number>} The inserted user's ID.
 */
async function createTestUser(username, email) {
	const row = await env.DB.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id')
		.bind(username, email, 'mock_hash')
		.first();
	return row.id;
}

/**
 * Creates a mock team workspace record in the database.
 * @param {string} teamName
 * @returns {Promise<number>} The inserted team's ID.
 */
async function createTestTeam(teamName) {
	const row = await env.DB.prepare('INSERT INTO teams (team_name) VALUES (?) RETURNING id').bind(teamName).first();
	return row.id;
}

/**
 * Seeds an active or expired session to satisfy the requireAuth barrier.
 * @param {number} userId - The user ID owning the session.
 * @param {string} token - The raw bearer token string.
 * @param {number} ttlHours - Relative time offset in hours (negative for expired sessions).
 */
async function createTestSession(userId, token, ttlHours = 24) {
	const expiryDate = new Date();
	expiryDate.setHours(expiryDate.getHours() + ttlHours);
	await env.DB.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
		.bind(userId, token, expiryDate.toISOString())
		.run();
}

/**
 * Seeds a team membership relation to satisfy the requireTeamMember multi-tenant barrier.
 * @param {number} userId
 * @param {number} teamId
 * @param {'admin' | 'member'} role
 */
async function createTeamMembership(userId, teamId, role = 'member') {
	await env.DB.prepare('INSERT INTO team_members (user_id, team_id, role) VALUES (?, ?, ?)').bind(userId, teamId, role).run();
}

/**
 * Robust helper to generate baseline issue records ensuring required schema fields are populated.
 * @param teamId
 * @param createdById
 * @param title
 * @param description
 */
async function createTestIssue(teamId, createdById, title = 'Sample Bug', description = 'Sample Description') {
	const row = await env.DB.prepare(
		'INSERT INTO issues (team_id, created_by, title, description, status, priority, category) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
	)
		.bind(teamId, createdById, title, description, 'Open', 'Medium', 'Bug')
		.first();
	return row.id;
}

// ==========================================
// --- GLOBAL ENVIRONMENT SETUP & TEARDOWN ---
// ==========================================

describe('Issues Endpoint Testing Suite', () => {
	beforeAll(async () => {
		// Clean the SQL string to remove comments and decorative headers
		// that can cause parsing errors in the D1 internal engine.
		const cleanSql = sqlSchemaRaw
			.split('\n')
			.map((line) => line.split('--')[0].trim()) // Strip inline comments
			.filter((line) => line.length > 0) // Strip empty lines
			.join(' '); // Join into a single execution string

		// Initialize the temporary D1 test database with your schema
		await env.DB.exec(cleanSql);
	});

	beforeEach(async () => {
		// Clear all tables to ensure strict test isolation and a clean state for every run.
		await env.DB.exec(`
			DELETE FROM agent_attempts;
			DELETE FROM invites;
			DELETE FROM issues;
			DELETE FROM team_members;
			DELETE FROM sessions;
			DELETE FROM teams;
			DELETE FROM users;
		`);
	});

	// ==========================================
	// --- AUTHENTICATION & ACCESS CONTROL TESTS ---
	// ==========================================
	describe('RequireAuth & requireTeamMember Access Verification', () => {
		describe('Success Cases', () => {
			it('200: Allows full endpoint entry when both valid session and team membership exist (Unit Style)', async () => {
				const userId = await createTestUser('valid_user', 'valid@ucsd.edu');
				const teamId = await createTestTeam('Engineering Team');
				const token = 'perfect-session-token';

				// Seed setup required to clear all middleware guards
				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				// Unit style verification targeting worker.fetch directly
				const req = new Request(`http://localhost/issues?team_id=${teamId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(Array.isArray(data)).toBe(true);
			});
		});

		describe('Failure Cases', () => {
			it('401: Rejects incoming request when Authorization header is completely missing (Integration Style)', async () => {
				// Integration style hitting actual cloudflare worker via SELF
				const res = await SELF.fetch('http://localhost/issues?team_id=1');

				expect(res.status).toBe(401);
				const data = await res.json();
				expect(data.error).toBe('Unauthorized');
			});

			it('401: Rejects request when session token is provided but missing from database (Unit Style)', async () => {
				const req = new Request('http://localhost/issues?team_id=1', {
					headers: { Authorization: 'Bearer non-existent-token' },
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(401);
				const data = await res.json();
				expect(data.error).toBe('Invalid session');
			});

			it('401: Cleanly detects and rejects expired session tokens (Integration Style)', async () => {
				const userId = await createTestUser('expired_user', 'expired@ucsd.edu');
				const token = 'expired-session-token';

				// Seed a token that expired 2 hours ago
				await createTestSession(userId, token, -2);

				const res = await SELF.fetch('http://localhost/issues?team_id=1', {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(401);
				const data = await res.json();
				expect(data.error).toBe('Session expired');
			});

			it('403: Blocks authorized users from workspace domains where they hold no membership (Unit Style)', async () => {
				const userId = await createTestUser('rogue_user', 'rogue@ucsd.edu');
				const teamId = await createTestTeam('Isolated Environment');
				const token = 'active-session-token';

				// User holds an active session but has NOT been linked to this team context
				await createTestSession(userId, token, 24);

				const req = new Request(`http://localhost/issues?team_id=${teamId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(403);
				const data = await res.json();
				expect(data.error).toBe('Forbidden');
			});
		});
	});

	// ==========================================
	// --- POINT 2: EARLY PATH PARAM FAILURES ---
	// ==========================================
	describe('Early Path Param Failures', () => {
		describe('Failure Cases', () => {
			it('400: Throws an explicit bad request error if issue ID path parameter is a non-numeric string (Unit Style)', async () => {
				// Passing /issues/abc treats 'abc' as the issueId parameter
				const req = new Request('http://localhost/issues/abc', { method: 'GET' });
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid issue ID format. Must be a positive integer.');
			});

			it('400: Rejects edge-case request where issue ID path parameter is a negative integer (Unit Style)', async () => {
				const req = new Request('http://localhost/issues/-500', { method: 'PATCH' });
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid issue ID format. Must be a positive integer.');
			});

			it('400: Rejects edge-case request where issue ID path parameter is exactly zero (Unit Style)', async () => {
				const req = new Request('http://localhost/issues/0', { method: 'DELETE' });
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid issue ID format. Must be a positive integer.');
			});
		});
	});
});
