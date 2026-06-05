// Intercepts the hardcoded Cloudflare Worker URL and answers from in-memory
// state, so end-to-end tests stay deterministic and never touch production.
// The frontend's api.js calls fetch('https://issue-tracker-api.amorbuks25.workers.dev/<path>'),
// and page.route() pattern-matches that origin directly — no app code change required.

export const API_ORIGIN = 'https://issue-tracker-api.amorbuks25.workers.dev';
export const API_GLOB = `${API_ORIGIN}/**`;

/**
 * @typedef {object} MockUser
 * @property {number} id
 * @property {string} username
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} password
 */

/**
 * @typedef {object} MockTeam
 * @property {number} id
 * @property {string} team_name
 * @property {string} role
 * @property {string} [bio]
 * @property {string} created_at
 */

/**
 * @typedef {object} MockInvite
 * @property {number} id
 * @property {number} team_id
 * @property {string} team_name
 * @property {string} inviter_username
 * @property {string} status
 * @property {string} created_at
 * @property {number} [invited_user_id]
 * @property {number} [inviter_user_id]
 */

/**
 * @typedef {object} MockIssue
 * @property {number} id
 * @property {number} team_id
 * @property {string} title
 * @property {string} description
 * @property {string} status
 * @property {string} priority
 * @property {string} category
 * @property {string[]} tags
 * @property {string} [summary]
 * @property {string} [hypothesis]
 * @property {string|string[]} [steps_to_reproduce]
 * @property {string[]} [affected_files]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {object} MockState
 * @property {MockUser[]} users
 * @property {MockTeam[]} teams
 * @property {MockInvite[]} invites
 * @property {MockIssue[]} issues
 * @property {{ team_id: number, user_id: number, role: string }[]} memberships
 * @property {number} _nextId
 */

/**
 * @returns {MockState}
 */
export function createState() {
	return {
		users: [],
		teams: [],
		invites: [],
		issues: [],
		memberships: [],
		_nextId: 100,
	};
}

/**
 * @param {MockState} s
 * @returns {number}
 */
function nextId(s) {
	s._nextId += 1;
	return s._nextId;
}

/**
 * Adds a user, team, membership, optional issues + invites to the mock state in one call.
 * Returns helpful ids for chaining in the test setup.
 * @param {MockState} state
 * @param {object} opts
 * @param {string} [opts.token='test-token']
 * @param {Partial<MockUser>} [opts.user]
 * @param {Partial<MockTeam>} [opts.team]
 * @param {string} [opts.role='admin']
 * @param {MockIssue[]} [opts.issues]
 * @param {MockInvite[]} [opts.invites]
 * @returns {{ token: string, user: MockUser, team: MockTeam }}
 */
export function seed(state, opts = {}) {
	const token = opts.token ?? 'test-token';

	const user = {
		id: nextId(state),
		username: 'ada_lovelace',
		email: 'ada@example.com',
		first_name: 'Ada',
		last_name: 'Lovelace',
		password: 'analytical-engine',
		...opts.user,
	};
	state.users.push(user);
	state._token = token;
	state._tokenUserId = user.id;

	const team = {
		id: nextId(state),
		team_name: 'Studio · AI Tools',
		role: opts.role ?? 'admin',
		bio: 'Test team',
		created_at: '2025-05-01 12:00:00',
		...opts.team,
	};
	state.teams.push(team);
	state.memberships.push({ team_id: team.id, user_id: user.id, role: team.role });

	for (const issue of opts.issues ?? []) {
		state.issues.push({
			id: nextId(state),
			team_id: team.id,
			status: 'Open',
			priority: 'Medium',
			category: 'Bug',
			tags: [],
			created_at: '2025-05-15 12:00:00',
			updated_at: '2025-05-15 12:00:00',
			...issue,
		});
	}

	for (const invite of opts.invites ?? []) {
		state.invites.push({
			id: nextId(state),
			team_id: invite.team_id ?? team.id,
			team_name: invite.team_name ?? team.team_name,
			inviter_username: 'admin_user',
			status: 'pending',
			created_at: '2025-05-20 09:00:00',
			invited_user_id: user.id,
			...invite,
		});
	}

	return { token, user, team };
}

/**
 * Inject the auth token + user profile into localStorage before any module script
 * runs. Required because login.js / requireAuth gate on `allegro_token` immediately.
 * @param {import('@playwright/test').Page} page
 * @param {{ token: string, user: MockUser }} session
 */
