import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import worker from '../src';
import sqlSchemaRaw from '../schema.sql?raw';

const REGISTER_URL = 'http://localhost/auth/register';
const LOGIN_URL = 'http://localhost/auth/login';
const LOGOUT_URL = 'http://localhost/auth/logout';

const VALID_USER = {
	username: 'jdoe',
	email: 'jdoe@example.com',
	password: 'secret123',
	first_name: 'John',
	last_name: 'Doe',
};

// --- SEED HELPERS ---

/**
 * Sends a POST /auth/register request using VALID_USER merged with any overrides.
 * Pass a field as undefined to omit it from the request body entirely.
 * @param {Partial<typeof VALID_USER>} overrides - Fields to override or omit from the default user.
 * @returns {Promise<Response>}
 */
async function registerUser(overrides = {}) {
	// spread VALID_USER first, then overrides duplicate keys from overrides win.
	return SELF.fetch(REGISTER_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...VALID_USER, ...overrides }),
	});
}

/**
 * Registers VALID_USER and returns the session token from the response.
 * Use this to seed an authenticated session before testing login/logout flows.
 * @returns {Promise<string>} The session token.
 */
async function getToken() {
	// register a fresh user and pull the token out of the 201 response.
	const res = await registerUser();
	const data = await res.json();
	return data.token;
}

