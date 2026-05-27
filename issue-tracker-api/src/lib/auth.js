const PBKDF2_ITERATIONS = 100000;

// User session lasts for 24 hours of inactivity before they need to login again.
const SESSION_TTL_HOURS = 24;

// ----- Password hashing (Web Crypto / PBKDF2 — no external deps) -----

/**
 * Hashes a plaintext password using PBKDF2-SHA256 with a random salt.
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} A colon-separated hex string: `"<saltHex>:<hashHex>"`.
 */
export async function hashPassword(password) {
	const enc = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
	const toHex = (buf) =>
		Array.from(new Uint8Array(buf))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	return `${toHex(salt)}:${toHex(hash)}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash.
 * @param {string} password - The plaintext password to verify.
 * @param {string} stored - The stored hash string in `"<saltHex>:<hashHex>"` format.
 * @returns {Promise<boolean>} `true` if the password matches, `false` otherwise.
 */
export async function verifyPassword(password, stored) {
	const [saltHex, hashHex] = stored.split(':');
	const salt = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
	const computed = Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return computed === hashHex;
}

// ----- Session middleware -----

/**
 * Middleware that validates the Bearer token from the Authorization header.
 * Returns `{ userId }` on success or `{ error: Response }` on failure.
 * @param {Request} request - The incoming Worker request.
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 * @returns {Promise<{ userId: number } | { error: Response }>}
 */
export async function requireAuth(request, env) {
	const header = request.headers.get('Authorization');
	// reject anything that isn't a Bearer token (missing header, wrong scheme, etc.)
	if (!header?.startsWith('Bearer ')) {
		return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
	}

	const token = header.slice(7); // strip "Bearer " (7 chars) to get the raw token
	// look up the session row that matches this token, return just the user ID and expiry time to the session variable
	const session = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').bind(token).first();

	// token doesn't match any session row
	if (!session) {
		return { error: Response.json({ error: 'Invalid session' }, { status: 401 }) };
	}
	// token exists but has passed its 24hr expiry — delete it to keep the table clean
	if (new Date(session.expires_at) < new Date()) {
		await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
		return { error: Response.json({ error: 'Session expired' }, { status: 401 }) };
	}

	return { userId: session.user_id };
}

/**
 * Returns an ISO 8601 timestamp 24 hours from now, used as the session expiry.
 * @returns {string} UTC ISO string for the session expiry time.
 */
export function sessionExpiresAt() {
	const d = new Date();
	d.setHours(d.getHours() + SESSION_TTL_HOURS);
	return d.toISOString();
}
