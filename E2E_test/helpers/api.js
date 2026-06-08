// E2E test helpers. Talks to a running Cloudflare Worker (defaults to
// http://127.0.0.1:8787 via local Wrangler + D1) over real HTTP. No fetch
// interception: configureApiPage() / setBrowserSession() flip
// window.__ALLEGRO_API_BASE__ so the frontend's resolveApiBase() picks up the
// override transparently, and tests then drive the UI normally.

const DEFAULT_API_BASE = 'http://127.0.0.1:8787';

export const API_BASE = trimApiBase(process.env.E2E_API_BASE || DEFAULT_API_BASE);

/**
 * Removes trailing slashes from an API origin.
 * @param {string} value API origin.
 * @returns {string} Normalized API origin.
 */
function trimApiBase(value) {
	return String(value).replace(/\/+$/, '');
}

/**
 * Creates a unique user payload suitable for backend registration.
 * @param {string} prefix Short label to make test artifacts easier to identify.
 * @returns {{ username: string, first_name: string, last_name: string, email: string, password: string }}
 */
export function makeUniqueUser(prefix = 'user') {
	const safePrefix =
		prefix
			.replace(/[^a-z0-9_]/gi, '')
			.toLowerCase()
			.slice(0, 18) || 'user';
	const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

	return {
		username: `e2e_${safePrefix}_${suffix}`,
		first_name: 'E2E',
		last_name: safePrefix.charAt(0).toUpperCase() + safePrefix.slice(1),
		email: `e2e-${safePrefix}-${suffix}@example.test`,
		password: 'e2e-password-123',
	};
}

/**
 * Creates a unique team name for E2E tests.
 * @param {string} prefix Human-readable prefix.
 * @returns {string} Unique team name.
 */
export function makeUniqueTeamName(prefix = 'E2E Team') {
	const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
	return `${prefix} ${suffix}`;
}

/**
 * Creates a unique issue title for E2E tests.
 * @param {string} prefix Human-readable prefix.
 * @returns {string} Unique issue title.
 */
export function makeUniqueIssueTitle(prefix = 'E2E Issue') {
	const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
	return `${prefix} ${suffix}`;
}

/**
 * Sends a JSON request to the configured API.
 * @param {string} path API path beginning with "/".
 * @param {{ method?: string, token?: string, body?: object }} [options] Request options.
 * @returns {Promise<unknown>} Parsed JSON response, or null for empty responses.
 */
export async function apiRequest(path, options = {}) {
	const headers = {};
	const request = {
		method: options.method || 'GET',
		headers,
	};

	if (options.token) {
		headers.Authorization = `Bearer ${options.token}`;
	}

	if (options.body !== undefined) {
		headers['Content-Type'] = 'application/json';
		request.body = JSON.stringify(options.body);
	}

	let response;
	try {
		response = await fetch(new URL(path, `${API_BASE}/`), request);
	} catch (error) {
		throw new Error(`Could not reach API at ${API_BASE}: ${error.message}`);
	}

	const text = await response.text();
	let payload = null;
	if (text) {
		try {
			payload = JSON.parse(text);
		} catch {
			payload = text;
		}
	}

	if (!response.ok) {
		const message =
			typeof payload === 'object' && payload !== null
				? payload.error || payload.message || `API Error: ${response.status} ${response.statusText}`
				: payload || `API Error: ${response.status} ${response.statusText}`;
		const error = new Error(message);
		error.status = response.status;
		error.body = payload;
		throw error;
	}

	return payload;
}

/**
 * Builds the browser localStorage profile object from an API session.
 * @param {{ credentials: object, user?: object }} session Authenticated session.
 * @returns {{ first_name: string, last_name: string, username: string, email: string, initials: string, name: string }}
 */
