import { CLI_SKILL_MD_URL, PRI_ORDER, TAGS, CATEGORIES } from './constants.js';
import {
	fetchIssues,
	createIssue,
	updateIssue,
	deleteIssue,
	requireAuth,
	inviteToTeam,
	fetchTeams,
	fetchTeam,
	fetchTeamMembers,
	updateTeam,
	updateTeamMemberRole,
	removeTeamMember,
	deleteTeam,
	leaveTeam,
} from './api.js';
import {
	formatRelativeDate,
	formatDateTime,
	escapeHtml,
	showToast,
	getTeamMark,
	getUserInitials,
	getUserDisplayName,
	getStoredUser,
	initTheme,
	initUserMenu,
} from './helpers.js';
import './components/issue-row.js';

initTheme();
initUserMenu();

// Sidebar filters: status, tag, and category (priority is sortable, not filterable here).
const state = {
	sort: 'priority',
	sortDir: 'desc', // 'desc' (default) or 'asc'
	tag: 'all',
	status: 'all',
	category: 'all',
	query: '',
	selected: null,
	detailOpen: true,
	isEditing: false, // Track if we are in edit mode
	teams: [],
	currentTeamId: null,
	currentTeamName: '',
	currentTeamBio: '',
	currentTeamRole: null,
	isTeamSettingsEditing: false,
	teamMembers: [],
};

let ISSUES = [];
let trackerReady = false;

const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsBody = document.getElementById('settings-body');
const settingsDangerActions = document.getElementById('settings-danger-actions');
const settingsEditBtn = document.getElementById('settings-edit-btn');
const openTeamSettingsBtn = document.getElementById('open-team-settings');
const deleteTeamBackdrop = document.getElementById('delete-team-backdrop');

const listEl = document.getElementById('issue-list');
const totalCountEl = document.getElementById('total-count');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');

const detailEl = document.getElementById('detail');
const sidebarEl = document.querySelector('.sidebar');

const deleteBackdrop = document.getElementById('delete-backdrop');

// === Team settings === //
/**
 * @param {'admin' | 'member'} role
 * @returns {string}
 */
function roleLabel(role) {
	return role === 'admin' ? 'Workspace Admin' : 'Workspace Member';
}

/**
 * @returns {boolean}
 */
function isTeamAdmin() {
	return state.currentTeamRole === 'admin';
}

/**
 * @param {{ username?: string, email?: string }} member
 * @returns {boolean}
 */
function isCurrentMember(member) {
	const user = getStoredUser();
	if (!user) return false;
	if (user.username && member.username && user.username === member.username) return true;
	if (user.email && member.email && user.email === member.email) return true;
	return false;
}

/**
 * Checks invite email input with a lightweight chars@chars.chars pattern.
 * @param {string} val Raw invite input value.
 * @returns {boolean} Whether the value looks like an email address.
 */
function isValidEmail(val) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

/**
 * Clears the inline error under the invite input in settings.
 * @returns {void}
 */
function clearInviteError() {
	const errEl = document.getElementById('invite-error');
	const inviteInput = document.getElementById('invite-input');
	if (errEl) errEl.hidden = true;
	if (inviteInput) inviteInput.classList.remove('invalid');
}

/**
 * Shows an inline error beneath the invite input in settings.
 * @param {string} msg Error copy to display.
 * @param {object} [resendPayload] If present, appends a "Resend?" action button.
 * @returns {void}
 */
function setInviteError(msg, resendPayload) {
	const errEl = document.getElementById('invite-error');
	const inviteInput = document.getElementById('invite-input');
	if (!errEl) return;
	errEl.hidden = false;
	errEl.innerHTML = '';
	errEl.appendChild(document.createTextNode(msg));
	if (resendPayload) {
		const btn = document.createElement('button');
		btn.className = 'action-link';
		btn.textContent = 'Resend?';
		btn.addEventListener('click', () => {
			clearInviteError();
			sendInvite(resendPayload);
		});
		errEl.append(' ');
		errEl.appendChild(btn);
	}
	if (inviteInput) inviteInput.classList.add('invalid');
}

/**
 * Sends an invite from the settings modal.
 * @param {{ email?: string, username?: string }} payload Invite recipient payload.
 * @returns {Promise<void>}
 */
async function sendInvite(payload) {
	const val = payload.email ?? payload.username;
	const confirmInviteBtn = document.getElementById('confirm-invite');
	if (!confirmInviteBtn) return;

	const originalText = confirmInviteBtn.textContent;
	confirmInviteBtn.textContent = 'Sending...';
	confirmInviteBtn.disabled = true;
	try {
		await inviteToTeam(state.currentTeamId, payload);
		showToast(`Invitation sent to ${val}`);
		const inviteInput = document.getElementById('invite-input');
		if (inviteInput) inviteInput.value = '';
		clearInviteError();
	} catch (err) {
		const status = err.status;
		if (status === 404) {
			setInviteError(`No user found for '${val}'.`);
		} else if (status === 409) {
			const msg = (err.message || '').toLowerCase();
			if (msg.includes('already a member') || msg.includes('already on') || msg.includes('already in team')) {
				setInviteError(`${val} is already on this team.`);
			} else {
				setInviteError(`${val} already has a pending invite.`, payload);
			}
		} else if (status === 403) {
			setInviteError('Only team admins can invite.');
		} else {
			showToast(err.message || "Couldn't send invite. Please try again.");
		}
	} finally {
		confirmInviteBtn.textContent = originalText;
		confirmInviteBtn.disabled = false;
	}
}

/**
 * Renders team settings modal body (profile, members, invite).
 * @returns {void}
 */
function renderTeamSettingsBody() {
	if (!settingsBody) return;

	const admin = isTeamAdmin();
	const bioText = (state.currentTeamBio || '').trim();
	const bioDisplay = bioText || 'No bio yet.';
	const bioClass = bioText ? '' : 'empty';

	let profileHtml;
	if (state.isTeamSettingsEditing && admin) {
		profileHtml = `
			<div class="settings-edit-toolbar">
				<button type="button" class="btn sm" id="settings-cancel-edit">Cancel</button>
				<button type="button" class="btn sm primary" id="settings-save-edit">Save</button>
			</div>
			<div class="field">
				<label for="settings-team-name">Team name <span class="req">*</span></label>
				<input class="input" id="settings-team-name" value="${escapeHtml(state.currentTeamName)}" />
			</div>
			<div class="field">
				<label for="settings-team-bio">Short bio <span class="optional-label">(optional)</span></label>
				<textarea class="textarea" id="settings-team-bio" placeholder="What does this team work on?">${escapeHtml(bioText)}</textarea>
			</div>`;
	} else {
		profileHtml = `
			<div class="settings-profile-view">
				<p class="settings-name">${escapeHtml(state.currentTeamName)}</p>
				<p class="settings-bio ${bioClass}">${escapeHtml(bioDisplay)}</p>
			</div>`;
	}

	const membersHtml = (state.teamMembers || [])
		.map((m) => {
			const name = m.username || getUserDisplayName(m);
			const isSelf = isCurrentMember(m);
			let roleCell;
			if (admin && !isSelf) {
				roleCell = `
					<select class="input sm member-role-select" data-user-id="${Number(m.id)}" data-prev-role="${m.role}">
						<option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Workspace Admin</option>
						<option value="member" ${m.role === 'member' ? 'selected' : ''}>Workspace Member</option>
					</select>`;
			} else {
				roleCell = `<span class="member-role">${roleLabel(m.role)}</span>`;
			}

			const removeBtn =
				admin && !isSelf
					? `<button type="button" class="btn sm remove-member-btn" data-user-id="${Number(m.id)}" data-username="${escapeHtml(name)}">Remove</button>`
					: '';

			return `
				<div class="settings-member-row">
					<span class="member-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
					${roleCell}
					${removeBtn}
				</div>`;
		})
		.join('');

	const inviteHtml = admin
		? `
			<div class="settings-section">
				<h4>Invite member</h4>
				<div class="field" id="invite-field">
					<label for="invite-input">Username or Email <span class="req">*</span></label>
					<input class="input" id="invite-input" placeholder="e.g. ada@example.com or adalovelace" autocomplete="off" />
					<p class="field-error" id="invite-error" hidden></p>
				</div>
				<button type="button" class="btn primary" id="confirm-invite">Send invite</button>
			</div>`
		: '';

	settingsBody.innerHTML = `
		<div class="settings-section">
			<h4>Profile</h4>
			${profileHtml}
		</div>
		<div class="settings-section">
			<h4>Members (${(state.teamMembers || []).length})</h4>
			<div class="settings-members">${membersHtml || '<p class="hint">No members yet.</p>'}</div>
		</div>
		${inviteHtml}`;

	syncSettingsEditButtonVisibility();

	bindSettingsBodyEvents();
}

