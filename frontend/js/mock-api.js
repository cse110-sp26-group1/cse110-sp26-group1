// ============================================================
// TO DELETE IN PRODUCTION:
// Once your real API is ready, delete `dbIssues`, `dbTeams`,
// `dbUsers`, `dbTeamMembers`, `initDB()`, and the `delay()`
// helper entirely.
// ============================================================

const API_BASE = 'https://your-api.your-subdomain.workers.dev';

let dbIssues = null;
let dbTeams = null;
let dbUsers = null;
let dbTeamMembers = null;

// const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 *
 */
function persistDB() {
	localStorage.setItem('mock_db_issues', JSON.stringify(dbIssues));
	localStorage.setItem('mock_db_teams', JSON.stringify(dbTeams));
	localStorage.setItem('mock_db_users', JSON.stringify(dbUsers));
	localStorage.setItem('mock_db_teamMembers', JSON.stringify(dbTeamMembers));
}

/**
 * Lazy-loads the mock database.
 * Now checks localStorage FIRST so your changes persist across reloads!
 */
async function initDB() {
	if (!dbIssues || !dbTeams || !dbUsers || !dbTeamMembers) {
		const savedIssues = localStorage.getItem('mock_db_issues');
		const savedTeams = localStorage.getItem('mock_db_teams');

		if (savedIssues && savedTeams) {
			dbIssues = JSON.parse(savedIssues);
			dbTeams = JSON.parse(savedTeams);
			dbUsers = JSON.parse(localStorage.getItem('mock_db_users'));
			dbTeamMembers = JSON.parse(localStorage.getItem('mock_db_teamMembers'));
		} else {
			const response = await fetch('../js/db.json');
			if (!response.ok) throw new Error('Failed to load mock database');

			const data = await response.json();
			dbIssues = data.issues;
			dbTeams = data.teams;
			dbUsers = data.users;
			dbTeamMembers = data.team_members;

			persistDB();
		}
	}
}

// Auth

/**
 * Replaces: POST /api/auth/login
 * Returns a mock JWT and the matched user object (without password_hash).
 * @param {string} email
 * @param {string} password
 */
export async function login(email, password) {
	/*
	const res = await fetch(`${API_BASE}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});
	if (!res.ok) throw new Error('Invalid credentials');
	return await res.json();
	*/

	await initDB();
	const user = dbUsers.find((u) => u.email === email);
	if (!user || !password) throw new Error('Invalid credentials');

	const { password_hash, ...safeUser } = user;
	return { token: 'mock_jwt_token_12345', user: safeUser };
}

// Teams

/**
 * Replaces: GET /api/teams
 * Returns all teams as an array, each with its slug included.
 */
export async function fetchTeams() {
	/*
	const res = await fetch(`${API_BASE}/api/teams`);
	if (!res.ok) throw new Error('Failed to fetch teams');
	return await res.json();
	*/

	await initDB();
	return Object.entries(dbTeams).map(([slug, data]) => ({ slug, ...data }));
}

/**
 * Replaces: POST /api/teams
 * @param teamData
 */
export async function createTeam(teamData) {
	// === REAL API CALL ===
	/*
    const res = await fetch(`${API_BASE}/api/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData),
    });
    if (!res.ok) throw new Error('Failed to create team');
    return await res.json();
    */

	await initDB();

	// If the user didn't provide a custom slug, generate one from the name
	const rawSlug = teamData.slug || teamData.name;
	const slug = rawSlug
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

	if (dbTeams[slug]) throw new Error(`Team slug "${slug}" already exists`);

	const maxId = Math.max(0, ...Object.values(dbTeams).map((t) => t.id));

	const newTeam = {
		id: maxId + 1,
		name: teamData.name,
		mark: teamData.mark,
		color: teamData.color ?? Math.floor(Math.random() * 360),
		created_at: new Date().toISOString(),
	};

	dbTeams[slug] = newTeam;

	persistDB();

	return { slug, ...newTeam };
}

// Team Members

/**
 * Replaces: GET /api/teams/:teamId/members
 * Returns members of a team, each with their full user record merged in.
 * @param {number} teamId
 */
export async function fetchTeamMembers(teamId) {
	/*
	const res = await fetch(`${API_BASE}/api/teams/${encodeURIComponent(teamId)}/members`);
	if (!res.ok) throw new Error('Failed to fetch team members');
	return await res.json();
	*/

	await initDB();

	return dbTeamMembers
		.filter((m) => m.team_id === teamId)
		.map((m) => {
			const user = dbUsers.find((u) => u.id === m.user_id);
			if (!user) return null;
			const { password_hash, ...safeUser } = user;
			return { ...safeUser, role: m.role };
		})
		.filter(Boolean);
}