function storageUser(session) {
	const firstName = session.user?.first_name || session.credentials.first_name;
	const lastName = session.user?.last_name || session.credentials.last_name;
	const username = session.user?.username || session.credentials.username;
	const email = session.user?.email || session.credentials.email;

	return {
		first_name: firstName,
		last_name: lastName,
		username,
		email,
		initials: `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase(),
		name: `${firstName} ${lastName}`,
	};
}

/**
 * Converts a backend auth payload into the session shape used by tests.
 * @param {object} credentials Registered/login credentials.
 * @param {object} response Backend auth response.
 * @returns {{ token: string, expires_at: string, credentials: object, user: object }}
 */
function buildSession(credentials, response) {
	return {
		token: response.token,
		expires_at: response.expires_at,
		credentials,
		user: response.user,
	};
}

/**
 * Registers a unique user against the backend.
 * @param {object} [overrides] Optional credential overrides.
 * @returns {Promise<{ token: string, expires_at: string, credentials: object, user: object }>} Authenticated session.
 */
export async function registerUser(overrides = {}) {
	const credentials = { ...makeUniqueUser(), ...overrides };
	const response = await apiRequest('/auth/register', {
		method: 'POST',
		body: credentials,
	});

	return buildSession(credentials, response);
}

/**
 * Creates a team through the backend.
 * @param {{ token: string }} session Authenticated admin session.
 * @param {{ team_name?: string, bio?: string }} [overrides] Team fields.
 * @returns {Promise<{ id: number, team_name: string, bio: string | null }>} Created team.
 */
export async function createTeam(session, overrides = {}) {
	const body = {
		team_name: overrides.team_name || makeUniqueTeamName(),
	};

	if (overrides.bio !== undefined) {
		body.bio = overrides.bio;
	}

	const response = await apiRequest('/teams', {
		method: 'POST',
		token: session.token,
		body,
	});

	return {
		id: Number(response.team_id),
		team_name: body.team_name,
		bio: body.bio || null,
	};
}

/**
 * Deletes a team through the backend.
 * @param {{ token: string }} session Authenticated admin session.
 * @param {number} teamId Team id.
 * @returns {Promise<unknown>} Delete response.
 */
export async function deleteTeam(session, teamId) {
	return apiRequest(`/teams/${teamId}`, {
		method: 'DELETE',
		token: session.token,
	});
}

/**
 * Best-effort team cleanup that ignores already-cleaned teams.
 * @param {{ token: string }} session Authenticated admin session.
 * @param {number} teamId Team id.
 * @returns {Promise<void>}
 */
export async function safeDeleteTeam(session, teamId) {
	try {
		await deleteTeam(session, teamId);
	} catch (error) {
		if (![403, 404].includes(error.status)) {
			throw error;
		}
	}
}

/**
 * Fetches the teams that the authenticated user belongs to.
 * @param {{ token: string }} session Authenticated session.
 * @returns {Promise<Array>} Team rows.
 */
export async function fetchTeams(session) {
	return apiRequest('/teams', { token: session.token });
}

/**
 * Fetches team members.
 * @param {{ token: string }} session Authenticated session.
 * @param {number} teamId Team id.
 * @returns {Promise<Array>} Team members.
 */
export async function fetchTeamMembers(session, teamId) {
	return apiRequest(`/teams/${teamId}/members`, {
		token: session.token,
	});
}

/**
 * Updates a team member's role through the backend.
 * @param {{ token: string }} session Authenticated admin session.
 * @param {number} teamId Team id.
 * @param {number} userId Member user id.
 * @param {'admin' | 'member'} role New role.
 * @returns {Promise<unknown>} Update response.
 */
export async function updateTeamMemberRole(session, teamId, userId, role) {
	return apiRequest(`/teams/${teamId}/members/${userId}`, {
		method: 'PATCH',
		token: session.token,
		body: { role },
	});
}

/**
 * Fetches the issues for a team.
 * @param {{ token: string }} session Authenticated session.
 * @param {number} teamId Team id.
 * @returns {Promise<Array>} Issue rows.
 */
export async function fetchIssues(session, teamId) {
	return apiRequest(`/issues?team_id=${teamId}`, { token: session.token });
}

/**
 * Creates an issue with the backend's predictable test-mode enrichment.
 * @param {{ token: string }} session Authenticated session.
 * @param {number} teamId Team id.
 * @param {object} [overrides] Issue field overrides.
 * @returns {Promise<{ success: boolean, id: number, enriched: object }>} Create issue response.
 */
export async function createIssue(session, teamId, overrides = {}) {
	return apiRequest('/issues', {
		method: 'POST',
		token: session.token,
		body: {
			title: makeUniqueIssueTitle(),
			description: 'Created by the E2E Playwright helper.',
			team_id: teamId,
			priority: 'Medium',
			category: 'Bug',
			tags: ['testing'],
			test_mode: true,
			...overrides,
		},
	});
}

/**
 * Sends an invite from `adminSession`'s team to a target user (by id, username, or email).
 * Uses /teams/:teamId/invite so it goes through the same admin-gated path the UI does.
 * @param {{ token: string }} adminSession Admin session for the team.
 * @param {number} teamId Team id.
 * @param {{ invited_user_id?: number, username?: string, email?: string }} target Invitee identifier.
 * @returns {Promise<{ success: boolean, invite_id: number }>} Invite response.
 */
export async function inviteUser(adminSession, teamId, target) {
	return apiRequest(`/teams/${teamId}/invite`, {
		method: 'POST',
		token: adminSession.token,
		body: target,
	});
}

/**
 * Fetches pending invites for the authenticated user.
 * @param {{ token: string }} session Authenticated session.
 * @returns {Promise<Array>} Pending invites.
 */
export async function fetchInvites(session) {
	return apiRequest('/invites', {
		token: session.token,
	});
}

/**
 * Accepts a pending invite as the invited user.
 * @param {{ token: string }} session Authenticated session of the invited user.
 * @param {number} inviteId Invite id.
 * @returns {Promise<{ success: boolean, message: string }>} Accept response.
 */
export async function acceptInvite(session, inviteId) {
	return apiRequest(`/invites/${inviteId}/accept`, {
		method: 'PATCH',
		token: session.token,
	});
}

/**
 * Installs browser-side API overrides before app modules run.
 * Does not write auth state — call setBrowserSession for that.
 * @param {import('@playwright/test').Page} page Playwright page.
 * @returns {Promise<void>}
 */
export async function configureApiPage(page) {
	await page.addInitScript(
		({ apiBase }) => {
			window.__ALLEGRO_API_BASE__ = apiBase;
			window.__ALLEGRO_E2E_TEST_MODE__ = true;
			try {
				localStorage.setItem('allegro_api_base', apiBase);
				localStorage.setItem('allegro_e2e_test_mode', '1');
			} catch {
				/* localStorage unavailable */
			}
		},
		{ apiBase: API_BASE },
	);
}

/**
 * Injects an authenticated session before page navigation.
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {{ token: string, expires_at: string, credentials: object, user?: object }} session Authenticated session.
 * @returns {Promise<void>}
 */
export async function setBrowserSession(page, session) {
	await configureApiPage(page);
	await page.addInitScript(
		({ token, expiresAt, user }) => {
			try {
				if (sessionStorage.getItem('__pw_auth_injected__') === '1') return;
				localStorage.setItem('allegro_token', token);
				localStorage.setItem('allegro_token_expires', expiresAt);
				localStorage.setItem('allegro_user', JSON.stringify(user));
				sessionStorage.setItem('__pw_auth_injected__', '1');
			} catch {
				/* localStorage unavailable */
			}
		},
		{
			token: session.token,
			expiresAt: session.expires_at,
			user: storageUser(session),
		},
	);
}

/**
 * Registers a user, creates a team, and injects browser auth for a UI test.
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {{ user?: object, team?: { team_name?: string, bio?: string } }} [opts] Setup options.
 * @returns {Promise<{ session: object, team: object, cleanup: () => Promise<void> }>} App context.
 */
export async function setupApp(page, opts = {}) {
	const session = await registerUser(opts.user || {});
	const team = await createTeam(session, opts.team || {});
	await setBrowserSession(page, session);

	return {
		session,
		team,
		cleanup: () => safeDeleteTeam(session, team.id),
	};
}

/**
 * Registers a user, creates a team, seeds N issues through the API, and
 * injects browser auth. Cleanup deletes the team (issues cascade via FK).
 * @param {import('@playwright/test').Page} page Playwright page.
 * @param {object[]} issues Issue field-override objects. test_mode defaults to true.
 * @param {{ user?: object, team?: object }} [opts] setupApp options.
 * @returns {Promise<{ session: object, team: object, issues: object[], cleanup: () => Promise<void> }>} Seeded app context.
 */
export async function setupAppWithIssues(page, issues, opts = {}) {
	const app = await setupApp(page, opts);
	const created = [];
	for (const overrides of issues) {
		const response = await createIssue(app.session, app.team.id, overrides);
		created.push({ id: response.id, ...overrides, ...response.enriched });
	}

	return {
		session: app.session,
		team: app.team,
		issues: created,
		cleanup: app.cleanup,
	};
}