/**
 * Shows the profile edit control only for workspace admins.
 * @returns {void}
 */
function syncSettingsEditButtonVisibility() {
	if (!settingsEditBtn) return;
	const canEdit = isTeamAdmin() && !state.isTeamSettingsEditing;
	settingsEditBtn.hidden = !canEdit;
	settingsEditBtn.disabled = !canEdit;
}

/**
 * Renders leave/delete actions in the settings modal footer.
 * @returns {void}
 */
function renderSettingsDangerActions() {
	if (!settingsDangerActions) return;

	const admin = isTeamAdmin();
	let html = `<button type="button" class="btn" id="settings-leave-team">Leave team</button>`;
	if (admin) {
		html += `<button type="button" class="btn danger-btn" id="settings-delete-team">Delete team</button>`;
	}
	settingsDangerActions.innerHTML = html;

	document.getElementById('settings-leave-team')?.addEventListener('click', handleLeaveTeam);
	document.getElementById('settings-delete-team')?.addEventListener('click', openDeleteTeamConfirm);
}

/**
 * Attaches event listeners to dynamically rendered settings body controls.
 * @returns {void}
 */
function bindSettingsBodyEvents() {
	settingsBody.querySelector('#settings-cancel-edit')?.addEventListener('click', () => {
		state.isTeamSettingsEditing = false;
		renderTeamSettingsBody();
	});

	settingsBody.querySelector('#settings-save-edit')?.addEventListener('click', handleSaveTeamProfile);

	settingsBody.querySelectorAll('.member-role-select').forEach((select) => {
		select.addEventListener('change', async (e) => {
			const el = e.target;
			const userId = Number(el.dataset.userId);
			const prevRole = el.dataset.prevRole;
			const newRole = el.value;

			if (!Number.isInteger(userId) || userId <= 0) {
				el.value = prevRole;
				showToast('Invalid member id.');
				return;
			}

			try {
				await updateTeamMemberRole(state.currentTeamId, userId, newRole);
				el.dataset.prevRole = newRole;
				const member = state.teamMembers.find((m) => Number(m.id) === userId);
				if (member) member.role = newRole;
				showToast('Role updated');
			} catch (err) {
				el.value = prevRole;
				showToast(err.message || 'Failed to update role.');
			}
		});
	});

	settingsBody.querySelectorAll('.remove-member-btn').forEach((btn) => {
		btn.addEventListener('click', async () => {
			const userId = Number(btn.dataset.userId);
			const username = btn.dataset.username;
			if (!Number.isInteger(userId) || userId <= 0) {
				showToast('Invalid member id.');
				return;
			}
			try {
				await removeTeamMember(state.currentTeamId, userId);
				state.teamMembers = state.teamMembers.filter((m) => Number(m.id) !== userId);
				renderTeamMembers();
				populateNewAssigneeSelect();
				renderTeamSettingsBody();
				showToast('Member removed');
			} catch (err) {
				showToast(err.message || 'Failed to remove member.');
			}
		});
	});

	const inviteInput = settingsBody.querySelector('#invite-input');
	inviteInput?.addEventListener('input', clearInviteError);

	settingsBody.querySelector('#confirm-invite')?.addEventListener('click', async () => {
		clearInviteError();
		const val = inviteInput?.value.trim() || '';
		if (!val) {
			setInviteError('Enter a username or email.');
			inviteInput?.focus();
			return;
		}
		const isEmail = val.includes('@');
		if (isEmail && !isValidEmail(val)) {
			setInviteError("That doesn't look like a valid email.");
			inviteInput?.focus();
			return;
		}
		await sendInvite(isEmail ? { email: val } : { username: val });
	});
}

/**
 * Saves edited team name and bio from settings edit mode.
 * @returns {Promise<void>}
 */
async function handleSaveTeamProfile() {
	const nameEl = document.getElementById('settings-team-name');
	const bioEl = document.getElementById('settings-team-bio');
	const name = nameEl?.value.trim() || '';
	const bio = bioEl?.value.trim() || '';

	if (!name) {
		showToast('Team name is required.');
		nameEl?.focus();
		return;
	}

	const saveBtn = document.getElementById('settings-save-edit');
	const originalText = saveBtn?.textContent;
	if (saveBtn) {
		saveBtn.textContent = 'Saving...';
		saveBtn.disabled = true;
	}

	try {
		await updateTeam(state.currentTeamId, { team_name: name, bio: bio || null });
		state.currentTeamName = name;
		state.currentTeamBio = bio;
		state.isTeamSettingsEditing = false;

		const teamInList = state.teams.find((t) => t.id === state.currentTeamId);
		if (teamInList) {
			teamInList.team_name = name;
			teamInList.bio = bio || null;
		}

		document.getElementById('team-label').textContent = name;
		const markEl = document.querySelector('.team-switch > .mark');
		if (markEl) markEl.textContent = getTeamMark(name);
		renderTeamMenu();
		renderTeamSettingsBody();
		showToast('Team updated');
	} catch (err) {
		showToast(err.message || 'Failed to update team.');
	} finally {
		if (saveBtn) {
			saveBtn.textContent = originalText;
			saveBtn.disabled = false;
		}
	}
}

/**
 * Closes the team settings modal.
 * @returns {void}
 */
function closeTeamSettings() {
	settingsBackdrop?.classList.remove('open');
	state.isTeamSettingsEditing = false;
	clearInviteError();
}

/**
 * Opens team settings and loads fresh team + member data.
 * @returns {Promise<void>}
 */
async function openTeamSettings() {
	if (!trackerReady) return;
	if (!state.currentTeamId) {
		showToast('No active team selected.');
		return;
	}

	try {
		const [team, members] = await Promise.all([fetchTeam(state.currentTeamId), fetchTeamMembers(state.currentTeamId)]);
		state.currentTeamName = team.team_name;
		state.currentTeamBio = team.bio || '';
		state.currentTeamRole = team.role;
		state.teamMembers = members;
		state.isTeamSettingsEditing = false;

		renderTeamMembers();
		populateNewAssigneeSelect();
		renderTeamSettingsBody();
		renderSettingsDangerActions();
		syncSettingsEditButtonVisibility();

		settingsBackdrop?.classList.add('open');
	} catch {
		showToast('Failed to load team settings.');
	}
}

/**
 * Confirms and leaves the current team, then redirects to the teams list.
 * @returns {Promise<void>}
 */
async function handleLeaveTeam() {
	if (!state.currentTeamId) return;

	try {
		await leaveTeam(state.currentTeamId);
		closeTeamSettings();
		showToast('You left the team. Redirecting…');
		setTimeout(() => {
			location.href = 'teams.html';
		}, 900);
	} catch (err) {
		showToast(err.message || 'Failed to leave team.');
	}
}

