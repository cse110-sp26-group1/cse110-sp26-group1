const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_HOURS = 24;

// ----- Password hashing (Web Crypto / PBKDF2 — no external deps) -----

export async function hashPassword(password) {
	const enc = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const hash = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		key,
		256,
	);
	const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
	return `${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password, stored) {
	const [saltHex, hashHex] = stored.split(':');
	const salt = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const hash = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		key,
		256,
	);
	const computed = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
	return computed === hashHex;
}

// ----- Session middleware -----

export async function requireAuth(request, env) {
	const header = request.headers.get('Authorization');
	if (!header?.startsWith('Bearer ')) {
		return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
	}

	const token = header.slice(7);
	const session = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').bind(token).first();

	if (!session) {
		return { error: Response.json({ error: 'Invalid session' }, { status: 401 }) };
	}
	if (new Date(session.expires_at) < new Date()) {
		await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
		return { error: Response.json({ error: 'Session expired' }, { status: 401 }) };
	}

	return { userId: session.user_id };
}

export function sessionExpiresAt() {
	const d = new Date();
	d.setHours(d.getHours() + SESSION_TTL_HOURS);
	return d.toISOString();
}
