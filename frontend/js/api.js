// api.js
const API_BASE = 'https://issue-tracker-api.amorbuks25.workers.dev';
//TESTING LOCALLY
//const API_BASE = 'http://localhost:8787';
/**
 * Checks if the user is authenticated and redirects to the login page if not.
 * Preserves the current URL as a `?redirect=` param so login can send the user back to the page they were trying to reach.
 *
 * This is a lightweight frontend gate; backend routes still enforce auth.
 */
export function requireAuth() {
	if (!localStorage.getItem('allegro_token')) {
		location.replace('login.html?redirect=' + encodeURIComponent(location.href));
	}
}

/**
 * Checks if the user is authenticated and redirects away from auth pages.
 * Respects a `?redirect=` param so users who land on login.html via a shared
 * link and are already signed in get sent to their intended destination.
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

	try {
		const response = await fetch(`${API_BASE}${endpoint}`, config);

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
	} catch (error) {
		throw error; // Re-throw to let the UI handle the specific error state
	}
}

/**
 * POST /api/auth/login
 * @param {string} email Email address entered on the login form.
 * @param {string} password Plaintext password submitted over HTTPS.
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function login(email, password) {
	return request('/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password }),
	});
}

/**
 * POST /auth/register
 * Returns { success: true } on 201. (As of 05/20 does not return a token)
 *
 * @param {{ username: string, first_name: string, last_name: string, email: string, password: string }} data Registration form payload.
 * @returns {Promise<{ success: boolean }>}
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
 * @returns {Promise<object>}
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
 * @returns {Promise<Array>}
 */
export async function fetchIssues(teamId, filters = {}) {
	const params = new URLSearchParams({ team_id: teamId, ...filters });
	return request(`/issues?${params}`);
}

/**
 * GET /issues/:id
 * @param {number} id Issue id to fetch.
 * @returns {Promise<object>}
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
 * @returns {Promise<{ success: boolean }>}
 */
export async function createIssue(data) {
	const isFormData = data instanceof FormData;
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
