import { API_BASE } from './constants.js';

/**
 * @typedef {object} ApiUser
 * @property {string} username
 * @property {string} email
 * @property {string} first_name
 * @property {string} last_name
 */

/**
 * @typedef {object} Issue
 * @property {number} id
 * @property {number} team_id
 * @property {number} created_by
 * @property {number | null} [assigned_to]
 * @property {string} title
 * @property {string | null} [description]
 * @property {string | null} [summary]
 * @property {string} status
 * @property {string} priority
 * @property {string} [difficulty]
 * @property {string} [category]
 * @property {string[]} [tags]
 * @property {string | null} [entry_point]
 * @property {string | null} [error_type]
 * @property {string | null} [error_message]
 * @property {string[]} [stack_trace]
 * @property {string[]} [affected_files]
 * @property {string | null} [expected_behavior]
 * @property {string | null} [actual_behavior]
 * @property {string | null} [missing_information]
 * @property {string | null} [steps_to_reproduce]
 * @property {string | null} [hypothesis]
 * @property {string | null} [attempt_notes]
 * @property {string | null} [resolution_notes]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

/**
 * @typedef {object} InviteDetail
 * @property {number} id
 * @property {number} team_id
 * @property {string} [team_name]
 * @property {string} [inviter_username]
 * @property {string} status
 * @property {string} [created_at]
 */

/**
 * Resolves the API origin for this browser session.
 * Playwright real-backend tests can set `window.__ALLEGRO_API_BASE__` before
 * module scripts run; local manual testing can use localStorage.
 * @returns {string} API origin with trailing slashes removed.
 */
function resolveApiBase() {
	const override = globalThis.__ALLEGRO_API_BASE__ || localStorage.getItem('allegro_api_base');
	return String(override || API_BASE).replace(/\/+$/, '');
}

/**
 * Checks if the user is authenticated and validates the token against the backend.
 * Redirects to the login page if the token is missing or invalid.
 * Preserves the current URL as a `?redirect=` param.
 * @returns {Promise<boolean>}
 */
export async function requireAuth() {
	const token = localStorage.getItem('allegro_token');

	if (!token) {
		location.replace('login.html?redirect=' + encodeURIComponent(location.href));
		return false;
	}

	try {
		const response = await fetch(`${resolveApiBase()}/auth/validate`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			localStorage.removeItem('allegro_token');
			location.replace('login.html?redirect=' + encodeURIComponent(location.href));
			return false;
		}

		return true;
	} catch (error) {
		console.error('Error validating session:', error);
		localStorage.removeItem('allegro_token');
		location.replace('login.html?redirect=' + encodeURIComponent(location.href));
		return false;
	}
}

/**
 * Checks if the user is authenticated and redirects away from auth pages.
 * Respects a `?redirect=` param so users who land on login.html via a shared
 * link and are already signed in get sent to their intended destination.
 * @returns {void}
 */
export function requireNoAuth() {
	if (localStorage.getItem('allegro_token')) {
		location.replace(getPostAuthRedirect());
	}
}

/**
 * Returns the URL to redirect to after a successful sign-in or sign-up.
 * Reads the `?redirect=` query param set by requireAuth() and validates it
 * is same-origin to prevent open-redirect attacks.
 * Falls back to teams.html when no valid redirect is present.
 *
 * @returns {string} Destination URL.
 */
export function getPostAuthRedirect() {
	const param = new URLSearchParams(location.search).get('redirect');
	if (param) {
		try {
			if (new URL(param).origin === location.origin) return param;
		} catch {
			/* invalid URL — fall through to default */
		}
	}
	return 'teams.html';
}

/**
 * Core request handler to manage headers, tokens, and errors globally.
 * @param {string} endpoint - The API route (e.g., '/issues')
 * @param {RequestInit} [options] - Fetch options (method, body, headers)
 * @returns {Promise<unknown|null>}
 */