/**
 * Opens delete-team confirmation modal.
 * @returns {void}
 */
function openDeleteTeamConfirm() {
	deleteTeamBackdrop?.classList.add('open');
	setTimeout(() => document.getElementById('confirm-delete-team')?.focus(), 30);
}

/**
 * Closes delete-team confirmation modal.
 * @returns {void}
 */
function closeDeleteTeamConfirm() {
	deleteTeamBackdrop?.classList.remove('open');
}

/**
 * Deletes the current team and redirects to teams list.
 * @returns {Promise<void>}
 */
async function handleDeleteTeamConfirm() {
	if (!state.currentTeamId) return;

	const confirmBtn = document.getElementById('confirm-delete-team');
	const originalText = confirmBtn?.textContent;
	if (confirmBtn) {
		confirmBtn.textContent = 'Deleting...';
		confirmBtn.disabled = true;
	}

	try {
		await deleteTeam(state.currentTeamId);
		closeDeleteTeamConfirm();
		closeTeamSettings();
		showToast('Team deleted. Redirecting…');
		setTimeout(() => {
			location.href = 'teams.html';
		}, 900);
	} catch (err) {
		showToast(err.message || 'Failed to delete team.');
	} finally {
		if (confirmBtn) {
			confirmBtn.textContent = originalText;
			confirmBtn.disabled = false;
		}
	}
}

if (openTeamSettingsBtn) openTeamSettingsBtn.addEventListener('click', openTeamSettings);
if (settingsEditBtn)
	settingsEditBtn.addEventListener('click', () => {
		if (!isTeamAdmin()) return;
		state.isTeamSettingsEditing = true;
		renderTeamSettingsBody();
	});

document.getElementById('cancel-settings')?.addEventListener('click', closeTeamSettings);

settingsBackdrop?.addEventListener('click', (e) => {
	if (e.target === settingsBackdrop) closeTeamSettings();
});

if (deleteTeamBackdrop) {
	document.getElementById('cancel-delete-team')?.addEventListener('click', closeDeleteTeamConfirm);
	document.getElementById('confirm-delete-team')?.addEventListener('click', handleDeleteTeamConfirm);
	deleteTeamBackdrop.addEventListener('click', (e) => {
		if (e.target === deleteTeamBackdrop) closeDeleteTeamConfirm();
	});
}

/**
 * Whether an issue matches a sidebar tag filter.
 * @param {object} issue Issue data from the API.
 * @param {string} tag Sidebar tag filter value.
 * @returns {boolean}
 */
function issueMatchesTag(issue, tag) {
	return (issue.tags || []).includes(tag);
}

/**
 * Builds sidebar TAG filter rows from TAGS in constants.js.
 * @returns {void}
 */
function renderTagFilters() {
	const container = document.getElementById('tag-filters');
	if (!container) return;

	container.innerHTML = TAGS.map(
		(t) => `
		<div class="filter-item" data-group="tag" data-val="${t}">
			<span class="indicator"></span> ${t}
			<span class="count" id="cnt-${t}">0</span>
		</div>`,
	).join('');
}

/**
 * Builds sidebar CATEGORY filter rows from CATEGORIES in constants.js.
 * @returns {void}
 */
function renderCategoryFilters() {
	const container = document.getElementById('category-filters');
	if (!container) return;

	container.innerHTML = CATEGORIES.map(
		(c) => `
		<div class="filter-item" data-group="category" data-val="${c}">
			<span class="indicator"></span> ${c.toLowerCase()}
			<span class="count" id="cnt-cat-${c}">0</span>
		</div>`,
	).join('');
}

/**
 * Whether an issue belongs to a sidebar category filter.
 * @param {object} issue Issue data from the API.
 * @param {string} category Sidebar category filter value.
 * @returns {boolean}
 */
function issueMatchesCategory(issue, category) {
	return (issue.category || '').toLowerCase() === category.toLowerCase();
}

/**
 * Collects the issue fields users expect the tracker search to match.
 * @param {object} issue Issue data from the API.
 * @returns {string}
 */
