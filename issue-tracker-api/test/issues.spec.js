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

	// ==========================================
	// --- POINT 3: GET /issues COLLECTION ---
	// ==========================================
	describe('GET /issues Collection', () => {
		describe('Success Cases', () => {
			it('200: Returns an empty array ([]) when an authorized team has no issues tracked (Integration Style)', async () => {
				const userId = await createTestUser('clean_user', 'clean@ucsd.edu');
				const teamId = await createTestTeam('Empty Team');
				const token = 'empty-team-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch(`http://localhost/issues?team_id=${teamId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data).toEqual([]);
			});

			it('200: Verifies that escape-stringified SQLite text columns are returned as deserialized JavaScript array structures (Integration Style)', async () => {
				const userId = await createTestUser('json_user', 'json@ucsd.edu');
				const teamId = await createTestTeam('JSON Team');
				const token = 'json-team-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				// Direct DB seed to bypass API abstractions and explicitly verify schema text decoding
				await env.DB.prepare(
					`INSERT INTO issues (team_id, created_by, title, description, tags, stack_trace, affected_files)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				)
					.bind(
						teamId,
						userId,
						'JSON Serialization Bug',
						'Verifying JSON text structures',
						JSON.stringify(['frontend', 'high-priority']),
						JSON.stringify(['TypeError: Cannot read property of undefined']),
						JSON.stringify(['src/index.js', 'src/utils.js']),
					)
					.run();

				const res = await SELF.fetch(`http://localhost/issues?team_id=${teamId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.length).toBe(1);

				// Assert text row strings are correctly expanded back into arrays
				expect(data[0].tags).toEqual(['frontend', 'high-priority']);
				expect(data[0].stack_trace).toEqual(['TypeError: Cannot read property of undefined']);
				expect(data[0].affected_files).toEqual(['src/index.js', 'src/utils.js']);
			});

			it('200: Matches records by combining multiple filtering parameters concurrently (Unit Style)', async () => {
				const userId = await createTestUser('filter_user', 'filter@ucsd.edu');
				const developerId = await createTestUser('target_dev', 'dev@ucsd.edu');
				const teamId = await createTestTeam('Filter Team');
				const token = 'filter-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				// Issue A: Matches all combined search parameters
				await env.DB.prepare(
					`INSERT INTO issues (team_id, created_by, title, description, status, priority, assigned_to, category, difficulty)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
					.bind(teamId, userId, 'Target Match', 'Desc', 'In Progress', 'High', developerId, 'Bug', 'Hard')
					.run();

				// Issue B: Holds a mismatch in 'difficulty' and 'status'
				await env.DB.prepare(
					`INSERT INTO issues (team_id, created_by, title, description, status, priority, assigned_to, category, difficulty)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
					.bind(teamId, userId, 'Partial Mismatch', 'Desc', 'Open', 'High', developerId, 'Bug', 'Easy')
					.run();

				// Execute multiple constraints securely appended to search string context
				const req = new Request(
					`http://localhost/issues?team_id=${teamId}&status=In+Progress&priority=High&assigned_to=${developerId}&category=Bug&difficulty=Hard`,
					{ headers: { Authorization: `Bearer ${token}` } },
				);
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.length).toBe(1);
				expect(data[0].title).toBe('Target Match');
			});

			it('200: Alters element delivery order when combining sort_by column with explicit order=desc parameters (Unit Style)', async () => {
				const userId = await createTestUser('sort_user', 'sort@ucsd.edu');
				const teamId = await createTestTeam('Sorting Team');
				const token = 'sort-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				// Insert "Alpha Issue" then "Beta Issue"
				await env.DB.prepare('INSERT INTO issues (team_id, created_by, title, description) VALUES (?, ?, ?, ?)')
					.bind(teamId, userId, 'Alpha Issue', 'First')
					.run();
				await env.DB.prepare('INSERT INTO issues (team_id, created_by, title, description) VALUES (?, ?, ?, ?)')
					.bind(teamId, userId, 'Beta Issue', 'Second')
					.run();

				// Request descending alphabetical order by title
				const req = new Request(`http://localhost/issues?team_id=${teamId}&sort_by=title&order=desc`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.length).toBe(2);
				expect(data[0].title).toBe('Beta Issue');
				expect(data[1].title).toBe('Alpha Issue');
			});

			it('200: Gracefully ignores unlisted or invalid sorting column fields without executing failures (Unit Style)', async () => {
				const userId = await createTestUser('ignore_user', 'ignore@ucsd.edu');
				const teamId = await createTestTeam('Ignore Validation Team');
				const token = 'ignore-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');
				await createTestIssue(teamId, userId, 'Resilient Entry');

				// Passing a non-existent column name inside sort param
				const req = new Request(`http://localhost/issues?team_id=${teamId}&sort_by=malicious_injection_attempt`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.length).toBe(1);
				expect(data[0].title).toBe('Resilient Entry');
			});
		});

		describe('Failure Cases', () => {
			it('400: Rejects the request with an error if team_id query parameter is left out completely (Integration Style)', async () => {
				const userId = await createTestUser('missing_param_user', 'missing@ucsd.edu');
				const token = 'missing-param-token';
				await createTestSession(userId, token, 24);

				const res = await SELF.fetch('http://localhost/issues', {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('team_id query param required');
			});

			it('400: Rejects request if team_id query parameter format is non-numeric or non-integer (Integration Style)', async () => {
				const userId = await createTestUser('type_user', 'type@ucsd.edu');
				const token = 'type-token';
				await createTestSession(userId, token, 24);

				const res = await SELF.fetch('http://localhost/issues?team_id=not-an-integer-string', {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid team_id format. Must be a positive integer.');
			});

			it('403: Rejects request with a forbidden error if an authenticated user attempts to read records from a team context without membership (Integration Style)', async () => {
				const userId = await createTestUser('outsider_user', 'outsider@ucsd.edu');
				const alienTeamId = await createTestTeam('Restricted Workspace');
				const token = 'outsider-token';

				// Setup active user session, but completely omit adding them to the target team membership matrix
				await createTestSession(userId, token, 24);

				const res = await SELF.fetch(`http://localhost/issues?team_id=${alienTeamId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(403);
				const data = await res.json();
				expect(data.error).toBe('Forbidden');
			});
		});
	});
});
