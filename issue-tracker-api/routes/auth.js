import { hashPassword, verifyPassword, sessionExpiresAt } from '../src/lib/auth.js';

/**
 * Handles all /auth routes: POST /auth/register, /auth/login, and /auth/logout.
 * @param {Request} request - The incoming Worker request.
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @returns {Promise<Response>}
 *   201 — user registered/logged in successfully
 *   400 — missing/invalid required fields, or no session token on logout
 *   401 — invalid credentials, invalid session token, or already-expired session
 *   409 — email or username already in use
 *   404 — route not matched
 */
export async function handleAuth(request, env) {
	const url = new URL(request.url);
	const method = request.method;

	// POST /auth/register
	// success: 201 { success: true, token, expires_at }
	if (url.pathname === '/auth/register' && method === 'POST') {
		const body = await request.json();

		// if any required field is missing, return error.
		if (!body.username || !body.email || !body.password || !body.first_name || !body.last_name) {
			return Response.json({ error: 'username, email, password, first_name, and last_name are required' }, { status: 400 });
		}

		// ensure name fields are strings before calling .trim() on them.
		if (
			typeof body.username !== 'string' ||
			typeof body.email !== 'string' ||
			typeof body.first_name !== 'string' ||
			typeof body.last_name !== 'string'
		) {
			return Response.json({ error: 'Invalid field types' }, { status: 400 });
		}

		// strip leading/trailing whitespace so " John " is treated the same as "John".
		const username = body.username.trim();
		const email = body.email.trim();
		const firstName = body.first_name.trim();
		const lastName = body.last_name.trim();

		// after trimming, re-check that fields aren't blank.
		if (!username || !email || !firstName || !lastName) {
			return Response.json({ error: 'Fields cannot be empty' }, { status: 400 });
		}

		// check if a user with that email or username already exists.
		const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? OR username = ?').bind(email, username).first();

		// if a match was found, reject to avoid duplicate accounts.
		if (existing) {
			return Response.json({ error: 'Email or username is already in use' }, { status: 409 });
		}

		// hash the password before storing, never store plaintext.
		const password_hash = await hashPassword(body.password);

		// insert the new user row and return the new user's id in the same query.
		const row = await env.DB.prepare('INSERT INTO users (username, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?) RETURNING id')
			.bind(username, firstName, lastName, email, password_hash)
			.first();

		// ----- USER SUCCESSFULLY REGISTERED AND STORED IN THE DATABASE -----

		// create new token and expiration date
		const token = crypto.randomUUID();
		const expires_at = sessionExpiresAt();

		// insert new row into the sessions table that references the new user's id.
		await env.DB.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').bind(row.id, token, expires_at).run();

		return Response.json({ success: true, token, expires_at }, { status: 201 });
	}

	// POST /auth/login
	// success: 201 { token, expires_at }
	if (url.pathname === '/auth/login' && method === 'POST') {
		const body = await request.json();

		// if email or passoword is missing return error.
		if (!body.email || !body.password) {
			return Response.json({ error: 'email and password are required' }, { status: 400 });
		}

		// look up the user row that matches the user's email, return just the user id and password hash to the user variable.
		const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(body.email).first();

		// if no user was found matching that email or password is incorrect, return error.
		if (!user || !(await verifyPassword(body.password, user.password_hash))) {
			return Response.json({ error: 'Invalid email or password' }, { status: 401 });
		}

		// create new token and expiration date
		const token = crypto.randomUUID();
		const expires_at = sessionExpiresAt();

		// insert new row into the sessions table that references the user's id.
		await env.DB.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)').bind(user.id, token, expires_at).run();

		return Response.json({ token, expires_at }, { status: 201 });
	}

	// POST /auth/logout
	// success: 200 { success: true }
	if (url.pathname === '/auth/logout' && method === 'POST') {
		// read the Authorization header to get the session token.
		const header = request.headers.get('Authorization');

		// if no Bearer token is present, there is nothing to log out.
		if (!header?.startsWith('Bearer ')) {
			return Response.json({ error: 'No session provided' }, { status: 400 });
		}

		const token = header.slice(7); // strip "Bearer " to get the raw token.

		// delete the session row, meta.changes tells us if a row was actually removed.
		const { meta } = await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();

		// if no row was deleted, the token was already invalid or expired.
		if (meta.changes === 0) {
			return Response.json({ error: 'Invalid or already expired session' }, { status: 401 });
		}

		return Response.json({ success: true });
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
