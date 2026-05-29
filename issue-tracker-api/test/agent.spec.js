import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import worker from '../src';
import sqlSchemaRaw from '../schema.sql?raw';

/**
 * Creates a test user and returns their id.
 * @param {string} username - The username for the test user.
 * @param {string} email - The email for the test user.
 * @returns {Promise<number>} The id of the created user.
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
 * Creates a test team and returns its id.
 * @param {string} teamName - The name of the test team.
 * @returns {Promise<number>} The id of the created team.
 */
async function createTestTeam(teamName) {
	const row = await env.DB.prepare('INSERT INTO teams (team_name) VALUES (?) RETURNING id').bind(teamName).first();
	return row.id;
}

/**
 * Creates a test issue directly in the DB and returns its id.
 * Used to seed data for GET and PATCH tests without going through the endpoint.
 * @param {number} teamId - The id of the team the issue belongs to.
 * @param {number} createdBy - The id of the user creating the issue.
 * @param {string} title - The title of the issue.
 * @returns {Promise<number>} The id of the created issue.
 */
async function createTestIssue(teamId, createdBy, title = 'Sample Agent Issue') {
	const row = await env.DB.prepare('INSERT INTO issues (team_id, created_by, title) VALUES (?, ?, ?) RETURNING id')
		.bind(teamId, createdBy, title)
		.first();
	return row.id;
}

/**
 * Creates a test session for a user and returns the session token.
 * Used to provide Authorization headers for authenticated requests.
 * @param {number} userId - The id of the user to create a session for.
 * @returns {Promise<string>} The session token.
 */
async function createTestSession(userId) {
	const token = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour from now
	await env.DB.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').bind(userId, token, expiresAt).run();
	return token;
}