export async function setAuthStorage(page, session) {
	// Init scripts run on EVERY navigation. If we unconditionally write the auth
	// keys, a sign-out flow that clears localStorage and redirects to login.html
	// would immediately get the token written back — breaking the test (and not
	// reflecting real user behaviour). A sessionStorage marker scopes the
	// injection to the first page load only; sessionStorage persists across same-
	// tab navigations and reloads, so subsequent navigations see the flag and
	// skip re-writing.
	await page.addInitScript(
		({ token, user }) => {
			try {
				if (sessionStorage.getItem('__pw_auth_injected__') === '1') return;
				localStorage.setItem('allegro_token', token);
				localStorage.setItem('allegro_token_expires', new Date(Date.now() + 86400000).toISOString());
				localStorage.setItem(
					'allegro_user',
					JSON.stringify({
						first_name: user.first_name,
						last_name: user.last_name,
						username: user.username,
						email: user.email,
						initials: (user.first_name[0] + user.last_name[0]).toUpperCase(),
						name: `${user.first_name} ${user.last_name}`,
					}),
				);
				sessionStorage.setItem('__pw_auth_injected__', '1');
			} catch {
				/* localStorage unavailable */
			}
		},
		{ token: session.token, user: session.user },
	);
}

/**
 * @param {import('@playwright/test').Route} route
 * @param {number} status
 * @param {object} body
 */
function json(route, status, body) {
	return route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body),
	});
}

/**
 * Wires up a Playwright route handler that emulates the Cloudflare Worker
 * against the supplied in-memory state. Tests can mutate `state` between
 * requests to control behaviour.
 * @param {import('@playwright/test').Page} page
 * @param {MockState} state
 */