// top-level suite that groups all /auth route tests.
describe('Auth Endpoint Testing Suite', () => {
	// runs once before any test, initializes the temporary D1 test database with the schema.
	beforeAll(async () => {
		const cleanSql = sqlSchemaRaw
			.split('\n')
			.map((line) => line.split('--')[0].trim())
			.filter((line) => line.length > 0)
			.join(' ');

		await env.DB.exec(cleanSql);
	});

	// runs before each individual test, wipes all tables so every test starts with a clean state.
	beforeEach(async () => {
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
	// POST /auth/register Testing
	// ==========================================
	describe('POST /auth/register', () => {
		describe('Success Cases', () => {
			// Test return values
			it('returns success: true, a non-empty token, and a non-empty expires_at on valid input', async () => {
				// response object from the POST /auth/register request
				const res = await registerUser();
				expect(res.status).toBe(201);

				// json data from response object
				const data = await res.json();

				// check if success is true
				expect(data.success).toBe(true);

				// check if token is a non-empty string
				expect(typeof data.token).toBe('string');
				expect(data.token.length).toBeGreaterThan(0);

				// check if the expires_at field is a non-empty string
				expect(typeof data.expires_at).toBe('string');
				expect(data.expires_at.length).toBeGreaterThan(0);
			});

			// Tests session row insertion
			it('inserts a session row into the DB matching the returned token', async () => {
				// response object from the POST /auth/register request
				const res = await registerUser();
				// make sure registration succeeded before touching DB
				expect(res.status).toBe(201);

				// token from response
				const { token } = await res.json();

				// find session that matches the token and check it exists
				const session = await env.DB.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
				expect(session).not.toBeNull();
			});

			it('inserts a session row with the correct token, user_id, and a future expires_at', async () => {
				const res = await registerUser();
				expect(res.status).toBe(201);

				const { token, expires_at } = await res.json();

				// look up the session row by token
				const session = await env.DB.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
				expect(session).not.toBeNull();

				// token in DB matches what was returned in the response
				expect(session.token).toBe(token);

				// user_id in session references a real user in the users table
				const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(VALID_USER.email).first();
				expect(session.user_id).toBe(user.id);

				// expires_at in DB matches what was returned in the response
				expect(session.expires_at).toBe(expires_at);
			});

			// Tests user row insertion
			it('writes the correct username, first_name, last_name, and email to the users table', async () => {
				const res = await registerUser();
				expect(res.status).toBe(201);

				// confirm the user row was written with the correct field values.
				const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(VALID_USER.email).first();
				expect(user).not.toBeNull();
				expect(user.username).toBe(VALID_USER.username);
				expect(user.first_name).toBe(VALID_USER.first_name);
				expect(user.last_name).toBe(VALID_USER.last_name);
				expect(user.email).toBe(VALID_USER.email);
				// confirm password_hash field is populated (not testing hashing behavior, just that it was written)
				expect(user.password_hash).not.toBeNull();
			});

			// Tests safe password storing
			it('stores a hashed password, not the plaintext, in the users table', async () => {
				const res = await registerUser();
				expect(res.status).toBe(201);

				// password_hash must never equal the raw password, confirms hashing ran.
				const user = await env.DB.prepare('SELECT password_hash FROM users WHERE email = ?').bind(VALID_USER.email).first();
				expect(user.password_hash).not.toBe(VALID_USER.password);
			});

			// Tests for password length
			it('passes with password that is exactly 8 characters', async () => {
				const res = await registerUser({ password: 'abc12345' });
				expect(res.status).toBe(201);
			});

			it('passes with password that is greater than 8 characters', async () => {
				const res = await registerUser({ password: 'abc123456' });
				expect(res.status).toBe(201);
			});

			// Tests token expiration date is valid
			it('returns an expires_at timestamp set in the future', async () => {
				const res = await registerUser();
				expect(res.status).toBe(201);

				const { expires_at } = await res.json();
				// expires_at comes back as an ISO string, confirm it's ahead of now.
				expect(new Date(expires_at).getTime()).toBeGreaterThan(Date.now());
			});
		});

		describe('Failure Cases', () => {
			// Tests missing user row values
			it('400: rejects when username is missing', async () => {
				const res = await registerUser({ username: undefined });
				expect(res.status).toBe(400);
			});

			it('400: rejects when first_name is missing', async () => {
				const res = await registerUser({ first_name: undefined });
				expect(res.status).toBe(400);
			});

			it('400: rejects when last_name is missing', async () => {
				const res = await registerUser({ last_name: undefined });
				expect(res.status).toBe(400);
			});

			it('400: rejects when email is missing', async () => {
				const res = await registerUser({ email: undefined });
				expect(res.status).toBe(400);
			});

			it('400: rejects when password is missing', async () => {
				const res = await registerUser({ password: undefined });
				expect(res.status).toBe(400);
			});

			// Tests blank(white-space) user row values
			it('400: rejects whitespace-only username', async () => {
				const res = await registerUser({ username: '   ' });
				expect(res.status).toBe(400);
			});

			it('400: rejects whitespace-only first_name', async () => {
				const res = await registerUser({ first_name: '   ' });
				expect(res.status).toBe(400);
			});

			it('400: rejects whitespace-only last_name', async () => {
				const res = await registerUser({ last_name: '   ' });
				expect(res.status).toBe(400);
			});

			it('400: rejects whitespace-only email', async () => {
				const res = await registerUser({ email: '   ' });
				expect(res.status).toBe(400);
			});

			it('400: rejects whitespace-only password', async () => {
				const res = await registerUser({ password: '         ' });
				expect(res.status).toBe(400);
			});

			// Tests non-string user row values
			it('400: rejects non-string username', async () => {
				const res = await registerUser({ username: 123 });
				expect(res.status).toBe(400);
			});

			it('400: rejects non-string first_name', async () => {
				const res = await registerUser({ first_name: 123 });
				expect(res.status).toBe(400);
			});

			it('400: rejects non-string last_name', async () => {
				const res = await registerUser({ last_name: 123 });
				expect(res.status).toBe(400);
			});

			it('400: rejects non-string email', async () => {
				const res = await registerUser({ email: 12345678 });
				expect(res.status).toBe(400);
			});

			it('400: rejects non-string password', async () => {
				const res = await registerUser({ password: 12345678 });
				expect(res.status).toBe(400);
			});

			// Tests invalid password length
			it('400: rejects password shorter than 8 characters', async () => {
				const res = await registerUser({ password: 'abc' });
				expect(res.status).toBe(400);
			});

			it('400: rejects password that is exactly 7 characters', async () => {
				const res = await registerUser({ password: 'abc1234' });
				expect(res.status).toBe(400);
			});

			// Tests duplicate username or email
			it('409: rejects duplicate email', async () => {
				await registerUser();
				const res = await registerUser({ username: 'jdoe2' }); // different username, same email
				expect(res.status).toBe(409);
			});

			it('409: rejects duplicate username', async () => {
				await registerUser();
				const res = await registerUser({ email: 'other@example.com' }); // different email, same username
				expect(res.status).toBe(409);
			});

			// Tests that no session row is inserted when registration fails
			it('does not insert a session row when a required field is missing', async () => {
				await registerUser({ username: undefined });

				// no user was created, so no session should exist in the DB
				const sessions = await env.DB.prepare('SELECT * FROM sessions').all();
				expect(sessions.results.length).toBe(0);
			});

			it('does not insert a session row when registration is rejected for duplicate email', async () => {
				await registerUser(); // first registration succeeds
				await registerUser({ username: 'jdoe2' }); // duplicate email, should fail

				// only one session should exist (from the first successful registration)
				const sessions = await env.DB.prepare('SELECT * FROM sessions').all();
				expect(sessions.results.length).toBe(1);
			});

			// Tests that no user row is inserted when registration fails
			it('does not insert a user row when a required field is missing', async () => {
				await registerUser({ email: undefined });

				// no user should be in the DB
				const users = await env.DB.prepare('SELECT * FROM users').all();
				expect(users.results.length).toBe(0);
			});
		});
	});

	// ==========================================
	// POST /auth/login Testing
	// ==========================================
	describe('POST /auth/login', () => {
		describe('Success Cases', () => {
			// Tests return values
			it('returns a non-empty token and expires_at on valid credentials', async () => {
				// seed a user to log in with
				await registerUser();

				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: VALID_USER.email, password: VALID_USER.password }),
				});

				expect(res.status).toBe(200);

				const data = await res.json();

				// check token is a non-empty string
				expect(typeof data.token).toBe('string');
				expect(data.token.length).toBeGreaterThan(0);

				// check expires_at is a non-empty string
				expect(typeof data.expires_at).toBe('string');
				expect(data.expires_at.length).toBeGreaterThan(0);
			});

			// Tests session row insertion
			it('inserts a session row into the DB matching the returned token', async () => {
				await registerUser();

				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: VALID_USER.email, password: VALID_USER.password }),
				});
				expect(res.status).toBe(200);

				const { token } = await res.json();
				// find session that matches the token and check it exists
				const session = await env.DB.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
				expect(session).not.toBeNull();
			});

			// Tests token expiration date is valid
			it('returns an expires_at timestamp set in the future', async () => {
				await registerUser();

				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: VALID_USER.email, password: VALID_USER.password }),
				});
				expect(res.status).toBe(200);

				const { expires_at } = await res.json();
				// expires_at comes back as an ISO string — confirm it's ahead of now.
				expect(new Date(expires_at).getTime()).toBeGreaterThan(Date.now());
			});
		});

		describe('Failure Cases', () => {
			// Tests when email or password is missing
			it('400: rejects when email is missing', async () => {
				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ password: VALID_USER.password }),
				});
				expect(res.status).toBe(400);
			});

			it('400: rejects when password is missing', async () => {
				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: VALID_USER.email }),
				});
				expect(res.status).toBe(400);
			});

			// Tests for non-string field types
			it('400: rejects non-string email', async () => {
				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: 123, password: VALID_USER.password }),
				});
				expect(res.status).toBe(400);
			});

			it('400: rejects non-string password', async () => {
				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: VALID_USER.email, password: 12345678 }),
				});
				expect(res.status).toBe(400);
			});

			// Tests for whitespace-only email
			it('400: rejects whitespace-only email', async () => {
				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: '   ', password: VALID_USER.password }),
				});
				expect(res.status).toBe(400);
			});

			// Tests when password is incorrect
			it('401: rejects wrong password', async () => {
				await registerUser();

				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: VALID_USER.email, password: 'wrongpassword' }),
				});
				expect(res.status).toBe(401);
			});

			// Tests when email does not exits
			it('401: rejects email that does not exist', async () => {
				const res = await SELF.fetch(LOGIN_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: 'nobody@example.com', password: 'secret123' }),
				});
				expect(res.status).toBe(401);
			});
		});
	});

	// ==========================================
	// POST /auth/logout Testing
	// ==========================================
	describe('POST /auth/logout', () => {
		describe('Success Cases', () => {
			// Test successsful session deletion
			it('logs out and deletes the session', async () => {
				const token = await getToken();

				const res = await SELF.fetch(LOGOUT_URL, {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
				});

				expect(res.status).toBe(200);
				const data = await res.json();
				expect(data.success).toBe(true);

				// session should be gone from DB
				const session = await env.DB.prepare('SELECT * FROM sessions WHERE token = ?').bind(token).first();
				expect(session).toBeNull();
			});
		});

		describe('Failure Cases', () => {
			// Tests for missing token
			it('400: rejects request with no Authorization header', async () => {
				const res = await SELF.fetch(LOGOUT_URL, { method: 'POST' });
				expect(res.status).toBe(400);
			});

			// Tests for invalid token
			it('400: rejects malformed Authorization header', async () => {
				const res = await SELF.fetch(LOGOUT_URL, {
					method: 'POST',
					headers: { Authorization: 'notavalidtoken' },
				});
				expect(res.status).toBe(400);
			});

			// Tests for tokens that don't exist or are already invalidated
			it('401: rejects an invalid token not in the DB', async () => {
				const res = await SELF.fetch(LOGOUT_URL, {
					method: 'POST',
					headers: { Authorization: 'Bearer fake-token-that-does-not-exist' },
				});
				expect(res.status).toBe(401);
			});

			// Tests for logout with deleted token
			it('401: rejects the same token twice (already logged out)', async () => {
				const token = await getToken();

				await SELF.fetch(LOGOUT_URL, {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
				});

				// second logout with same token
				const res = await SELF.fetch(LOGOUT_URL, {
					method: 'POST',
					headers: { Authorization: `Bearer ${token}` },
				});
				expect(res.status).toBe(401);
			});
		});
	});
});
