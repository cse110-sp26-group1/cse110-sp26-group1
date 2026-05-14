import { hashPassword, verifyPassword, sessionExpiresAt } from '../src/lib/auth.js';

export async function handleAuth(request, env) {
	const url = new URL(request.url);
	const method = request.method;

	// POST /auth/register
	if (url.pathname === '/auth/register' && method === 'POST') {
		const body = await request.json();

		if (!body.username || !body.email || !body.password) {
			return Response.json({ error: 'username, email, and password are required' }, { status: 400 });
		}

		const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ? OR username = ?')
			.bind(body.email, body.username)
			.first();

		if (existing) {
			return Response.json({ error: 'Email or username already in use' }, { status: 409 });
		}

		const password_hash = await hashPassword(body.password);
		const { success } = await env.DB.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
			.bind(body.username, body.email, password_hash)
			.run();

		return Response.json({ success }, { status: 201 });
	}

	// POST /auth/login
	if (url.pathname === '/auth/login' && method === 'POST') {
		const body = await request.json();

		if (!body.email || !body.password) {
			return Response.json({ error: 'email and password are required' }, { status: 400 });
		}

		const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(body.email).first();

		if (!user || !(await verifyPassword(body.password, user.password_hash))) {
			return Response.json({ error: 'Invalid email or password' }, { status: 401 });
		}

		const token = crypto.randomUUID();
		const expires_at = sessionExpiresAt();

		await env.DB.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
			.bind(user.id, token, expires_at)
			.run();

		return Response.json({ token, expires_at });
	}

	// POST /auth/logout
	if (url.pathname === '/auth/logout' && method === 'POST') {
		const header = request.headers.get('Authorization');
		if (!header?.startsWith('Bearer ')) {
			return Response.json({ error: 'No session provided' }, { status: 400 });
		}

		const token = header.slice(7);
		const { meta } = await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();

		if (meta.changes === 0) {
			return Response.json({ error: 'Invalid or already expired session' }, { status: 401 });
		}

		return Response.json({ success: true });
	}

	return Response.json({ error: 'Not Found' }, { status: 404 });
}