describe('Agent Endpoint Testing Suite', () => {
	beforeAll(async () => {
		// Strip SQL comments and blank lines that can cause D1 parsing errors
		const cleanSql = sqlSchemaRaw
			.split('\n')
			.map((line) => line.split('--')[0].trim())
			.filter((line) => line.length > 0)
			.join(' ');

		await env.DB.exec(cleanSql);
	});

	beforeEach(async () => {
		// Clear all tables before each test to ensure full isolation
		await env.DB.exec(`
			DELETE FROM sessions;
			DELETE FROM invites;
			DELETE FROM issues;
			DELETE FROM team_members;
			DELETE FROM teams;
			DELETE FROM users;
		`);
	});

	// ==========================================
	// GET /agents/:id Testing
	// ==========================================
	describe('GET /agents/:id', () => {
		describe('Success Cases', () => {
			it('200: returns correct issue by id with all fields (Integration Style)', async () => {
				const userId = await createTestUser('agent_user', 'agent@ucsd.edu');
				const teamId = await createTestTeam('Agent Team');
				const issueId = await createTestIssue(teamId, userId, 'Null pointer exception');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.id).toBe(issueId);
				expect(data.title).toBe('Null pointer exception');
				expect(data.team_id).toBe(teamId);
				expect(data.created_by).toBe(userId);
			});

			it('200: response includes all expected issue fields (Unit Style)', async () => {
				const userId = await createTestUser('field_user', 'fields@ucsd.edu');
				const teamId = await createTestTeam('Field Team');
				const issueId = await createTestIssue(teamId, userId, 'Field Check Issue');
				const token = await createTestSession(userId);

				const req = new Request(`http://localhost/agents/${issueId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(200);
				const data = await res.json();

				// Verify all schema fields are present in the response
				expect(data).toHaveProperty('id');
				expect(data).toHaveProperty('team_id');
				expect(data).toHaveProperty('created_by');
				expect(data).toHaveProperty('assigned_to');
				expect(data).toHaveProperty('title');
				expect(data).toHaveProperty('description');
				expect(data).toHaveProperty('summary');
				expect(data).toHaveProperty('status');
				expect(data).toHaveProperty('priority');
				expect(data).toHaveProperty('difficulty');
				expect(data).toHaveProperty('category');
				expect(data).toHaveProperty('tags');
				expect(data).toHaveProperty('entry_point');
				expect(data).toHaveProperty('error_type');
				expect(data).toHaveProperty('error_message');
				expect(data).toHaveProperty('stack_trace');
				expect(data).toHaveProperty('affected_files');
				expect(data).toHaveProperty('expected_behavior');
				expect(data).toHaveProperty('actual_behavior');
				expect(data).toHaveProperty('missing_information');
				expect(data).toHaveProperty('steps_to_reproduce');
				expect(data).toHaveProperty('hypothesis');
				expect(data).toHaveProperty('token_usage');
				expect(data).toHaveProperty('resolution_notes');
				expect(data).toHaveProperty('created_at');
				expect(data).toHaveProperty('updated_at');
			});

			it('200: array fields (tags, stack_trace, affected_files) are parsed as arrays', async () => {
				const userId = await createTestUser('array_user', 'array@ucsd.edu');
				const teamId = await createTestTeam('Array Team');
				const issueId = await createTestIssue(teamId, userId, 'Array Field Issue');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const data = await res.json();

				expect(Array.isArray(data.tags)).toBe(true);
				expect(Array.isArray(data.stack_trace)).toBe(true);
				expect(Array.isArray(data.affected_files)).toBe(true);
			});
		});

		describe('Failure Cases', () => {
			it('404: returns 404 for an issue id that does not exist', async () => {
				const userId = await createTestUser('notfound_user', 'notfound@ucsd.edu');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents/99999', {
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(404);
				const data = await res.json();
				expect(data.error).toContain('Issue not found');
			});

			it('400: rejects a non-numeric id', async () => {
				const res = await SELF.fetch('http://localhost/agents/not-a-number');

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid issue ID format');
			});

			it('400: rejects a zero id', async () => {
				const res = await SELF.fetch('http://localhost/agents/0');

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid issue ID format');
			});

			it('400: rejects a negative id', async () => {
				const res = await SELF.fetch('http://localhost/agents/-1');

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid issue ID format');
			});
		});
	});

	// ==========================================
	// POST /agents Testing
	// ==========================================
	describe('POST /agents', () => {
		describe('Success Cases', () => {
			it('201: creates an issue with only required fields (Integration Style)', async () => {
				const userId = await createTestUser('post_user', 'post@ucsd.edu');
				const teamId = await createTestTeam('Post Team');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: 'Agent created issue' }),
				});

				expect(res.status).toBe(201);
				const data = await res.json();
				expect(data.success).toBe(true);
			});

			it('201: creates an issue with all fields populated (Unit Style)', async () => {
				const userId = await createTestUser('full_user', 'full@ucsd.edu');
				const teamId = await createTestTeam('Full Team');
				const token = await createTestSession(userId);

				const req = new Request('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({
						team_id: teamId,
						title: 'Full issue',
						summary: 'A full issue with all fields',
						status: 'Open',
						priority: 'High',
						category: 'Bug',
						difficulty: 'hard',
						tags: ['auth', 'critical'],
						entry_point: 'src/auth.js',
						error_type: 'TypeError',
						error_message: 'Cannot read property of undefined',
						stack_trace: ['at auth.js:42', 'at index.js:10'],
						affected_files: ['src/auth.js', 'src/index.js'],
						expected_behavior: 'User logs in successfully',
						actual_behavior: 'Crash on login',
						missing_information: 'None',
						steps_to_reproduce: '1. Go to login 2. Submit form',
						hypothesis: 'Null check missing in auth handler',
						token_usage: 500,
						resolution_notes: 'Fix null check',
					}),
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(201);

				const issue = await env.DB.prepare('SELECT * FROM issues WHERE title = ?').bind('Full issue').first();
				expect(issue).not.toBeNull();
				expect(issue.summary).toBe('A full issue with all fields');
				expect(issue.status).toBe('Open');
				expect(issue.priority).toBe('High');
			});

			it('201: issue created by agent appears in the issues table with correct created_by', async () => {
				const userId = await createTestUser('verify_user', 'verify@ucsd.edu');
				const teamId = await createTestTeam('Verify Team');
				const token = await createTestSession(userId);

				await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: 'Verify stored issue' }),
				});

				const issue = await env.DB.prepare('SELECT * FROM issues WHERE title = ?').bind('Verify stored issue').first();
				expect(issue).not.toBeNull();
				expect(issue.team_id).toBe(teamId);
				expect(issue.created_by).toBe(userId);
			});

			it('201: defaults status, priority, category when not provided', async () => {
				const userId = await createTestUser('default_user', 'default@ucsd.edu');
				const teamId = await createTestTeam('Default Team');
				const token = await createTestSession(userId);

				await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: 'Default fields issue' }),
				});

				const issue = await env.DB.prepare('SELECT * FROM issues WHERE title = ?').bind('Default fields issue').first();
				expect(issue.status).toBe('Open');
				expect(issue.priority).toBe('Medium');
				expect(issue.category).toBe('Bug');
			});
		});

		describe('Failure Cases', () => {
			it('401: rejects request with no Authorization header', async () => {
				const teamId = await createTestTeam('No Auth Team');

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ team_id: teamId, title: 'No auth issue' }),
				});

				expect(res.status).toBe(401);
				const data = await res.json();
				expect(data.error).toContain('Unauthorized');
			});

			it('401: rejects request with an invalid session token', async () => {
				const teamId = await createTestTeam('Bad Token Team');

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
					body: JSON.stringify({ team_id: teamId, title: 'Bad token issue' }),
				});

				expect(res.status).toBe(401);
				const data = await res.json();
				expect(data.error).toContain('Invalid session');
			});

			it('400: rejects missing title', async () => {
				const userId = await createTestUser('notitle_user', 'notitle@ucsd.edu');
				const teamId = await createTestTeam('No Title Team');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Missing required fields');
			});

			it('400: rejects missing team_id', async () => {
				const userId = await createTestUser('noteam_user', 'noteam@ucsd.edu');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ title: 'No team issue' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Missing required fields');
			});

			it('400: rejects non-numeric team_id', async () => {
				const userId = await createTestUser('badteam_user', 'badteam@ucsd.edu');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: 'abc', title: 'Bad team id' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid team_id');
			});

			it('400: rejects empty string title', async () => {
				const userId = await createTestUser('emptytitle_user', 'emptytitle@ucsd.edu');
				const teamId = await createTestTeam('Empty Title Team');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: '   ' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid title format');
			});

			it('400: rejects invalid status enum value', async () => {
				const userId = await createTestUser('badstatus_user', 'badstatus@ucsd.edu');
				const teamId = await createTestTeam('Bad Status Team');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: 'Bad status', status: 'SuperCritical' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid status');
			});

			it('400: rejects invalid priority enum value', async () => {
				const userId = await createTestUser('badpriority_user', 'badpriority@ucsd.edu');
				const teamId = await createTestTeam('Bad Priority Team');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: 'Bad priority', priority: 'Extreme' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid priority');
			});

			it('400: rejects invalid category enum value', async () => {
				const userId = await createTestUser('badcat_user', 'badcat@ucsd.edu');
				const teamId = await createTestTeam('Bad Category Team');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: 'Bad category', category: 'Exploit' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid category');
			});

			it('400: rejects non-integer token_usage', async () => {
				const userId = await createTestUser('badtoken_user', 'badtoken@ucsd.edu');
				const teamId = await createTestTeam('Bad Token Team');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: teamId, title: 'Bad token usage', token_usage: 'lots' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid token_usage');
			});

			it('400: rejects an array body', async () => {
				const userId = await createTestUser('array_user', 'array@ucsd.edu');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify([{ title: 'array body' }]),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('JSON object');
			});

			it('400: rejects invalid JSON', async () => {
				const userId = await createTestUser('badjson_user', 'badjson@ucsd.edu');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: 'not valid json {{{',
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid JSON');
			});
		});
	});

	// ==========================================
	// PATCH /agents/:id Testing
	// ==========================================
	describe('PATCH /agents/:id', () => {
		describe('Success Cases', () => {
			it('200: agent updates status of an existing issue (Integration Style)', async () => {
				const userId = await createTestUser('patch_user', 'patch@ucsd.edu');
				const teamId = await createTestTeam('Patch Team');
				const issueId = await createTestIssue(teamId, userId, 'Issue to patch');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ status: 'In Progress' }),
				});

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.success).toBe(true);
			});

			it('200: agent updates multiple allowed fields at once (Unit Style)', async () => {
				const userId = await createTestUser('multi_patch_user', 'multipatch@ucsd.edu');
				const teamId = await createTestTeam('Multi Patch Team');
				const issueId = await createTestIssue(teamId, userId, 'Multi patch issue');
				const token = await createTestSession(userId);

				const req = new Request(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({
						status: 'Resolved',
						resolution_notes: 'Fixed the null check',
						token_usage: 800,
					}),
				});
				const ctx = createExecutionContext();
				const res = await worker.fetch(req, env, ctx);
				await waitOnExecutionContext(ctx);

				expect(res.status).toBe(200);

				const issue = await env.DB.prepare('SELECT * FROM issues WHERE id = ?').bind(issueId).first();
				expect(issue.status).toBe('Resolved');
				expect(issue.resolution_notes).toBe('Fixed the null check');
				expect(issue.token_usage).toBe(800);
			});

			it('200: updated_at is refreshed after a patch', async () => {
				const userId = await createTestUser('timestamp_user', 'timestamp@ucsd.edu');
				const teamId = await createTestTeam('Timestamp Team');
				const issueId = await createTestIssue(teamId, userId, 'Timestamp issue');
				const token = await createTestSession(userId);

				const before = await env.DB.prepare('SELECT updated_at FROM issues WHERE id = ?').bind(issueId).first();

				// Wait 1 second so the updated_at timestamp is guaranteed to differ
				await new Promise((resolve) => setTimeout(resolve, 1000));

				await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ status: 'In Progress' }),
				});

				const after = await env.DB.prepare('SELECT updated_at FROM issues WHERE id = ?').bind(issueId).first();

				expect(after.updated_at).not.toBe(before.updated_at);
			});
		});

		describe('Failure Cases', () => {
			it('400: rejects a blocked field — description', async () => {
				const userId = await createTestUser('block_desc_user', 'blockdesc@ucsd.edu');
				const teamId = await createTestTeam('Block Desc Team');
				const issueId = await createTestIssue(teamId, userId, 'Block desc issue');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ description: 'agent trying to overwrite' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('description');
			});

			it('400: rejects a blocked field — assigned_to', async () => {
				const userId = await createTestUser('block_assign_user', 'blockassign@ucsd.edu');
				const teamId = await createTestTeam('Block Assign Team');
				const issueId = await createTestIssue(teamId, userId, 'Block assign issue');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ assigned_to: userId }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('assigned_to');
			});

			it('400: rejects a blocked field — team_id', async () => {
				const userId = await createTestUser('block_team_user', 'blockteam@ucsd.edu');
				const teamId = await createTestTeam('Block Team Team');
				const issueId = await createTestIssue(teamId, userId, 'Block team issue');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ team_id: 999 }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('team_id');
			});

			it('400: rejects a mix of valid and blocked fields', async () => {
				const userId = await createTestUser('mix_user', 'mix@ucsd.edu');
				const teamId = await createTestTeam('Mix Team');
				const issueId = await createTestIssue(teamId, userId, 'Mix field issue');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ status: 'Resolved', description: 'blocked' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('description');
			});

			it('400: rejects empty body', async () => {
				const userId = await createTestUser('empty_patch_user', 'emptypatch@ucsd.edu');
				const teamId = await createTestTeam('Empty Patch Team');
				const issueId = await createTestIssue(teamId, userId, 'Empty patch issue');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({}),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('No fields provided');
			});

			it('400: rejects invalid status enum on patch', async () => {
				const userId = await createTestUser('badstatus_patch_user', 'badstatuspatch@ucsd.edu');
				const teamId = await createTestTeam('Bad Status Patch Team');
				const issueId = await createTestIssue(teamId, userId, 'Bad status patch');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ status: 'SuperCritical' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid status');
			});

			it('400: rejects array body', async () => {
				const userId = await createTestUser('array_patch_user', 'arraypatch@ucsd.edu');
				const teamId = await createTestTeam('Array Patch Team');
				const issueId = await createTestIssue(teamId, userId, 'Array patch issue');
				const token = await createTestSession(userId);

				const res = await SELF.fetch(`http://localhost/agents/${issueId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify([{ status: 'Resolved' }]),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('JSON object');
			});

			it('400: rejects non-numeric id', async () => {
				const res = await SELF.fetch('http://localhost/agents/bad-id', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ status: 'Resolved' }),
				});

				expect(res.status).toBe(400);
				const data = await res.json();
				expect(data.error).toContain('Invalid issue ID format');
			});

			it('404: returns 404 when patching a non-existent issue', async () => {
				const userId = await createTestUser('notfound_patch_user', 'notfoundpatch@ucsd.edu');
				const token = await createTestSession(userId);

				const res = await SELF.fetch('http://localhost/agents/99999', {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ status: 'Resolved' }),
				});

				expect(res.status).toBe(404);
				const data = await res.json();
				expect(data.error).toContain('Issue not found');
			});
		});
	});
});
