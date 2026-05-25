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
				formData.append('tags', JSON.stringify(['css', 'mobile', 'frontend']));

				const res = await SELF.fetch('http://localhost/issues', {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
					body: formData,
				});

				expect(res.status).toBe(201);
				const data = await res.json();
				expect(data.success).toBe(true);
				expect(data.enriched.tags).toEqual(['css', 'mobile', 'frontend']);
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

			it('201: AI Enrichment/Fallbacks: Mocks an operational DEEPSEEK_API environment binding, verifies parameter injection, and tests fallback resiliency (Unit Style)', async () => {
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
					tags: ['ai-inferred', 'automated'],
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
				expect(dataSuccess.enriched.tags).toEqual(['ai-inferred', 'automated']);

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
});
