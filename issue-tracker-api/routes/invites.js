/**
 * Handles all /invites and /teams/:teamId/invite routes (stub — not yet hitting the DB).
 * Supports GET /invites, POST /invites, DELETE /invites/:id, and POST /teams/:teamId/invite.
 * @param {Request} request - The incoming Worker request.
 * @param {unknown} _env - Worker environment (unused; stub implementation returns mock data).
 * @returns {Promise<Response>}
 *   200 — invite list (GET)
 *   201 — invite created (POST /invites or POST /teams/:teamId/invite)
 *   400 — missing required fields or invite ID
 *   404 — route not matched
 */
export async function handleInvites(request, _env) {
	const url = new URL(request.url);
	const method = request.method;

	// GET /invites
	if (url.pathname === '/invites' && method === 'GET') {
		return Response.json([
			{
				id: '1',
				team_id: 'team_1',
				email: 'test@example.com',
				role: 'member',
				status: 'pending',
				invited_by: 'user_1',
				created_at: new Date().toISOString(),
			},
		]);
	}

	// POST /invites
	if (url.pathname === '/invites' && method === 'POST') {
		const body = await request.json();

		if (!body.email || !body.team_id) {
			return Response.json({ error: 'Missing required fields: email and team_id' }, { status: 400 });
		}

		const invite = {
			id: crypto.randomUUID(),
			team_id: body.team_id,
			email: body.email,
			role: body.role || 'member',
			status: 'pending',
			invited_by: body.invited_by || null,
			created_at: new Date().toISOString(),
		};

		return Response.json(
			{
				success: true,
				invite,
			},
			{ status: 201 },
		);
	}

	// DELETE /invites/:id
	if (url.pathname.startsWith('/invites/') && method === 'DELETE') {
		const id = url.pathname.split('/')[2];

		if (!id) {
			return Response.json({ error: 'Invite ID required' }, { status: 400 });
		}

		return Response.json({
			success: true,
			deleted: id,
		});
	}

	// POST /teams/:teamId/invite
	if (url.pathname.startsWith('/teams/') && url.pathname.endsWith('/invite') && method === 'POST') {
		const parts = url.pathname.split('/');
		const teamId = parts[2];

		const body = await request.json();

		if (!teamId || !body.email) {
			return Response.json({ error: 'Missing required fields: teamId and email' }, { status: 400 });
		}

		const invite = {
			id: crypto.randomUUID(),
			team_id: teamId,
			email: body.email,
			role: body.role || 'member',
			status: 'pending',
			invited_by: body.invited_by || null,
			created_at: new Date().toISOString(),
		};

		return Response.json(
			{
				success: true,
				teamId,
				invite,
			},
			{ status: 201 },
		);
	}

	return Response.json(
		{
			error: 'Invite route not found',
		},
		{ status: 404 },
	);
}