export async function installApiMocks(page, state) {
	await page.route(API_GLOB, async (route) => {
		const req = route.request();
		const url = new URL(req.url());
		const path = url.pathname;
		const method = req.method();

		if (method === 'OPTIONS') {
			return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
		}

		const auth = req.headers()['authorization'];
		const requireAuth = () => {
			if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== state._token) {
				json(route, 401, { error: 'Unauthorized' });
				return null;
			}
			return state._tokenUserId;
		};

		// --- AUTH ---
		if (path === '/auth/login' && method === 'POST') {
			const body = await req.postDataJSON();
			const user = state.users.find((u) => u.email === body.email && u.password === body.password);
			if (!user) return json(route, 401, { error: 'Invalid email or password' });
			state._token = state._token || 'test-token';
			state._tokenUserId = user.id;
			return json(route, 200, {
				token: state._token,
				expires_at: new Date(Date.now() + 86400000).toISOString(),
				user: {
					username: user.username,
					email: user.email,
					first_name: user.first_name,
					last_name: user.last_name,
				},
			});
		}

		if (path === '/auth/register' && method === 'POST') {
			const body = await req.postDataJSON();
			if (!body.username || !body.email || !body.password || !body.first_name || !body.last_name) {
				return json(route, 400, { error: 'Missing fields' });
			}
			if (state.users.find((u) => u.email === body.email || u.username === body.username)) {
				return json(route, 409, { error: 'Email or username is already in use' });
			}
			const user = {
				id: nextId(state),
				username: body.username,
				email: body.email,
				first_name: body.first_name,
				last_name: body.last_name,
				password: body.password,
			};
			state.users.push(user);
			state._token = 'test-token';
			state._tokenUserId = user.id;
			return json(route, 201, {
				success: true,
				token: state._token,
				expires_at: new Date(Date.now() + 86400000).toISOString(),
				user: {
					username: user.username,
					email: user.email,
					first_name: user.first_name,
					last_name: user.last_name,
				},
			});
		}

		if (path === '/auth/logout' && method === 'POST') {
			state._token = null;
			state._tokenUserId = null;
			return json(route, 200, { success: true });
		}

		if (path === '/auth/validate' && method === 'GET') {
			if (requireAuth() === null) return;
			return json(route, 200, { valid: true });
		}

		// --- TEAMS ---
		if (path === '/teams' && method === 'GET') {
			if (requireAuth() === null) return;
			const userId = state._tokenUserId;
			const teams = state.memberships
				.filter((m) => m.user_id === userId)
				.map((m) => {
					const t = state.teams.find((x) => x.id === m.team_id);
					return t ? { ...t, role: m.role } : null;
				})
				.filter(Boolean);
			return json(route, 200, teams);
		}

		if (path === '/teams' && method === 'POST') {
			if (requireAuth() === null) return;
			const body = await req.postDataJSON();
			if (!body.team_name || !body.team_name.trim()) {
				return json(route, 400, { error: 'team_name is required' });
			}
			const team = {
				id: nextId(state),
				team_name: body.team_name.trim(),
				role: 'admin',
				bio: body.bio ?? null,
				created_at: new Date().toISOString(),
			};
			state.teams.push(team);
			state.memberships.push({
				team_id: team.id,
				user_id: state._tokenUserId,
				role: 'admin',
			});
			return json(route, 201, { success: true, team_id: team.id });
		}

		const teamMatch = path.match(/^\/teams\/(\d+)(?:\/(\w+)(?:\/(\d+))?)?$/);
		if (teamMatch) {
			const teamId = Number(teamMatch[1]);
			const sub = teamMatch[2];

			if (!sub && method === 'GET') {
				if (requireAuth() === null) return;
				const team = state.teams.find((t) => t.id === teamId);
				if (!team) return json(route, 404, { error: 'Team not found' });
				return json(route, 200, team);
			}

			if (sub === 'members' && method === 'GET') {
				if (requireAuth() === null) return;
				const members = state.memberships
					.filter((m) => m.team_id === teamId)
					.map((m) => {
						const u = state.users.find((x) => x.id === m.user_id);
						return u
							? {
									id: u.id,
									username: u.username,
									email: u.email,
									first_name: u.first_name,
									last_name: u.last_name,
									role: m.role,
								}
							: null;
					})
					.filter(Boolean);
				return json(route, 200, members);
			}

			if (sub === 'invite' && method === 'POST') {
				if (requireAuth() === null) return;
				const body = await req.postDataJSON();
				const invitee = state.users.find((u) => u.username === body.username || u.email === body.email);
				if (!invitee) return json(route, 404, { error: 'User not found' });
				if (state.memberships.find((m) => m.team_id === teamId && m.user_id === invitee.id)) {
					return json(route, 409, { error: 'User already in team' });
				}
				if (state.invites.find((i) => i.team_id === teamId && i.invited_user_id === invitee.id && i.status === 'pending')) {
					return json(route, 409, { error: 'Pending invite already exists' });
				}
				const team = state.teams.find((t) => t.id === teamId);
				const inviter = state.users.find((u) => u.id === state._tokenUserId);
				const invite = {
					id: nextId(state),
					team_id: teamId,
					team_name: team?.team_name ?? 'Team',
					inviter_username: inviter?.username ?? 'inviter',
					status: 'pending',
					invited_user_id: invitee.id,
					inviter_user_id: state._tokenUserId,
					created_at: new Date().toISOString(),
				};
				state.invites.push(invite);
				return json(route, 201, { success: true, invite_id: invite.id });
			}

			if (sub === 'leave' && method === 'DELETE') {
				if (requireAuth() === null) return;
				state.memberships = state.memberships.filter((m) => !(m.team_id === teamId && m.user_id === state._tokenUserId));
				return json(route, 200, { success: true, message: 'Left team' });
			}
		}

		// --- INVITES ---
		if (path === '/invites' && method === 'GET') {
			if (requireAuth() === null) return;
			const userId = state._tokenUserId;
			const invites = state.invites.filter((i) => i.invited_user_id === userId && i.status === 'pending');
			return json(route, 200, invites);
		}

		const inviteMatch = path.match(/^\/invites\/(\d+)(?:\/(\w+))?$/);
		if (inviteMatch) {
			const inviteId = Number(inviteMatch[1]);
			const action = inviteMatch[2];
			const invite = state.invites.find((i) => i.id === inviteId);

			if (action === 'accept' && method === 'PATCH') {
				if (requireAuth() === null) return;
				if (!invite) return json(route, 404, { error: 'Invite not found' });
				if (invite.invited_user_id !== state._tokenUserId) return json(route, 403, { error: 'Forbidden' });
				if (invite.status !== 'pending') return json(route, 409, { error: 'Invite already handled' });
				invite.status = 'accepted';
				const team = state.teams.find((t) => t.id === invite.team_id);
				if (team && !state.memberships.find((m) => m.team_id === invite.team_id && m.user_id === state._tokenUserId)) {
					state.memberships.push({
						team_id: invite.team_id,
						user_id: state._tokenUserId,
						role: 'member',
					});
				}
				return json(route, 200, { success: true, message: 'Invite accepted' });
			}

			if (action === 'reject' && method === 'PATCH') {
				if (requireAuth() === null) return;
				if (!invite) return json(route, 404, { error: 'Invite not found' });
				invite.status = 'declined';
				return json(route, 200, { success: true, message: 'Invite declined' });
			}
		}

		// --- ISSUES ---
		if (path === '/issues' && method === 'GET') {
			if (requireAuth() === null) return;
			const teamIdParam = Number(url.searchParams.get('team_id'));
			if (!teamIdParam) return json(route, 400, { error: 'team_id required' });
			const issues = state.issues
				.filter((i) => i.team_id === teamIdParam)
				.map((i) => ({
					...i,
					tags: Array.isArray(i.tags) ? i.tags : [],
					affected_files: i.affected_files ?? [],
				}));
			return json(route, 200, issues);
		}

		if (path === '/issues' && method === 'POST') {
			if (requireAuth() === null) return;
			let body;
			const ct = req.headers()['content-type'] ?? '';
			if (ct.includes('multipart/form-data')) {
				const raw = req.postData() ?? '';
				const get = (name) => {
					const re = new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`);
					const m = raw.match(re);
					return m ? m[1] : null;
				};
				body = {
					title: get('title'),
					description: get('description'),
					team_id: Number(get('team_id')),
					priority: get('priority'),
					category: get('category'),
					tags: get('tags'),
				};
			} else {
				body = await req.postDataJSON();
			}

			if (!body.title || !body.description || !body.team_id) {
				return json(route, 400, {
					error: 'title, team_id, and description are required',
				});
			}

			const issue = {
				id: nextId(state),
				team_id: Number(body.team_id),
				title: body.title,
				description: body.description,
				summary: `Summary of ${body.title}`,
				status: 'Open',
				priority: body.priority || 'Medium',
				category: body.category || 'Bug',
				tags: body.tags ? String(body.tags).split(',').filter(Boolean) : [],
				steps_to_reproduce: null,
				hypothesis: null,
				affected_files: [],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
			state.issues.push(issue);
			return json(route, 201, {
				success: true,
				id: issue.id,
				enriched: {
					summary: issue.summary,
					status: issue.status,
					priority: issue.priority,
					category: issue.category,
					tags: issue.tags,
				},
			});
		}

		const issueMatch = path.match(/^\/issues\/(\d+)$/);
		if (issueMatch) {
			const id = Number(issueMatch[1]);
			const issue = state.issues.find((i) => i.id === id);

			if (method === 'PATCH') {
				if (requireAuth() === null) return;
				if (!issue) return json(route, 404, { error: 'Issue not found' });
				const body = await req.postDataJSON();
				Object.assign(issue, body, { updated_at: new Date().toISOString() });
				return json(route, 200, { success: true });
			}
			if (method === 'DELETE') {
				if (requireAuth() === null) return;
				if (!issue) return json(route, 404, { error: 'Issue not found' });
				state.issues = state.issues.filter((i) => i.id !== id);
				return json(route, 200, { success: true });
			}
			if (method === 'GET') {
				if (requireAuth() === null) return;
				if (!issue) return json(route, 404, { error: 'Issue not found' });
				return json(route, 200, issue);
			}
		}

		// Unhandled — surface as a clear 404 so tests fail fast instead of hanging.
		return json(route, 404, { error: `mock-api: unhandled ${method} ${path}` });
	});
}

/**
 * Convenience wrapper that creates fresh state, seeds it with options, mocks
 * the API, and (when seed-supplied) injects auth into localStorage.
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts] - Forwarded to seed(). Pass `noAuth: true` to skip seeding entirely.
 * @returns {Promise<{ state: MockState, session: { token: string, user: MockUser, team: MockTeam } | null }>}
 */
export async function setupApp(page, opts = {}) {
	const state = createState();
	let session = null;
	if (!opts.noAuth) {
		session = seed(state, opts);
		await setAuthStorage(page, session);
	}
	await installApiMocks(page, state);
	return { state, session };
}
