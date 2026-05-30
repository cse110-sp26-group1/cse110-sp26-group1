import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import worker from '../src';
// Raw import loads the schema file as a string at build time,
// bypassing all runtime path resolution issues on different OSes.
import sqlSchemaRaw from '../schema.sql?raw';

// Mock the AI processing module layer to allow deep validation of enrichment workflows
vi.mock('../src/llm.js', () => ({
	processIssue: vi.fn().mockImplementation(async () => ({})),
}));
import { processIssue } from '../src/llm.js';

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
	const row = await env.DB.prepare(
		'INSERT INTO users (username, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?) RETURNING id',
	)
		.bind(username, 'Test', 'User', email, 'mock_hash')
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
		//"DELETE FROM AGENT ATTEMPTS" still needed but currently commented out since agent attempts table is not yet integrated into the workflow and causes FK constraint issues when included in the cleanup loop.
		await env.DB.exec(`
			DELETE FROM invites;
			DELETE FROM issues;
			DELETE FROM team_members;
			DELETE FROM sessions;
			DELETE FROM teams;
			DELETE FROM users;
		`);
		// Reset Vitest mock history configurations between sequential runs
		vi.resetAllMocks();
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

			it('400: Rejects request if status query parameter format is invalid (Integration Style)', async () => {
				const userId = await createTestUser('status_get_user', 'status_get@ucsd.edu');
				const teamId = await createTestTeam('Status Get Team');
				const token = 'status-get-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch(`http://localhost/issues?team_id=${teamId}&status=InvalidStatusValue`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid status format. Must be one of: Open, In Progress, Resolved, Closed.');
			});

			it('400: Rejects request if priority query parameter format is invalid (Integration Style)', async () => {
				const userId = await createTestUser('priority_get_user', 'priority_get@ucsd.edu');
				const teamId = await createTestTeam('Priority Get Team');
				const token = 'priority-get-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch(`http://localhost/issues?team_id=${teamId}&priority=InvalidPriorityValue`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid priority format. Must be one of: Low, Medium, High, Critical.');
			});

			it('400: Rejects request if assigned_to query parameter format is non-numeric (Integration Style)', async () => {
				const userId = await createTestUser('assigned_to_type_user', 'at_type@ucsd.edu');
				const teamId = await createTestTeam('Assigned To Type Team');
				const token = 'at-type-token';

				// Seed valid session and team membership context
				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				// Pass an invalid non-numeric string to the assigned_to filter
				const res = await SELF.fetch(`http://localhost/issues?team_id=${teamId}&assigned_to=not-a-number`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid assigned_to format. Must be a positive integer.');
			});

			it('400: Rejects request if difficulty query parameter format is invalid (Integration Style)', async () => {
				const userId = await createTestUser('difficulty_get_user', 'diff_get@ucsd.edu');
				const teamId = await createTestTeam('Difficulty Get Team');
				const token = 'diff-get-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch(`http://localhost/issues?team_id=${teamId}&difficulty=SuperHard`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid difficulty format. Must be one of: Easy, Medium, Hard.');
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

	// ==========================================
	// --- POINT 4: GET /issues/:id SINGLE ENTRY ---
	// ==========================================
	describe('GET /issues/:id Single Entry', () => {
		describe('Success Cases', () => {
			it('200: Fetches a single tracking record by ID, verifying complete matching object property allocations and array conversions (Integration Style)', async () => {
				const userId = await createTestUser('single_fetcher', 'fetch@ucsd.edu');
				const teamId = await createTestTeam('Target Team');
				const token = 'single-fetch-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				// Populate complete tracking record properties directly via SQL to verify decoding conversions
				const insertResult = await env.DB.prepare(
					`INSERT INTO issues (team_id, created_by, title, description, status, priority, category, tags, affected_files)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
				)
					.bind(
						teamId,
						userId,
						'Unique Individual Issue',
						'Verifying direct resource matching layouts',
						'Open',
						'Critical',
						'Bug',
						JSON.stringify(['core', 'backend']),
						JSON.stringify(['src/routes/issues.js']),
					)
					.first();

				const issueId = insertResult.id;

				// Integration style utilizing explicit URL ID parameter paths
				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(200);
				const data = await res.json();

				// Assert exact object mapping values match seed records cleanly
				expect(data.id).toBe(issueId);
				expect(data.team_id).toBe(teamId);
				expect(data.title).toBe('Unique Individual Issue');
				expect(data.description).toBe('Verifying direct resource matching layouts');
				expect(data.priority).toBe('Critical');

				// Verify array properties are seamlessly expanded back to structural layouts
				expect(data.tags).toEqual(['core', 'backend']);
				expect(data.affected_files).toEqual(['src/routes/issues.js']);
			});
		});

		describe('Failure Cases', () => {
			it('404: Throws a Not Found error when requesting an explicit integer tracking ID that does not exist inside D1 (Integration Style)', async () => {
				const userId = await createTestUser('search_user', 'search@ucsd.edu');
				const token = 'search-token';
				await createTestSession(userId, token, 24);

				// Requesting a non-existent large issue ID parameter
				const res = await SELF.fetch('http://localhost/issues/99999', {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(404);
				const data = await res.json();
				expect(data.error).toBe('Issue not found');
			});

			it('403: Enforces tenancy isolation, throwing a forbidden error if an issue exists but is tied to a team workspace where the viewer holds no membership (Integration Style)', async () => {
				const maliciousUserId = await createTestUser('attacker', 'spy@ucsd.edu');
				const victimUserId = await createTestUser('victim', 'victim@ucsd.edu');

				const corporateTeamId = await createTestTeam('Secure Corporate Core');
				const publicTeamId = await createTestTeam('Public Playground Sandbox');

				const attackerToken = 'attacker-session-token';

				// Setup attacker session and link them strictly to the playground team context only
				await createTestSession(maliciousUserId, attackerToken, 24);
				await createTeamMembership(maliciousUserId, publicTeamId, 'member');

				// Generate the secret issue belonging to the internal Corporate Core workspace
				const secretIssueId = await createTestIssue(corporateTeamId, victimUserId, 'Secret Financial Vulnerability');

				// Attacker attempts to target the secret issue row directly by integer lookup matching
				const res = await SELF.fetch(`http://localhost/issues/${secretIssueId}`, {
					headers: { Authorization: `Bearer ${attackerToken}` },
				});

				expect(res.status).toBe(403);
				const data = await res.json();
				expect(data.error).toBe('Forbidden');
			});
		});
	});

	// ==========================================
	// --- POINT 5: POST /issues INGESTION ENGINE ---
	// ==========================================
	describe('POST /issues Ingestion Engine', () => {
		describe('Success Cases', () => {
			it('201: Successfully ingests standard JSON input payloads (Integration Style)', async () => {
				const userId = await createTestUser('json_creator', 'jc@ucsd.edu');
				const teamId = await createTestTeam('JSON Creator Team');
				const token = 'json-creator-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						title: 'Database Connection Timeout',
						description: 'The connection pool is exhausted under heavy load.',
						team_id: teamId,
						status: 'Open',
						priority: 'High',
						category: 'Bug',
					}),
				});

				expect(res.status).toBe(201);
				const data = await res.json();
				expect(data.success).toBe(true);
				expect(data.id).toBeTypeOf('number');
				expect(data.enriched.priority).toBe('High');
			});

			it('201: Multipart Processing: Parses a multipart/form-data payload containing an array of tag objects or structured strings (Integration Style)', async () => {
				const userId = await createTestUser('multipart_user', 'multi@ucsd.edu');
				const teamId = await createTestTeam('Multipart Team');
				const token = 'multi-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const formData = new FormData();
				formData.append('title', 'UI Rendering Glitch');
				formData.append('description', 'Navbar overlaps on mobile viewports.');
				formData.append('team_id', String(teamId));
				formData.append('tags', JSON.stringify(['ui', 'testing', 'documentation']));

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});

				expect(res.status).toBe(201);
				const data = await res.json();
				expect(data.success).toBe(true);
				expect(data.enriched.tags).toEqual(['ui', 'testing', 'documentation']);
			});

			it('201: Attachment Ingestion: Uploads log files as explicit form file attachments and verifies text is appended to description (Integration Style)', async () => {
				const userId = await createTestUser('attach_user', 'attach@ucsd.edu');
				const teamId = await createTestTeam('Attachment Team');
				const token = 'attach-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const formData = new FormData();
				formData.append('title', 'Server Crash Event');
				formData.append('description', 'The application terminated unexpectedly.');
				formData.append('team_id', String(teamId));

				// Create an in-memory blob string attachment targeting form extraction falls
				const logBlob = new Blob(['FATAL: Out of memory in heap accumulation'], { type: 'text/plain' });
				formData.append('attachments', logBlob, 'crash_dump.log');

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});

				expect(res.status).toBe(201);
				const data = await res.json();
				expect(data.success).toBe(true);

				// Assert interior database storage to confirm attachment injection formatting rules
				const dbRow = await env.DB.prepare('SELECT description FROM issues WHERE id = ?').bind(data.id).first();
				expect(dbRow.description).toContain('The application terminated unexpectedly.');
				expect(dbRow.description).toContain('--- Attachment: crash_dump.log ---');
				expect(dbRow.description).toContain('FATAL: Out of memory in heap accumulation');
			});

			it('201: AI Enrichment/Fallbacks: Mocks an operational DEEPSEEK_API environment binding, verifies parameter injection, and tests fallback resilience (Unit Style)', async () => {
				const userId = await createTestUser('ai_user', 'ai@ucsd.edu');
				const teamId = await createTestTeam('AI Team');
				const token = 'ai-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				// Scenario A: Successful AI parsing enrichment mapping
				vi.mocked(processIssue).mockResolvedValueOnce({
					status: 'In Progress',
					priority: 'Critical',
					category: 'Bug',
					summary: 'AI Generated Summary Context',
					tags: ['security', 'backend'],
				});

				const reqSuccess = new Request('http://localhost/issues', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						title: 'Core Panic',
						description: 'Kernel stack overflow encountered during execution loop.',
						team_id: teamId,
					}),
				});

				// Inject a mocked deepseek API string to trigger router integration branch
				const customEnvSuccess = { ...env, DEEPSEEK_API: 'sk-deepseek-mock-valid-key' };

				const ctxSuccess = createExecutionContext();
				const resSuccess = await worker.fetch(reqSuccess, customEnvSuccess, ctxSuccess);
				await waitOnExecutionContext(ctxSuccess);

				expect(resSuccess.status).toBe(201);
				const dataSuccess = await resSuccess.json();
				expect(dataSuccess.enriched.status).toBe('In Progress');
				expect(dataSuccess.enriched.priority).toBe('Critical');
				expect(dataSuccess.enriched.summary).toBe('AI Generated Summary Context');
				expect(dataSuccess.enriched.tags).toEqual(['security', 'backend']);

				// Scenario B: Non-fatal failure resilience fallback loop execution
				vi.mocked(processIssue).mockRejectedValueOnce(new Error('API Timeout Exception'));

				const reqFallback = new Request('http://localhost/issues', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						title: 'Resilient Title',
						description: 'Resilient Description',
						team_id: teamId,
					}),
				});

				const ctxFallback = createExecutionContext();
				const resFallback = await worker.fetch(reqFallback, customEnvSuccess, ctxFallback);
				await waitOnExecutionContext(ctxFallback);

				expect(resFallback.status).toBe(201);
				const dataFallback = await resFallback.json();
				expect(dataFallback.success).toBe(true);
				// Verify application uses standard enums seamlessly when network failures arise
				expect(dataFallback.enriched.status).toBe('Open');
				expect(dataFallback.enriched.priority).toBe('Medium');
			});
		});

		describe('Failure Cases', () => {
			it('400: Missing Requirements: Throws 400 when missing mandatory string parameters or the numeric context (Integration Style)', async () => {
				const userId = await createTestUser('post_fail_1', 'pf1@ucsd.edu');
				const token = 'pf1-token';
				await createTestSession(userId, token, 24);

				// Supplying payload missing 'title' and 'description' properties entirely
				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_id: 1 }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('title, team_id, and description are required');
			});

			it('400: Type Validation - Title/Description: Rejects requests if title or description are passed as numbers or empty/whitespace-only string elements (Integration Style)', async () => {
				const userId = await createTestUser('post_fail_2', 'pf2@ucsd.edu');
				const token = 'pf2-token';
				await createTestSession(userId, token, 24);

				// Rejects clean empty space variations on text requirements
				const resWhitespace = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: '   ', description: 'Valid Description', team_id: 1 }),
				});
				expect(resWhitespace.status).toBe(400);
				const dataWhitespace = await resWhitespace.json();
				expect(dataWhitespace.error).toBe('Invalid title format. Must be a non-empty string.');

				// Rejects invalid datatypes submitted inside description schema mapping
				const resType = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Valid Title', description: 99999, team_id: 1 }),
				});
				expect(resType.status).toBe(400);
				const dataType = await resType.json();
				expect(dataType.error).toBe('Invalid description format. Must be a non-empty string.');
			});

			it('400: Type Validation - Team ID: Throws 400 if team_id is a non-numeric string or negative integer format (Integration Style)', async () => {
				const userId = await createTestUser('post_fail_3', 'pf3@ucsd.edu');
				const token = 'pf3-token';
				await createTestSession(userId, token, 24);

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Valid Title', description: 'Valid Description', team_id: -55 }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid team_id. Must be a positive integer.');
			});

			it('400: Mid-Flight Assignment Guard: Throws 400 if an optional assigned_to developer ID is specified but that developer lacks established membership on the team (Integration Style)', async () => {
				const userId = await createTestUser('post_fail_4', 'pf4@ucsd.edu');
				const rogueDevId = await createTestUser('rogue_dev', 'rogue_dev@ucsd.edu');
				const teamId = await createTestTeam('POST Assignment Guard Team');
				const token = 'pf4-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');
				// Notice: rogueDevId is a valid user, but holds no active membership record inside this team workspace

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: 'Valid Title',
						description: 'Valid Description',
						team_id: teamId,
						assigned_to: rogueDevId,
					}),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid assignment. Assignee must be an established member of the team.');
			});

			it('400: Enum Validation - Tags: Rejects tags not in the allowed list', async () => {
				const userId = await createTestUser('post_fail_tags_enum', 'pftags@ucsd.edu');
				const teamId = await createTestTeam('Tags Enum Team');
				const token = 'pftags-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: 'Valid Title',
						description: 'Valid Description',
						team_id: teamId,
						tags: ['frontend', 'ui'],
					}),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid tag(s): frontend');
				expect(data.error).toContain('Must be one of:');
			});

			it('400: Type Validation - Tags: Rejects configurations if tags is passed as a non-array value or contains non-string elements (Integration Style)', async () => {
				const userId = await createTestUser('post_fail_5', 'pf5@ucsd.edu');
				const teamId = await createTestTeam('Tags Validation Team');
				const token = 'pf5-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: 'Valid Title',
						description: 'Valid Description',
						team_id: teamId,
						tags: [100, 200, 'string-tag'], // Rejects multi-type array properties
					}),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid tags format');
			});

			it('400: Enum Guardrails: Enforce unyielding matching boundary values for configuration fields (Integration Style)', async () => {
				const userId = await createTestUser('post_fail_6', 'pf6@ucsd.edu');
				const teamId = await createTestTeam('Enum Guardrails Team');
				const token = 'pf6-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: 'Valid Title',
						description: 'Valid Description',
						team_id: teamId,
						category: 'Malicious Injected Category Name Value',
					}),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid category. Must be one of:');
			});
		});
	});

	// ==========================================
	// --- POINT 6: PATCH /issues/:id PARTIAL UPDATES ---
	// ==========================================
	describe('PATCH /issues/:id Partial Updates', () => {
		describe('Success Cases', () => {
			it('200: COALESCE Application: Modifies explicitly supplied fields while preserving all unmentioned resource parameters (Integration Style)', async () => {
				const userId = await createTestUser('patch_user_1', 'pu1@ucsd.edu');
				const teamId = await createTestTeam('Patch Core Team');
				const token = 'patch-token-1';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const issueId = await createTestIssue(teamId, userId, 'Original Title Text', 'Original Description Text');

				// Execute partial update payload modifying only 'priority' and 'status'
				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						priority: 'Critical',
						status: 'In Progress',
					}),
				});

				expect(res.status).toBe(200);
				const patchData = await res.json();
				expect(patchData.success).toBe(true);

				// Query database row directly to confirm COALESCE isolation mechanics
				const row = await env.DB.prepare('SELECT * FROM issues WHERE id = ?').bind(issueId).first();
				expect(row.priority).toBe('Critical');
				expect(row.status).toBe('In Progress');

				// Assert unmentioned resource properties are preserved cleanly without modification
				expect(row.title).toBe('Original Title Text');
				expect(row.description).toBe('Original Description Text');
			});

			it('200: Timestamp Overrides: Automatically increments updated_at timestamp while ignoring manual request body adjustments (Integration Style)', async () => {
				const userId = await createTestUser('patch_user_2', 'pu2@ucsd.edu');
				const teamId = await createTestTeam('Patch Time Team');
				const token = 'patch-token-2';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const issueId = await createTestIssue(teamId, userId, 'Timestamp Bug', 'Description');

				// Attempt to manually compromise the updated_at tracking metrics inside the query payload
				const maliciousPastTimestamp = '2000-01-01T00:00:00.000Z';
				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						title: 'Legitimate Title Update',
						updated_at: maliciousPastTimestamp,
					}),
				});

				expect(res.status).toBe(200);

				// Confirm that server-side generation overrides manual inputs
				const row = await env.DB.prepare('SELECT updated_at FROM issues WHERE id = ?').bind(issueId).first();
				expect(row.updated_at).not.toBe(maliciousPastTimestamp);
				expect(new Date(row.updated_at).getFullYear()).toBeGreaterThanOrEqual(2026);
			});
		});

		describe('Failure Cases', () => {
			it('404: Returns 404 Not Found if patching an entry ID missing from the tracker entirely (Integration Style)', async () => {
				const userId = await createTestUser('patch_fail_user_1', 'pfu1@ucsd.edu');
				const token = 'patch-fail-token-1';
				await createTestSession(userId, token, 24);

				const res = await SELF.fetch('http://localhost/issues/88888', {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ title: 'New Title' }),
				});

				expect(res.status).toBe(404);
				const data = await res.json();
				expect(data.error).toBe('Issue not found');
			});

			it('400: Empty Mutation Validation: Rejects request with 400 if payload contains an empty object or lacks mutable fields (Integration Style)', async () => {
				const userId = await createTestUser('patch_fail_user_2', 'pfu2@ucsd.edu');
				const teamId = await createTestTeam('Empty Payload Team');
				const token = 'patch-fail-token-2';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');
				const issueId = await createTestIssue(teamId, userId);

				// Scenario A: Passing an entirely empty object
				const resEmpty = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({}),
				});
				expect(resEmpty.status).toBe(400);
				const dataEmpty = await resEmpty.json();
				expect(dataEmpty.error).toBe('No valid fields provided');

				// Scenario B: Passing an unmapped/immutable schema field object parameter
				const resInvalidFields = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ illegal_malicious_override_field: 'malicious' }),
				});
				expect(resInvalidFields.status).toBe(400);
				const dataInvalidFields = await resInvalidFields.json();
				expect(dataInvalidFields.error).toBe('No valid fields provided');
			});

			it('400: Type Validation: Enforces string lengths on text mutations and array compliance constraints on collections (Integration Style)', async () => {
				const userId = await createTestUser('patch_fail_user_3', 'pfu3@ucsd.edu');
				const teamId = await createTestTeam('Type Validation Patch Team');
				const token = 'patch-fail-token-3';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');
				const issueId = await createTestIssue(teamId, userId);

				// Enforce non-empty text checking for title updates
				const resTitle = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: '   ' }),
				});
				expect(resTitle.status).toBe(400);
				expect((await resTitle.json()).error).toBe('Invalid title format. Must be a non-empty string.');

				// Enforce non-empty text checking for description updates
				const resDesc = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ description: '' }),
				});
				expect(resDesc.status).toBe(400);
				expect((await resDesc.json()).error).toBe('Invalid description format. Must be a non-empty string.');

				// Guard tag schema formatting arrays from multi-type injections
				const resTags = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ tags: 'not-an-array-datatype' }),
				});
				expect(resTags.status).toBe(400);
				expect((await resTags.json()).error).toBe('Invalid tags format');

				// Guard affected_files strings inside schema row properties
				const resFiles = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ affected_files: [123, 456] }), // Non-string variations are thrown out
				});
				expect(resFiles.status).toBe(400);
				expect((await resFiles.json()).error).toBe('Invalid affected_files format. Must be an array of strings.');
			});

			it('400: Rejects request if difficulty payload value is invalid (Integration Style)', async () => {
				const userId = await createTestUser('difficulty_patch_user', 'diff_patch@ucsd.edu');
				const teamId = await createTestTeam('Difficulty Patch Team');
				const token = 'diff-patch-token';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');
				const issueId = await createTestIssue(teamId, userId);

				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ difficulty: 'InvalidDifficultyValue' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid difficulty value');
			});

			it('400: Rejects request if tags query parameter format is a string instead of an array (Integration Style)', async () => {
				const userId = await createTestUser('patch_tags_type_user', 'tags_type@ucsd.edu');
				const teamId = await createTestTeam('Tags Type Patch Team');
				const token = 'tags-type-patch-token';

				// Seed valid session and team membership context
				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');
				const issueId = await createTestIssue(teamId, userId);

				// Pass an invalid string datatype directly to the tags parameter
				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ tags: 'invalid-string-instead-of-array' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid tags format');
			});

			it('400: Mid-Flight Assignment Guard: Blocks reassignments if assigned_to user does not belong to team context (Integration Style)', async () => {
				const userId = await createTestUser('patch_fail_user_4', 'pfu4@ucsd.edu');
				const outsiderId = await createTestUser('unlinked_outsider', 'out@ucsd.edu');
				const teamId = await createTestTeam('Assignment Boundary Patch Team');
				const token = 'patch-fail-token-4';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');
				// Notice: outsiderId is initialized, but missing explicit workspace group associations

				const issueId = await createTestIssue(teamId, userId);

				const res = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ assigned_to: outsiderId }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toBe('Invalid assignment. Assignee must be an established member of the team.');
			});
		});
	});

	// ==========================================
	// --- POINT 7: DELETE /issues/:id DELETION FLOW ---
	// ==========================================
	describe('DELETE /issues/:id Deletion Flow', () => {
		describe('Success Cases', () => {
			it('200: Executes removal on an active entry ID and ensures subsequent fetch results in a 404 (Integration Style)', async () => {
				const userId = await createTestUser('deleter_user', 'delete@ucsd.edu');
				const teamId = await createTestTeam('Deletion Workspace Team');
				const token = 'delete-token-valid';

				await createTestSession(userId, token, 24);
				await createTeamMembership(userId, teamId, 'member');

				const issueId = await createTestIssue(teamId, userId, 'Temporary Issue', 'To be deleted');

				// Execute the removal attempt via DELETE method route
				const deleteRes = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(deleteRes.status).toBe(200);
				const deleteData = await deleteRes.json();
				expect(deleteData).toEqual({ success: true });

				// Immediately query the individual entry GET path to verify it now returns a 404 Not Found state
				const getRes = await SELF.fetch(`http://localhost/issues/${issueId}`, {
					method: 'GET',
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(getRes.status).toBe(404);
				const getData = await getRes.json();
				expect(getData.error).toBe('Issue not found');
			});
		});

		describe('Failure Cases', () => {
			it('404: Throws 404 Not Found if trying to delete an invalid tracking resource integer (Integration Style)', async () => {
				const userId = await createTestUser('delete_fail_user', 'dfu@ucsd.edu');
				const token = 'delete-fail-token';
				await createTestSession(userId, token, 24);

				const res = await SELF.fetch('http://localhost/issues/99999', {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(404);
				const data = await res.json();
				expect(data.error).toBe('Issue not found');
			});

			it('403: Tenancy Isolation: Block removal attempts with a 403 Forbidden if an outside user attempts to remove cross-team records (Integration Style)', async () => {
				const authorizedUserId = await createTestUser('owner_user', 'owner@ucsd.edu');
				const externalUserId = await createTestUser('external_user', 'external@ucsd.edu');

				const corporateTeamId = await createTestTeam('Internal Workspace Core');
				const outsideTeamId = await createTestTeam('Outside Sandbox Workspace');

				const externalToken = 'external-session-token';

				// Establish external user session and map them strictly to the outside sandbox team context
				await createTestSession(externalUserId, externalToken, 24);
				await createTeamMembership(externalUserId, outsideTeamId, 'member');

				// Seed an issue tracking entry belonging securely to the Internal Workspace Core team
				const internalIssueId = await createTestIssue(corporateTeamId, authorizedUserId, 'Corporate Production Critical Bug');

				// External unlinked user attempts to remove cross-team record matrix rows
				const res = await SELF.fetch(`http://localhost/issues/${internalIssueId}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${externalToken}` },
				});

				expect(res.status).toBe(403);
				const data = await res.json();
				expect(data.error).toBe('Forbidden');
			});
		});
	});
});