export async function request(endpoint, options = {}) {
	// Retrieve auth token if you are using JWT or similar token-based auth
	const token = localStorage.getItem('allegro_token');

	const headers = { ...options.headers };

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	// Only set Content-Type to application/json if we aren't sending FormData (files).
	// If it is FormData, the browser needs to automatically set the multipart boundary.
	if (!(options.body instanceof FormData) && !headers['Content-Type']) {
		headers['Content-Type'] = 'application/json';
	}

	const config = {
		...options,
		headers,
	};

	const response = await fetch(`${resolveApiBase()}${endpoint}`, config);

	if (!response.ok) {
		// Try to parse server error messages if available
		// Workers may return plain-text or empty errors, so JSON parsing stays optional.
		let errorMessage = `API Error: ${response.status} ${response.statusText}`;
		try {
			const errorData = await response.json();
			if (errorData.message) errorMessage = errorData.message;
			else if (errorData.error) errorMessage = errorData.error;
		} catch {
			/* ignore JSON parse error on non-JSON error responses */
		}

		const err = new Error(errorMessage);
		err.status = response.status;
		throw err;
	}

	// Handle 204 No Content or empty responses safely
	if (response.status === 204) return null;

	return await response.json();
}

/**
 * POST /auth/login
 * @param {string} email Email address entered on the login form.
 * @param {string} password Plaintext password submitted over HTTPS.
 * @returns {Promise<{ token: string, user: ApiUser }>}
 */
export async function login(email, password) {
	return request('/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
	});
}

/**
 * POST /auth/register
 * Returns { token, expires_at, user } on 201.
 *
 * @param {{ username: string, first_name: string, last_name: string, email: string, password: string }} data Registration form payload.
 * @returns {Promise<{ token: string, expires_at: string, user: ApiUser }>}
 */
export async function createAccount(data) {
	return request('/auth/register', {
		method: 'POST',
		body: JSON.stringify(data),
	});
}

/**
 * GET /teams
 * Returns all teams the authenticated user belongs to, each with their role.
 * @returns {Promise<Array<{ id: number, team_name: string, role: string, created_at: string }>>}
 */
export async function fetchTeams() {
	return request('/teams');
}

/**
 * GET /teams/:teamId
 * @param {number} teamId Team id from route or dashboard card.
 * @returns {Promise<{ id: number, team_name: string, role: string, created_at: string }>}
 */
export async function fetchTeam(teamId) {
	return request(`/teams/${teamId}`);
}

/**
 * POST /teams
 * Creates a new team. The authenticated user becomes its first admin.
 * @param {{ team_name: string }} data New team fields.
 * @returns {Promise<{ success: boolean, team_id: number }>}
 */
export async function createTeam(data) {
	return request('/teams', {
		method: 'POST',
		body: JSON.stringify(data),
	});
}

/**
 * PATCH /teams/:teamId
 * Renames a team. Requires admin role.
 * @param {number} teamId Team to rename.
 * @param {{ team_name: string }} data Updated team fields.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function updateTeam(teamId, data) {
	return request(`/teams/${teamId}`, {
		method: 'PATCH',
		body: JSON.stringify(data),
	});
}

/**
 * DELETE /teams/:teamId
 * Deletes a team entirely. Requires admin role.
 * @param {number} teamId Team to delete.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function deleteTeam(teamId) {
	return request(`/teams/${teamId}`, { method: 'DELETE' });
}

/**
 * GET /teams/:teamId/members
 * Returns members with their role. Requires team membership.
 * @param {number} teamId Team whose members should be listed.
 * @returns {Promise<Array<{ id: number, username: string, email: string, role: string }>>}
 */
export async function fetchTeamMembers(teamId) {
	return request(`/teams/${teamId}/members`);
}

/**
 * DELETE /teams/:teamId/members/:userId
 * Removes a member from the team. Requires admin role.
 * Cannot be used to remove yourself — use leaveTeam() instead.
 * @param {number} teamId Team containing the member.
 * @param {number} userId Member to remove.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function removeTeamMember(teamId, userId) {
	return request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' });
}

/**
 * DELETE /teams/:teamId/leave
 * Lets the authenticated user leave a team.
 * Admins cannot leave if other members still exist (409).
 * If the admin is the last member, the team is deleted automatically.
 * @param {number} teamId Team the current user is leaving.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function leaveTeam(teamId) {
	return request(`/teams/${teamId}/leave`, { method: 'DELETE' });
}

// api.js

/**
 * GET /invites
 * Returns all pending invites for the authenticated user.
 * Each invite includes team_name and inviter_username.
 * @returns {Promise<Array<{ id: number, team_id: number, team_name: string, inviter_username: string, status: string, created_at: string }>>}
 */
export async function fetchInvites() {
	return request('/invites');
}

/**
 * GET /invites/:id
 * Returns a single invite with team and inviter details.
 * Accessible by the invited user, the inviter, or a team admin.
 * @param {number} inviteId Invite to fetch.
 * @returns {Promise<InviteDetail>}
 */