/**
 * Replaces: POST /api/teams/:teamId/members  (invite / add)
 * @param {number} teamId
 * @param {number} userId
 * @param {'owner'|'member'} role
 */
export async function addTeamMember(teamId, userId, role = 'member') {
	/*
	const res = await fetch(`${API_BASE}/api/teams/${encodeURIComponent(teamId)}/members`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ user_id: userId, role }),
	});
	if (!res.ok) throw new Error('Failed to add team member');
	return await res.json();
	*/

	await initDB();

	const alreadyMember = dbTeamMembers.some((m) => m.team_id === teamId && m.user_id === userId);
	if (alreadyMember) throw new Error('User is already a member of this team');

	const user = dbUsers.find((u) => u.id === userId);
	if (!user) throw new Error('User not found');

	const record = { team_id: teamId, user_id: userId, role };
	dbTeamMembers.push(record);
	return record;
}

// Invitations

/**
 * Replaces: POST /api/invitations/:slug/accept
 * @param teamSlug
 */
export async function acceptInvite(teamSlug) {
	// === REAL API CALL (Replace mock logic below with this) ===
	/*
    const res = await fetch(`${API_BASE}/api/invitations/${encodeURIComponent(teamSlug)}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to accept invitation');
    return await res.json(); // Expected: The unlocked team object
    */

	await initDB();

	const CURRENT_USER_ID = 1;

	const targetTeam = Object.values(dbTeams).find((t) => t.slug === teamSlug || teamSlug === 'invited');
	if (!targetTeam) throw new Error('Team not found');

	const alreadyMember = dbTeamMembers.some((m) => m.team_id === targetTeam.id && m.user_id === CURRENT_USER_ID);

	if (!alreadyMember) {
		dbTeamMembers.push({ team_id: targetTeam.id, user_id: CURRENT_USER_ID, role: 'member' });
		persistDB();
	}

	return targetTeam;
}

// Users

/**
 * Replaces: GET /api/users
 * Returns all users (password_hash omitted).
 */
export async function fetchUsers() {
	/*
	const res = await fetch(`${API_BASE}/api/users`);
	if (!res.ok) throw new Error('Failed to fetch users');
	return await res.json();
	*/

	await initDB();
	return dbUsers.map(({ password_hash, ...u }) => u);
}

// ISSUES

/**
 * Replaces: GET /api/issues?team_id={teamId}
 * When teamId is provided, filters to issues belonging to that team.
 * @param {number|null} teamId  - integer team ID (not slug)
 */
export async function fetchIssues(teamId = null) {
	/*
    const url = teamId
        ? `${API_BASE}/api/issues?team_id=${encodeURIComponent(teamId)}`
        : `${API_BASE}/api/issues`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch issues');
    return await res.json();
    */

	await initDB();
	const issues = teamId ? dbIssues.filter((i) => i.team_id === teamId) : [...dbIssues];
	return issues;
}

/**
 * Replaces: POST /api/issues
 * @param formData
 */