function buildIssueSearchText(issue) {
	return [
		issue.title,
		issue.description,
		issue.summary,
		issue.hypothesis,
		issue.steps_to_reproduce,
		issue.status,
		issue.priority,
		issue.category,
		...(issue.tags || []),
		...(issue.affected_files || []),
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}

/**
 * Populates the new-issue category dropdown (#new-tag) from CATEGORIES.
 * @returns {void}
 */
function populateNewCategorySelect() {
	const select = document.getElementById('new-tag');
	if (!select) return;

	select.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c.toLowerCase()}</option>`).join('');
}

/**
 * Renders the new-issue tag-picker chips from TAGS so only valid tags can be selected.
 * @returns {void}
 */
function populateTagPicker() {
	const picker = document.getElementById('tag-picker');
	if (!picker) return;

	picker.innerHTML = TAGS.map((t) => `<button type="button" class="tag-opt tag-${t}" data-tag="${t}">${t}</button>`).join('');
}

/**
 * @param {object} issue - Issue record from the API.
 * @returns {string}
 */
function buildEditTagPickerHtml(issue) {
	const selected = issue.tags || [];
	return TAGS.map(
		(t) => `<button type="button" class="tag-opt tag-${t}${selected.includes(t) ? ' selected' : ''}" data-tag="${t}">${t}</button>`,
	).join('');
}

/**
 * Gets issue counts and updates the sidebar UI.
 * Reuses the fetched issue list so counts match the active team and filters.
 * @returns {void}
 */
function syncSidebar() {
	if (!ISSUES) return;

	const safeSet = (id, count) => {
		const el = document.getElementById(id);
		if (el) el.textContent = count;
	};

	safeSet('cnt-open', ISSUES.filter((i) => i.status === 'Open').length);
	safeSet('cnt-prog', ISSUES.filter((i) => i.status === 'In Progress').length);
	safeSet('cnt-resolved', ISSUES.filter((i) => i.status === 'Resolved').length);
	safeSet('cnt-closed', ISSUES.filter((i) => i.status === 'Closed').length);

	// Tag counts drive sidebar filter badges (cnt-bug, cnt-ui, cnt-infra, cnt-auth, cnt-perf).
	TAGS.forEach((t) => {
		safeSet(`cnt-${t}`, ISSUES.filter((i) => issueMatchesTag(i, t)).length);
	});

	// Category counts drive the sidebar CATEGORY filter badges.
	CATEGORIES.forEach((c) => {
		safeSet(`cnt-cat-${c}`, ISSUES.filter((i) => issueMatchesCategory(i, c)).length);
	});
}

if (sidebarEl) {
	sidebarEl.addEventListener('click', (e) => {
		const item = e.target.closest('.filter-item[data-group]');
		if (!item) return;

		const group = item.dataset.group;
		const val = item.dataset.val;

		if (state[group] === val) {
			state[group] = 'all';
			item.classList.remove('active');
		} else {
			document.querySelectorAll(`.sidebar .filter-item[data-group="${group}"]`).forEach((el) => el.classList.remove('active'));
			state[group] = val;
			item.classList.add('active');
		}

		renderList();
		setSidebarOpen(false);
	});
}

renderTagFilters();
renderCategoryFilters();
populateNewCategorySelect();
populateTagPicker();

/**
 * Checks whether backend issue creation should request predictable test-mode
 * enrichment instead of live LLM processing.
 * @returns {boolean} True when E2E test mode is enabled for this browser session.
 */
function isE2ETestMode() {
	return globalThis.__ALLEGRO_E2E_TEST_MODE__ === true || localStorage.getItem('allegro_e2e_test_mode') === '1';
}

/**
 * Filters, sorts, groups, and re-renders the issue list.
 * @returns {void}
 */
function renderList() {
	syncSidebar();

	let items = ISSUES.slice();

	if (state.tag !== 'all') {
		items = items.filter((i) => issueMatchesTag(i, state.tag));
	}
	if (state.status !== 'all') {
		items = items.filter((i) => i.status === state.status);
	}
	if (state.category !== 'all') {
		items = items.filter((i) => issueMatchesCategory(i, state.category));
	}
	if (state.query) {
		const query = state.query.toLowerCase();
		items = items.filter((i) => buildIssueSearchText(i).includes(query));
	}

	const dirMult = state.sortDir === 'asc' ? -1 : 1;

	if (state.sort === 'priority') {
		items.sort((a, b) => {
			const byPriority = (PRI_ORDER[a.priority] - PRI_ORDER[b.priority]) * dirMult;
			if (byPriority !== 0) return byPriority;
			const aTime = Date.parse(a.updated_at || a.created_at || 0);
			const bTime = Date.parse(b.updated_at || b.created_at || 0);
			return bTime - aTime || b.id - a.id;
		});
	} else if (state.sort === 'updated') {
		items.sort((a, b) => {
			const aTime = Date.parse(a.updated_at || a.created_at || 0);
			const bTime = Date.parse(b.updated_at || b.created_at || 0);
			return (bTime - aTime) * dirMult || (b.id - a.id) * dirMult;
		});
	}

	totalCountEl.textContent = items.length;

	let groups;
	if (state.sort === 'priority') {
		const buckets = { Critical: [], High: [], Medium: [], Low: [] };
		items.forEach((i) => buckets[i.priority]?.push(i));
		groups = [
			{ label: 'Critical', rows: buckets.Critical },
			{ label: 'High', rows: buckets.High },
			{ label: 'Medium', rows: buckets.Medium },
			{ label: 'Low', rows: buckets.Low },
		].filter((g) => g.rows.length);

		if (state.sortDir === 'asc') groups.reverse();
	} else {
		groups = [{ label: state.sortDir === 'desc' ? 'Most recent' : 'Oldest', rows: items }];
	}

	listEl.innerHTML = groups
		.map(
			(g) => `
        <div class="group-head"><span>${g.label}</span><span class="count">${g.rows.length}</span></div>
        ${g.rows.map(rowHtml).join('')}
    `,
		)
		.join('');

	listEl.querySelectorAll('.issue-row').forEach((el) => {
		el.addEventListener('click', () => {
			state.selected = Number(el.dataset.id);
			state.isEditing = false;
			renderList();
			renderDetail();
			state.detailOpen = true;
			content.classList.remove('collapsed-detail');
			syncLayout();
		});
	});
}

/**
 * Renders the team switcher from API-backed team membership.
 * @returns {void}
 */
function renderTeamMenu() {
	const teamMenu = document.getElementById('team-menu');

	const currentId = Number(new URLSearchParams(location.search).get('team_id'));

	const itemsHtml = state.teams
		.map((t, index) => {
			const mark = getTeamMark(t.team_name);

			const isActive = t.id === currentId ? 'active' : '';
			const colorClass = `c${(index % 4) + 1}`;

			return `
            <div class="item ${isActive}" data-id="${t.id}">
                <span class="mark ${colorClass}">${mark}</span>
                ${t.team_name}
            </div>
        `;
		})
		.join('');

	teamMenu.innerHTML = `
        ${itemsHtml}
        <div class="divider"></div>
        <div class="item" data-action="all-teams">
            <span class="mark all-teams-mark">
                <svg class="gb_F" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z"></path>
                </svg>
            </span>
            All teams
        </div>
    `;

	teamMenu.querySelectorAll('.item[data-id]').forEach((it) => {
		it.addEventListener('click', () => {
			const id = it.dataset.id;
			window.location.href = `tracker.html?team_id=${id}`;
		});
	});

	teamMenu.querySelector('[data-action="all-teams"]').addEventListener('click', () => (location.href = 'teams.html'));
}

/**
 * Renders the team members avatars in the sidebar based on real API data.
 * Falls back to username/email when profile names are not present.
 * @returns {void}
 */
function renderTeamMembers() {
	const membersContainer = document.querySelector('.sidebar .members');
	if (!membersContainer) return;

	if (!state.teamMembers || state.teamMembers.length === 0) {
		membersContainer.innerHTML = '';
		return;
	}

	const membersHtml = state.teamMembers
		.map((member) => {
			const displayName = getUserDisplayName(member);
			return `<div class="avatar" title="${displayName} (${member.role})">${getUserInitials(member)}</div>`;
		})
		.join('');

	membersContainer.innerHTML = membersHtml;
}

// === Issue detail display (view pane) === //
// Summary, Hypothesis, and Steps come from LLM enrichment; Details is the user's create-form description.

/**
 * Plain-text section body with fallback when LLM/user field is empty.
 * @param {string | null | undefined} value - Field value from the issue record.
 * @param {string} [fallback='Not enough information available'] - Text shown when value is empty.
 * @returns {string}
 */
function formatIssueText(value, fallback = 'Not enough information available') {
	if (value === null || value === undefined) return fallback;
	const text = (typeof value === 'string' ? value : String(value)).trim();
	if (!text || text.toLowerCase() === 'null') return fallback;
	return escapeHtml(text);
}

/**
 * Merges LLM-enriched fields from POST /issues into an in-memory issue record.
 * @param {object} issue - Existing in-memory issue record.
 * @param {object} enriched - LLM fields returned by the API.
 * @returns {object}
 */
function applyEnrichedFields(issue, enriched) {
	return {
		...issue,
		summary: enriched.summary ?? issue.summary,
		hypothesis: enriched.hypothesis ?? issue.hypothesis,
		steps_to_reproduce: enriched.steps_to_reproduce ?? issue.steps_to_reproduce,
	};
}

/**
 * Render steps_to_reproduce — API may store plain text or a JSON array string.
 * @param {string | string[] | null | undefined} value - Steps field from the issue record.
 * @returns {string}
 */
const STEPS_UNAVAILABLE_HTML = '<p class="issue-section-body">Not enough information available</p>';

/**
 * @param {string | string[] | null | undefined} value Steps field.
 * @returns {string}
 */
function formatStepsToReproduce(value) {
	if (value === null || value === undefined || value === '') return STEPS_UNAVAILABLE_HTML;

	let steps = value;
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) steps = parsed;
		} catch {
			// Not JSON — treat as a single plain-text block from the LLM
			return `<p class="issue-section-body">${escapeHtml(value.trim())}</p>`;
		}
	}

	if (Array.isArray(steps)) {
		const items = steps.map((s) => String(s).trim()).filter(Boolean);
		if (items.length === 0) return STEPS_UNAVAILABLE_HTML;
		return `<ol class="issue-section-body issue-steps">${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`;
	}

	const text = String(steps).trim();
	return text ? `<p class="issue-section-body">${escapeHtml(text)}</p>` : STEPS_UNAVAILABLE_HTML;
}

/**
 * Build HTML for a single issue row in the list.
 * @param {object} i - Issue record.
 * @returns {string} HTML string for the row.
 */
function rowHtml(i) {
	const isSel = state.selected === i.id;
	const tagsAttr = (i.tags || []).join(',');

	return `
    <issue-row 
        data-id="${i.id}"
        class="${isSel ? 'selected' : ''}"
        issue-title="${escapeHtml(i.title)}"
        summary="${escapeHtml(i.summary || '')}"
        status="${i.status}"
        updated-date="${formatRelativeDate(i.updated_at)}"
        updated-time="${formatDateTime(i.updated_at)}"
        tags="${tagsAttr}"
    ></issue-row>`;
}

// ============================================================
// RENDER DETAIL
// ============================================================

/**
 * Renders the currently selected issue, including derived assignee display.
 * @returns {void}
 */
function renderDetail() {
	const i = ISSUES.find((x) => x.id === state.selected);
	if (!i) {
		detailEl.innerHTML = `
            <div class="detail-empty">
                <div class="glyph">◇</div>
                <div>Select an issue to view details</div>
            </div>`;
		return;
	}

	const statusKey = i.status === 'In Progress' ? 'prog' : i.status.toLowerCase();

	let assigneeHtml = '<div class="avatar sm" title="Unassigned">--</div>';
	if (i.assigned_to && state.teamMembers) {
		const m = state.teamMembers.find((member) => member.id === i.assigned_to);
		if (m) {
			const name = getUserDisplayName(m);
			assigneeHtml = `<div class="avatar sm" title="${name}">${getUserInitials(m)}</div>`;
		}
	}

	// Implementation of View vs Edit Mode
	if (!state.isEditing) {
		// --- VIEW MODE ---
		// Sections: Summary / Steps / Hypothesis (LLM) + Details (user description on create)
		detailEl.innerHTML = `
			<div class="issue-details-header">
				<button type="button" class="btn sm mobile-back-btn">← Back</button>
				<h1 class="no-margin">${i.title}</h1>
				<button type="button" class="btn sm edit-issue-btn" title="Edit Issue">✎</button>
			</div>
			
			<div class="details-meta-grid">
				<div class="meta-col">
					<span class="label-sm">Status</span>
					<span class="chip st-${statusKey} sm">${i.status}</span>
				</div>
				<div class="meta-col">
					<span class="label-sm">Priority</span>
					<span class="chip sm">${i.priority}</span>
				</div>
				<div class="meta-col">
					<span class="label-sm">Category</span>
					<span class="chip sm">${i.category || 'None'}</span>
				</div>
				<div class="meta-col">
					<span class="label-sm">Assignee</span>
					${assigneeHtml}
				</div>
				<div class="meta-col meta-col-tags">
					<span class="label-sm">Labels</span>
					<div class="tag-container">
						${(i.tags || []).map((t) => `<span class="chip sm tag-${t}">${t}</span>`).join('')}
					</div>
				</div>
			</div>

			<div class="detail-body">
				<div class="ai-content-block">
					<span class="label-sm"><strong>Summary</strong></span>
					<p class="issue-section-body">${formatIssueText(i.summary)}</p>
				</div>
				<div class="ai-content-block margin-top-large">
					<span class="label-sm">Steps to Reproduce</span>
					${formatStepsToReproduce(i.steps_to_reproduce)}
				</div>
				<div class="ai-content-block margin-top-large">
					<span class="label-sm"><strong>Hypothesis</strong></span>
					<p class="issue-section-body">${formatIssueText(i.hypothesis)}</p>
				</div>
				<div class="ai-content-block margin-top-large">
					<span class="label-sm">Original User Input</span>
					<p class="issue-section-body">${formatIssueText(i.description, 'No description provided.')}</p>
				</div>
			</div>`;
	} else {
		// --- EDIT MODE — human fields only; LLM sections stay read-only in view mode ---
		detailEl.innerHTML = `
			<div class="issue-details-header is-editing">
				<div class="issue-details-toolbar">
					<button type="button" class="btn sm mobile-back-btn">← Back</button>
					<div class="actions">
						<button type="button" class="btn sm delete-issue-btn" title="Delete issue" aria-label="Delete issue">Delete</button>
						<button type="button" class="btn sm" id="cancel-edit">Cancel</button>
						<button type="button" class="btn sm primary" id="save-edit">Save</button>
					</div>
				</div>
				<div class="edit-title-field">
					<span class="label-sm">Title</span>
					<input class="input edit-title-input" id="edit-title" value="${i.title}">
				</div>
			</div>
			
			<div class="details-meta-grid is-editing">
				<div class="meta-col">
					<span class="label-sm">Status</span>
					<select class="input sm" id="edit-status">
						<option ${i.status === 'Open' ? 'selected' : ''}>Open</option>
						<option ${i.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
						<option ${i.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
						<option ${i.status === 'Closed' ? 'selected' : ''}>Closed</option>
					</select>
				</div>
				<div class="meta-col">
					<span class="label-sm">Priority</span>
					<select class="input sm" id="edit-priority">
						<option ${i.priority === 'Low' ? 'selected' : ''}>Low</option>
						<option ${i.priority === 'Medium' ? 'selected' : ''}>Medium</option>
						<option ${i.priority === 'High' ? 'selected' : ''}>High</option>
						<option ${i.priority === 'Critical' ? 'selected' : ''}>Critical</option>
					</select>
				</div>
				<div class="meta-col">
					<span class="label-sm">Category</span>
					<select class="input sm" id="edit-category">
						${CATEGORIES.map((c) => `<option value="${c}" ${i.category === c ? 'selected' : ''}>${c}</option>`).join('')}
					</select>
				</div>
				<div class="meta-col">
					<span class="label-sm">Assignee</span>
					<select class="input sm" id="edit-assignee">
						<option value="">Unassigned</option>
						${(state.teamMembers || []).map((m) => `<option value="${m.id}" ${i.assigned_to === m.id ? 'selected' : ''}>${getUserDisplayName(m)}</option>`).join('')}
					</select>
				</div>
				<div class="meta-col meta-col-tags">
					<span class="label-sm">Tags</span>
					<div class="edit-tags-wrap">
						<div class="tag-picker edit-tag-picker" id="edit-tag-picker" role="listbox">
							${buildEditTagPickerHtml(i)}
						</div>
					</div>
				</div>
			</div>

			<div class="detail-body">
				<span class="label-sm">Details</span>
				<textarea class="textarea margin-top-small" id="edit-desc">${i.description || ''}</textarea>
			</div>`;
	}
}

// ============================================================
// CONTROLS - search, sort, tag
// ============================================================
const searchInput = document.getElementById('issue-search');
const searchClearBtn = document.getElementById('issue-search-clear');

/**
 * Show or hide the search clear control based on input value.
 * @returns {void}
 */
function syncSearchClear() {
	if (!searchInput || !searchClearBtn) {
		return;
	}
	searchClearBtn.hidden = searchInput.value.length === 0;
}

if (searchInput && searchClearBtn) {
	searchInput.addEventListener('input', () => {
		state.query = searchInput.value.trim();
		syncSearchClear();
		renderList();
	});

	searchClearBtn.addEventListener('click', () => {
		searchInput.value = '';
		state.query = '';
		syncSearchClear();
		searchInput.focus();
		renderList();
	});
}

document.querySelectorAll('.sort-btn').forEach((b) => {
	b.addEventListener('click', () => {
		const newSort = b.dataset.sort;

		if (state.sort === newSort) {
			state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
		} else {
			state.sort = newSort;
			state.sortDir = 'desc';
		}

		document.querySelectorAll('.sort-btn').forEach((x) => {
			x.classList.remove('on');
			const arrow = x.querySelector('.arrow');
			if (arrow) arrow.remove();
		});

		b.classList.add('on');
		b.insertAdjacentHTML('beforeend', `<span class="arrow">${state.sortDir === 'desc' ? '↓' : '↑'}</span>`);

		renderList();
	});
});

// ============================================================
// DIVIDER DRAG & RESPONSIVE LAYOUT
// ============================================================
const content = document.getElementById('content');
const divider = document.getElementById('divider');
const toggleDetailBtn = document.getElementById('toggle-detail');
const appEl = document.querySelector('.app');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const searchWrap = document.querySelector('.search-wrap');
const topbarSearchSlot = document.getElementById('topbar-search-slot');
const sidebarSearchSlot = document.getElementById('sidebar-search-slot');
const MOBILE_BP = 640;
const TABLET_BP = 760;
const SIDEBAR_BP = 980;
let dragging = false;
let sidebarOpen = false;

/**
 * @returns {boolean}
 */
function isMobileViewport() {
	return window.matchMedia(`(width <= ${MOBILE_BP}px)`).matches;
}

/**
 * @returns {boolean}
 */
function isSidebarCollapsible() {
	return window.matchMedia(`(width <= ${SIDEBAR_BP}px)`).matches;
}

/**
 * Overlay drawer for filters sidebar on narrow viewports.
 * @returns {void}
 */
function syncSidebarLayout() {
	if (!isSidebarCollapsible()) {
		sidebarOpen = false;
		appEl?.classList.remove('sidebar-open');
	}
	if (sidebarToggle) {
		const open = sidebarOpen && isSidebarCollapsible();
		sidebarToggle.textContent = open ? '‹' : '›';
		sidebarToggle.setAttribute('aria-expanded', String(open));
	}
	if (sidebarBackdrop) {
		sidebarBackdrop.hidden = !(sidebarOpen && isSidebarCollapsible());
	}
}

/**
 * @param {boolean} open Whether the sidebar should open.
 * @returns {void}
 */
function setSidebarOpen(open) {
	if (!isSidebarCollapsible()) return;
	sidebarOpen = open;
	appEl?.classList.toggle('sidebar-open', open);
	syncSidebarLayout();
}

/**
 * Toggles the collapsible sidebar open or closed on narrow viewports.
 * @returns {void}
 */
function toggleSidebar() {
	setSidebarOpen(!sidebarOpen);
}

/**
 * Phone master-detail: full-screen detail when an issue is selected.
 * @returns {void}
 */
function syncMobileLayout() {
	const showDetail = isMobileViewport() && state.detailOpen && state.selected !== null;
	content.classList.toggle('mobile-detail-view', showDetail);
	if (toggleDetailBtn) {
		toggleDetailBtn.textContent = showDetail ? '← Back' : '⇌ Details';
	}
}

/**
 * Applies or clears the persisted list/detail column split.
 * @returns {void}
 */
function syncContentGrid() {
	if (!state.detailOpen || isMobileViewport()) {
		content.style.removeProperty('grid-template-columns');
		return;
	}
	if (window.matchMedia(`(width <= ${TABLET_BP}px)`).matches) {
		content.style.removeProperty('grid-template-columns');
		return;
	}
	const saved = localStorage.getItem('detailWidth');
	if (saved) {
		content.style.gridTemplateColumns = saved;
	}
}

/**
 * Move issue search between top bar (wide) and top of sidebar drawer (narrow).
 * @returns {void}
 */
function syncSearchPlacement() {
	if (!searchWrap || !topbarSearchSlot || !sidebarSearchSlot) return;
	const target = isMobileViewport() ? sidebarSearchSlot : topbarSearchSlot;
	if (searchWrap.parentElement !== target) {
		target.appendChild(searchWrap);
	}
}

/**
 * Reconciles mobile, sidebar, search, and content-grid layout for the current viewport.
 * @returns {void}
 */
function syncLayout() {
	syncMobileLayout();
	syncSearchPlacement();
	syncContentGrid();
	syncSidebarLayout();
}

divider.addEventListener('mousedown', () => {
	if (!state.detailOpen || isMobileViewport()) return;
	dragging = true;
	divider.classList.add('dragging');
	document.body.style.userSelect = 'none';
});
window.addEventListener('mouseup', () => {
	if (!dragging) return;
	dragging = false;
	divider.classList.remove('dragging');
	document.body.style.userSelect = '';
	if (state.detailOpen) {
		localStorage.setItem('detailWidth', content.style.gridTemplateColumns);
	}
});
window.addEventListener('mousemove', (e) => {
	if (!dragging || !state.detailOpen) return;
	const rect = content.getBoundingClientRect();
	let left = e.clientX - rect.left;
	const listMin = rect.width * 0.3;
	const detailMin = rect.width * 0.3;
	left = Math.max(listMin, Math.min(rect.width - detailMin, left));
	const pct = ((left / rect.width) * 100).toFixed(2);
	content.style.gridTemplateColumns = `${pct}% 0.429rem 1fr`;
});
window.addEventListener('resize', syncLayout);
window.matchMedia(`(width <= ${MOBILE_BP}px)`).addEventListener('change', renderList);
syncLayout();

sidebarToggle?.addEventListener('click', toggleSidebar);
sidebarBackdrop?.addEventListener('click', () => setSidebarOpen(false));

// ============================================================
// TEAM MENU
// ============================================================
const teamSwitch = document.getElementById('team-switch');
const teamMenu = document.getElementById('team-menu');
teamSwitch.addEventListener('click', (e) => {
	e.stopPropagation();
	teamMenu.classList.toggle('open');
});
document.addEventListener('click', () => teamMenu.classList.remove('open'));
teamMenu.addEventListener('click', (e) => e.stopPropagation());

// ============================================================
// DETAIL TOGGLE
// ============================================================
/**
 * Collapses or restores the detail pane.
 * @returns {void}
 */
function toggleDetail() {
	// On phone, Back returns to the issue list.
	if (isMobileViewport() && content.classList.contains('mobile-detail-view')) {
		state.detailOpen = false;
		content.classList.add('collapsed-detail');
		syncLayout();
		return;
	}
	state.detailOpen = !state.detailOpen;
	content.classList.toggle('collapsed-detail', !state.detailOpen);
	if (!state.detailOpen) {
		content.style.removeProperty('grid-template-columns');
	} else {
		syncContentGrid();
	}
	syncMobileLayout();
}
document.getElementById('toggle-detail').addEventListener('click', toggleDetail);

// ============================================================
// DELETE ISSUES
// ============================================================

/**
 * Opens the delete confirmation modal and focuses the confirm button.
 * @returns {void}
 */
function openDeleteConfirm() {
	deleteBackdrop?.classList.add('open');
	setTimeout(() => document.getElementById('confirm-delete')?.focus(), 30);
}

/**
 * Closes the delete confirmation modal.
 * @returns {void}
 */
function closeDeleteConfirm() {
	deleteBackdrop?.classList.remove('open');
}

/**
 * Handles the confirmation click to delete an issue.
 * Calls the API, updates local state, and refreshes the UI.
 * @returns {Promise<void>}
 */
async function handleDeleteConfirm() {
	if (!state.selected) return;

	const confirmDeleteBtn = document.getElementById('confirm-delete');
	const originalText = confirmDeleteBtn.textContent;

	confirmDeleteBtn.textContent = 'Deleting...';
	confirmDeleteBtn.disabled = true;

	try {
		await deleteIssue(state.selected);

		const idx = ISSUES.findIndex((issue) => issue.id === state.selected);
		ISSUES = ISSUES.filter((issue) => issue.id !== state.selected);

		state.selected = ISSUES[idx]?.id ?? ISSUES[idx - 1]?.id ?? null;
		state.isEditing = false;

		renderList();
		renderDetail();
		showToast('Issue deleted');
		closeDeleteConfirm();
	} catch (err) {
		showToast(err.message || 'Failed to delete issue.');
	} finally {
		confirmDeleteBtn.textContent = originalText;
		confirmDeleteBtn.disabled = false;
	}
}

if (deleteBackdrop) {
	document.getElementById('cancel-delete')?.addEventListener('click', closeDeleteConfirm);
	document.getElementById('confirm-delete')?.addEventListener('click', handleDeleteConfirm);

	deleteBackdrop.addEventListener('click', (e) => {
		if (e.target === deleteBackdrop) closeDeleteConfirm();
	});
}

// ============================================================
// NEW ISSUE MODAL
// ============================================================
const newBackdrop = document.getElementById('new-backdrop');
const confirmNewBtn = document.getElementById('confirm-new');
const newIssueBtn = document.getElementById('new-issue');

/**
 * Enables or disables tracker actions that require loaded team context.
 * @param {boolean} ready Whether initTracker has finished successfully.
 * @returns {void}
 */
function setTrackerReady(ready) {
	trackerReady = ready;
	if (newIssueBtn) newIssueBtn.disabled = !ready;
	if (openTeamSettingsBtn) openTeamSettingsBtn.disabled = !ready;
}

setTrackerReady(false);
let pendingFiles = [];

/**
 * Refreshes the new-issue assignee dropdown from state.teamMembers.
 * @returns {void}
 */
function populateNewAssigneeSelect() {
	const assigneeSelect = document.getElementById('new-assignee');
	if (!assigneeSelect) return;

	const options = (state.teamMembers || []).map((m) => `<option value="${m.id}">${getUserDisplayName(m)}</option>`).join('');
	assigneeSelect.innerHTML = `<option value="">Unassigned</option>${options}`;
}

/**
 * Opens the new issue modal and refreshes assignee options from team members.
 * @returns {Promise<void>}
 */
async function openNew() {
	if (!trackerReady) return;

	if (state.currentTeamId && state.teamMembers.length === 0) {
		try {
			state.teamMembers = await fetchTeamMembers(state.currentTeamId);
			renderTeamMembers();
		} catch {
			state.teamMembers = [];
		}
	}

	newBackdrop.classList.add('open');
	populateNewAssigneeSelect();
	setTimeout(() => document.getElementById('new-title').focus(), 30);
}

/**
 * Closes the new issue modal and discards unsent draft state.
 * @returns {void}
 */
function closeNew() {
	newBackdrop.classList.remove('open');
	resetForm();
}
/**
 * Clears fields that only exist in the client-side issue draft.
 * @returns {void}
 */
function resetForm() {
	document.getElementById('new-title').value = '';
	document.getElementById('new-desc').value = '';
	document.getElementById('file-list').innerHTML = '';
	document.querySelectorAll('#tag-picker .tag-opt').forEach((btn) => btn.classList.remove('selected'));
	pendingFiles = [];
}

newIssueBtn?.addEventListener('click', () => openNew());
document.getElementById('cancel-new').addEventListener('click', closeNew);

document.getElementById('tag-picker').addEventListener('click', (e) => {
	const btn = e.target.closest('.tag-opt');
	if (btn) btn.classList.toggle('selected');
});

newBackdrop.addEventListener('click', (e) => {
	if (e.target === newBackdrop) closeNew();
});

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => addFiles(e.target.files));

['dragenter', 'dragover'].forEach((ev) =>
	dropzone.addEventListener(ev, (e) => {
		e.preventDefault();
		dropzone.classList.add('drag');
	}),
);

['dragleave', 'drop'].forEach((ev) =>
	dropzone.addEventListener(ev, (e) => {
		e.preventDefault();
		dropzone.classList.remove('drag');
	}),
);

dropzone.addEventListener('drop', (e) => {
	e.preventDefault();
	addFiles(e.dataTransfer.files);
});

/**
 * Queue files from drag-and-drop or file input for a new issue.
 * Rejects any files that are not text/log/json.
 * @param {FileList|File[]} files - Files to attach.
 * @returns {void}
 */
function addFiles(files) {
	const allowedTypes = ['text/plain', 'application/json'];
	const allowedExtensions = ['.log', '.txt', '.json'];

	Array.from(files).forEach((f) => {
		// Check by MIME type or by file extension (for .log files which often lack a MIME type)
		// Many .log files arrive without a useful MIME type, so extension is a
		// deliberate fallback rather than a duplicate validation path.
		const isAllowed = allowedTypes.includes(f.type) || allowedExtensions.some((ext) => f.name.toLowerCase().endsWith(ext));

		if (isAllowed) {
			pendingFiles.push(f);
		} else {
			// Alert the user that their file was rejected
			showToast(`Rejected ${f.name}: Only text/log files are allowed.`);
		}
	});

	renderFiles();
}

/**
 * Re-renders attachment chips so each remove button matches pendingFiles.
 * @returns {void}
 */
function renderFiles() {
	fileList.innerHTML = pendingFiles
		.map(
			(f, idx) => `
        <span class="file-chip">
            ${f.name}
            <span class="x" data-idx="${idx}">×</span>
        </span>`,
		)
		.join('');
	fileList.querySelectorAll('.x').forEach((x) => {
		x.addEventListener('click', () => {
			pendingFiles.splice(Number(x.dataset.idx), 1);
			renderFiles();
		});
	});
}

confirmNewBtn.addEventListener('click', async () => {
	const titleEl = document.getElementById('new-title');
	const descEl = document.getElementById('new-desc');
	const title = titleEl.value.trim();
	const desc = descEl.value.trim();

	if (!title) {
		titleEl.focus();
		return;
	}
	if (!desc) {
		descEl.focus();
		return;
	}

	const formData = new FormData();
	formData.append('title', title);
	formData.append('description', desc);
	if (state.currentTeamId) formData.append('team_id', state.currentTeamId);

	const priority = document.getElementById('new-priority')?.value;
	const category = document.getElementById('new-tag')?.value;
	const assignee = document.getElementById('new-assignee')?.value;
	// Only forward tags that exist in TAGS so invalid values can't reach the backend.
	const selectedTags = Array.from(document.querySelectorAll('#tag-picker .tag-opt.selected'))
		.map((btn) => btn.dataset.tag)
		.filter((t) => TAGS.includes(t))
		.join(',');

	if (priority) formData.append('priority', priority);
	// Only forward a known category enum value so invalid input can't reach the backend.
	if (category && CATEGORIES.includes(category)) {
		formData.append('category', category);
	}
	if (assignee) formData.append('assigned_to', assignee);
	if (selectedTags) formData.append('tags', selectedTags);

	pendingFiles.forEach((f) => formData.append('attachments', f));

	const originalText = confirmNewBtn.textContent;
	confirmNewBtn.textContent = 'Creating...';
	confirmNewBtn.disabled = true;

	try {
		showToast('Creating and analyzing issue...');

		const response = await createIssue(formData, isE2ETestMode());

		ISSUES = await fetchIssues(state.currentTeamId);

		if (response?.id && response.enriched) {
			const idx = ISSUES.findIndex((issue) => issue.id === response.id);
			if (idx !== -1) {
				ISSUES[idx] = applyEnrichedFields(ISSUES[idx], response.enriched);
			}
		}

		if (response.id) {
			state.selected = response.id;
		} else {
			state.selected = ISSUES[0]?.id ?? null;
		}

		closeNew();
		renderList();
		renderDetail();

		if (response.enriched && response.enriched.category) {
			showToast(`Created: Tagged as a ${response.enriched.priority} priority ${response.enriched.category}`);
		} else {
			showToast('Issue created');
		}
	} catch (err) {
		showToast(err.message || 'Failed to create issue.');
	} finally {
		confirmNewBtn.textContent = originalText;
		confirmNewBtn.disabled = false;
	}
});

// ============================================================
// DOWNLOADS
// ============================================================
document.getElementById('download-skills').addEventListener('click', async () => {
	try {
		const response = await fetch(CLI_SKILL_MD_URL);
		if (!response.ok) throw new Error('Failed to fetch cli/SKILL.md');

		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const downloadLink = document.createElement('a');
		downloadLink.href = url;
		downloadLink.download = 'SKILL.md';
		document.body.appendChild(downloadLink);
		downloadLink.click();
		downloadLink.remove();
		URL.revokeObjectURL(url);
		showToast('cli/SKILL.md downloaded');
	} catch {
		showToast('Could not download cli/SKILL.md');
	}
});

// ============================================================
// KEYBOARD
// ============================================================
document.addEventListener('keydown', (e) => {
	if (e.target.matches('input, textarea')) return;
	if (e.key === 'Escape') {
		if (deleteTeamBackdrop?.classList.contains('open')) {
			closeDeleteTeamConfirm();
			return;
		}
		if (deleteBackdrop?.classList.contains('open')) {
			closeDeleteConfirm();
			return;
		}
		if (settingsBackdrop?.classList.contains('open')) {
			closeTeamSettings();
			return;
		}
		if (newBackdrop.classList.contains('open')) closeNew();
		teamMenu.classList.remove('open');
	}
	if (e.key === 'n' && !e.metaKey && !e.ctrlKey && trackerReady) {
		e.preventDefault();
		openNew();
	}
	if (e.key === 'j' || e.key === 'k') {
		e.preventDefault();
		const rows = Array.from(listEl.querySelectorAll('.issue-row'));
		const idx = rows.findIndex((r) => Number(r.dataset.id) === state.selected);
		// Navigate through the rendered rows so active filters and groups define
		// the keyboard order.
		const next = e.key === 'j' ? Math.min(rows.length - 1, idx + 1) : Math.max(0, idx - 1);
		if (rows[next]) rows[next].click();
	}
});

detailEl.addEventListener('click', async (e) => {
	if (e.target.closest('.mobile-back-btn')) {
		toggleDetail();
		return;
	}

	const editBtn = e.target.closest('.edit-issue-btn');
	if (editBtn) {
		state.isEditing = true;
		renderDetail();
		return;
	}

	const editTagOpt = e.target.closest('.edit-tag-picker .tag-opt');
	if (editTagOpt) {
		editTagOpt.classList.toggle('selected');
		return;
	}

	const cancelBtn = e.target.closest('#cancel-edit');
	if (cancelBtn) {
		state.isEditing = false;
		renderDetail();
		return;
	}

	const deleteBtn = e.target.closest('.delete-issue-btn');
	if (deleteBtn) {
		openDeleteConfirm();
		return;
	}

	const saveBtn = e.target.closest('#save-edit');
	if (saveBtn) {
		const currentIssue = ISSUES.find((issue) => issue.id === state.selected);
		if (!currentIssue) return;

		const title = document.getElementById('edit-title')?.value.trim();
		const status = document.getElementById('edit-status')?.value;
		const priority = document.getElementById('edit-priority')?.value;
		const category = document.getElementById('edit-category')?.value;

		const tags = Array.from(document.querySelectorAll('#edit-tag-picker .tag-opt.selected'))
			.map((btn) => btn.dataset.tag)
			.filter((t) => TAGS.includes(t));

		const assignee = document.getElementById('edit-assignee')?.value;
		const description = document.getElementById('edit-desc')?.value.trim();

		if (!title || !description) {
			showToast('Title and details are required');
			return;
		}

		const updates = { title, status, priority, description };

		if (category && CATEGORIES.includes(category)) {
			updates.category = category;
		}

		if (document.getElementById('edit-tag-picker')) {
			updates.tags = tags;
		}

		if (assignee !== undefined) {
			updates.assigned_to = assignee ? Number(assignee) : null;
		}

		saveBtn.textContent = 'Saving...';
		saveBtn.disabled = true;
		try {
			await updateIssue(state.selected, updates);

			if (state.currentTeamId) {
				ISSUES = await fetchIssues(state.currentTeamId);
			} else {
				const index = ISSUES.findIndex((issue) => issue.id === state.selected);
				if (index !== -1) ISSUES[index] = { ...ISSUES[index], ...updates };
			}

			state.isEditing = false;
			renderList();
			renderDetail();
			showToast('Issue updated');
		} catch {
			showToast('Failed to save edits');
			saveBtn.textContent = 'Save';
			saveBtn.disabled = false;
		}
		return;
	}
});

// ============================================================
// TEAM NOT FOUND
// ============================================================

/**
 * Replaces the content pane with a 404-style error when the requested team
 * does not exist or the user no longer has access to it.
 * @param {number} teamId requested team id from the URL.
 * @returns {void}
 */
function renderTeamNotFound(teamId) {
	const contentEl = document.getElementById('content');
	contentEl.classList.add('is-error');
	const safeTeamId = escapeHtml(String(teamId));
	contentEl.innerHTML = `
		<div class="page-error">
			<div class="glyph">⊘</div>
			<h2>Team not found</h2>
			<p>The team <code>#${safeTeamId}</code> doesn't exist, or you no longer have access to it. Check the link, or pick a team you belong to.</p>
			<div class="pe-actions">
				<a class="btn primary" href="teams.html">← Back to teams</a>
				<button class="btn" id="retry-team">Retry</button>
			</div>
			<div><span class="pe-status"><span class="code">404</span> GET /teams/${safeTeamId}</span></div>
		</div>`;

	const teamSwitchEl = document.getElementById('team-switch');
	if (teamSwitchEl) {
		teamSwitchEl.style.opacity = '0.5';
		teamSwitchEl.style.pointerEvents = 'none';
	}

	document.getElementById('retry-team').addEventListener('click', () => location.reload());
}

// ============================================================
// INIT
// ============================================================

/**
 * Loads team context, then fetches issues and members for the active team.
 * @returns {Promise<void>}
 */
async function initTracker() {
	const qs = new URLSearchParams(location.search);
	const teamIdParam = qs.get('team_id');
	const teamId = teamIdParam !== null ? Number(teamIdParam) : null;

	// A present-but-invalid team_id (e.g. ?team_id=abc) must surface the
	// not-found state instead of silently loading an empty tracker.
	if (teamIdParam !== null && (teamIdParam.trim() === '' || !Number.isInteger(teamId))) {
		renderTeamNotFound(teamIdParam);
		return;
	}

	try {
		const teams = await fetchTeams();
		state.teams = teams;

		renderTeamMenu();

		const currentTeam = teams.find((t) => t.id === teamId);

		if (teamId && !currentTeam) {
			renderTeamNotFound(teamId);
			return;
		}

		if (currentTeam) {
			document.getElementById('team-label').textContent = currentTeam.team_name;
			const markEl = document.querySelector('.team-switch > .mark');
			markEl.textContent = getTeamMark(currentTeam.team_name);
			state.currentTeamName = currentTeam.team_name;
			state.currentTeamBio = currentTeam.bio || '';
			state.currentTeamRole = currentTeam.role;
		}

		state.currentTeamId = currentTeam ? currentTeam.id : null;

		if (state.currentTeamId) {
			// Members are optional for rendering; issues are not. Keep the page
			// usable if the member endpoint is unavailable.
			const [fetchedIssues, fetchedMembers] = await Promise.all([
				fetchIssues(state.currentTeamId),
				fetchTeamMembers(state.currentTeamId).catch(() => []),
			]);

			ISSUES = fetchedIssues;
			state.teamMembers = fetchedMembers;
		} else {
			ISSUES = [];
			state.teamMembers = [];
			state.currentTeamName = '';
			state.currentTeamBio = '';
			state.currentTeamRole = null;
		}

		if (ISSUES.length > 0 && !ISSUES.find((i) => i.id === state.selected)) {
			state.selected = ISSUES[0].id;
		}

		renderTeamMembers();
		populateNewAssigneeSelect();
		renderList();
		renderDetail();

		if (isMobileViewport()) {
			state.detailOpen = false;
			content.classList.add('collapsed-detail');
		}
		syncLayout();

		setTrackerReady(true);
	} catch {
		showToast('Failed to load workspace data.');
	}
}

(async () => {
	if (!(await requireAuth())) return;
	await initTracker();
})();