export async function fetchInvite(inviteId) {
	return request(`/invites/${inviteId}`);
}

/**
 * POST /invites
 * Creates an invite from the authenticated user to another user.
 * The authenticated user must be a team admin.
 * @param {{ team_id: number, invited_user_id?: number, username?: string, email?: string }} data Invite target and team.
 * @returns {Promise<{ success: boolean, invite_id: number }>}
 */
export async function createInvite(data) {
	return request('/invites', {
		method: 'POST',
		body: JSON.stringify(data),
	});
}

/**
 * POST /teams/:teamId/invite
 * Alternate invite route for use within a team context (e.g. team settings page).
 * teamId comes from the URL. Body requires one of: invited_user_id, username, or email.
 * @param {number} teamId Team issuing the invite.
 * @param {{ invited_user_id?: number, username?: string, email?: string }} data Invite recipient identifier.
 * @returns {Promise<{ success: boolean, invite_id: number }>}
 */
export async function inviteToTeam(teamId, data) {
	return request(`/teams/${teamId}/invite`, {
		method: 'POST',
		body: JSON.stringify(data),
	});
}

/**
 * PATCH /invites/:id/accept
 * Accepts a pending invite. Only the invited user can call this.
 * Adds the user to team_members and marks the invite accepted in one batch.
 * @param {number} inviteId Pending invite to accept.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function acceptInvite(inviteId) {
	return request(`/invites/${inviteId}/accept`, { method: 'PATCH' });
}

/**
 * PATCH /invites/:id/reject
 * Declines a pending invite. Only the invited user can call this.
 * @param {number} inviteId Pending invite to reject.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function rejectInvite(inviteId) {
	return request(`/invites/${inviteId}/reject`, { method: 'PATCH' });
}

/**
 * DELETE /invites/:id
 * Cancels/deletes an invite.
 * Accessible by the invited user, the inviter, or a team admin.
 * @param {number} inviteId Invite to delete.
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteInvite(inviteId) {
	return request(`/invites/${inviteId}`, { method: 'DELETE' });
}

/**
 * GET /issues?team_id=X
 * Supports optional query params: status, priority, assigned_to, category,
 * difficulty, sort_by, order.
 * @param {number} teamId Team whose issues should be fetched.
 * @param {Record<string, string>} [filters] - Optional filter/sort params
 * @returns {Promise<Issue[]>}
 */
export async function fetchIssues(teamId, filters = {}) {
	const params = new URLSearchParams({ team_id: teamId, ...filters });
	return request(`/issues?${params}`);
}

/**
 * GET /issues/:id
 * @param {number} id Issue id to fetch.
 * @returns {Promise<Issue>}
 */
export async function fetchIssue(id) {
	return request(`/issues/${id}`);
}

/**
 * POST /issues
 * Accepts both JSON and FormData (multipart). FormData is used when
 * attaching .log or .txt files — the backend reads their text content
 * and appends it to the description automatically.
 * Required fields: title, team_id, description.
 * @param {FormData|object} data Issue payload, with FormData used for attachments.
 * @param {boolean} [testMode=false] Bypasses the LLM for predictable testing.
 * @returns {Promise<{ success: boolean }>}
 */
export async function createIssue(data, testMode = false) {
	const isFormData = data instanceof FormData;

	if (isFormData) {
		data.set('test_mode', String(testMode));
	} else {
		data = { ...data, test_mode: testMode };
	}

	return request('/issues', {
		method: 'POST',
		body: isFormData ? data : JSON.stringify(data),
	});
}

/**
 * PATCH /issues/:id
 * Accepts any subset of patchable fields:
 * title, description, summary, status, priority, category, difficulty,
 * tags, assigned_to, hypothesis, steps_to_reproduce, expected_behavior,
 * actual_behavior, missing_information, attempt_notes, resolution_notes,
 * affected_files.
 * @param {number} id Issue id to update.
 * @param {object} updates Patch fields accepted by the issue endpoint.
 * @returns {Promise<{ success: boolean }>}
 */
export async function updateIssue(id, updates) {
	return request(`/issues/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(updates),
	});
}

/**
 * DELETE /issues/:id
 * @param {number} id Issue id to delete.
 * @returns {Promise<{ success: boolean }>}
 */
export async function deleteIssue(id) {
	return request(`/issues/${id}`, { method: 'DELETE' });
}