export async function createIssue(formData) {
	/*
    const res = await fetch(`${API_BASE}/api/issues`, {
        method: 'POST',
        body: formData, 
    });
    if (!res.ok) throw new Error('Failed to create issue');
    return await res.json();
    */

	await initDB();

	const title = formData.get('title');
	const description = formData.get('description') ?? '';
	const teamId = Number(formData.get('team_id')) || 1; // Default to team 1 if missing
	const files = formData.getAll('attachments');

	// ============================================================
	// 🧠 MOCK AI DATA GENERATOR
	// Randomly picks categories, tags, and writes a hypothesis
	// ============================================================
	const categories = ['bug', 'ui', 'logic', 'infra', 'perf'];
	const randomCategory = categories[Math.floor(Math.random() * categories.length)];

	const allTags = ['auth', 'database', 'frontend', 'api', 'css', 'state', 'network'];
	// Pick two random unique tags
	const randomTags = [
		...new Set([allTags[Math.floor(Math.random() * allTags.length)], allTags[Math.floor(Math.random() * allTags.length)]]),
	];

	const errorTypes = ['NullReferenceError', 'StateSyncConflict', 'TimeoutException', 'ValidationError', 'NetworkDisconnect'];
	const randomErrorType = randomCategory === 'bug' ? errorTypes[Math.floor(Math.random() * errorTypes.length)] : null;

	const hypotheses = [
		'The component is rendering before the API data resolves.',
		'There is a race condition in the state update cycle.',
		'The database query is missing a crucial index causing a timeout.',
		'The CSS grid template columns are overflowing on smaller viewports.',
		"The authentication token is expiring but the UI isn't catching the 401.",
	];
	const randomHypothesis = hypotheses[Math.floor(Math.random() * hypotheses.length)];

	const difficulties = [1, 2, 3];
	const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

	// ============================================================

	const CURRENT_USER_ID = 1;
	const CURRENT_USER_INITIALS = 'AL';

	const newId = dbIssues.length > 0 ? Math.max(...dbIssues.map((x) => x.id)) + 1 : 1;
	const now = new Date().toISOString();

	const newIssue = {
		id: newId,
		team_id: teamId,
		created_by: CURRENT_USER_ID,
		assigned_to: null,
		title,
		// AI summarizes the title/description
		summary: title.length > 40 ? title.substring(0, 40) + '...' : title,
		description: `<p>${description.replace(/\n/g, '</p><p>')}</p>`,
		status: 'open',
		priority: 'med',
		category: randomCategory,
		tags: randomTags,
		entry_point: '/auto-detected/route',
		error_type: randomErrorType,
		error_message: randomErrorType ? 'Unhandled exception encountered during execution.' : null,
		stack_trace: randomErrorType ? 'at UnknownComponent (src/components/Unknown.tsx:42)\nat render (src/index.ts:12)' : null,
		affected_files: 'src/generated/file.ts',
		expected_behavior: 'System should handle the action gracefully without errors.',
		actual_behavior: 'System unexpectedly failed or behaved incorrectly based on user report.',
		missing_information: 'Exact steps to reproduce are vague.',
		steps_to_reproduce: '1. Open app\n2. Perform action\n3. Observe result',
		hypothesis: randomHypothesis,
		token_usage: Math.floor(Math.random() * 1500) + 300, // Random token usage between 300-1800
		resolution_notes: null,
		difficulty: randomDifficulty,
		labels: [randomCategory, ...randomTags],
		attachments: files.map((f) => ({
			name: f.name,
			size: (f.size / 1024).toFixed(1) + ' KB',
			ic: (f.name.split('.').pop() ?? '').toUpperCase().slice(0, 3),
		})),
		activity: [{ who: CURRENT_USER_INITIALS, what: 'created issue', when: 'just now' }],
		updated: 'just now',
		created_at: now,
		updated_at: now,
	};

	dbIssues.unshift(newIssue);

	persistDB();

	return newIssue;
}

/**
 * Replaces: PATCH /api/issues/:id
 * Accepts any subset of issue fields. Builds a human-readable activity entry
 * based on which fields actually changed.
 * @param {number} id
 * @param {Partial<Issue>} updates
 */
export async function updateIssue(id, updates) {
	/*
	const res = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates),
	});
	if (!res.ok) throw new Error('Failed to update issue');
	return await res.json();
	*/

	await initDB();

	const issueIndex = dbIssues.findIndex((i) => i.id === id);
	if (issueIndex === -1) throw new Error('Issue not found');

	// Current user is always Ada in the mock
	const CURRENT_USER_INITIALS = 'AL';

	// Build a meaningful activity description from the changed fields
	const activityParts = [];
	const { status, priority, assigned_to, title } = updates;

	if (status) activityParts.push(`moved to ${status}`);
	if (priority) activityParts.push(`set priority to ${priority}`);
	if ('assigned_to' in updates) {
		const assignee = dbUsers.find((u) => u.id === assigned_to);
		activityParts.push(assignee ? `assigned to ${assignee.username}` : 'unassigned issue');
	}
	if (title) activityParts.push('updated title');
	if (activityParts.length === 0) activityParts.push('updated issue');

	const activityEntry = {
		who: CURRENT_USER_INITIALS,
		what: activityParts.join(', '),
		when: 'just now',
	};

	dbIssues[issueIndex] = {
		...dbIssues[issueIndex],
		...updates,
		updated: 'just now',
		updated_at: new Date().toISOString(),
	};
	dbIssues[issueIndex].activity.unshift(activityEntry);

	return dbIssues[issueIndex];
}

/**
 * Replaces: DELETE /api/issues/:id
 * @param {number} id
 */
export async function deleteIssue(id) {
	/*
	const res = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(id)}`, {
		method: 'DELETE',
	});
	if (!res.ok) throw new Error('Failed to delete issue');
	return;
	*/

	await initDB();

	const issueIndex = dbIssues.findIndex((i) => i.id === id);
	if (issueIndex === -1) throw new Error('Issue not found');

	dbIssues.splice(issueIndex, 1);
}

/**
 * Replaces: PATCH /api/issues/:id/assign
 * Convenience wrapper around updateIssue for assignment changes.
 * @param {number} issueId
 * @param {number|null} userId
 */
export async function assignIssue(issueId, userId) {
	/*
	const res = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(issueId)}/assign`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ user_id: userId }),
	});
	if (!res.ok) throw new Error('Failed to assign issue');
	return await res.json();
	*/

	return updateIssue(issueId, { assigned_to: userId });
}

/*
 *  - Invitations
 *  - create new team
 *  - sign out/ sign in
 *  - assigne new issue
 * - delete issue
 * - update issues
 */
