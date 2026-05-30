import { PRI_ORDER, STATUS_ORDER, STATUS_NAME, SKILLS_MD, TAGS, TAG_MAP } from './constants.js';

import { fetchIssues, createIssue, updateIssue } from './api.js';
import { requireAuth, inviteToTeam, fetchTeams, fetchTeamMembers } from './api.js';

requireAuth(); // forces the user to sign up if this page is accessed without credentials

// Sidebar filters: status + tag only (priority is sortable, not filterable here).
const state = {
	sort: 'priority',
	tag: 'all',
	status: 'all',
	query: '',
	selected: null,
	detailOpen: true,
	isEditing: false, // Track if we are in edit mode
	teams: [],
	currentTeamId: null,
	teamMembers: [],
};

let ISSUES = [];

const inviteBackdrop = document.getElementById('invite-backdrop');
const confirmInviteBtn = document.getElementById('confirm-invite');
const inviteInput = document.getElementById('invite-input');
const inviteLinkDisplay = document.getElementById('invite-link-display');
const copyInviteLinkBtn = document.getElementById('copy-invite-link');
const openInviteModalBtn = document.getElementById('open-invite-modal');

const listEl = document.getElementById('issue-list');
const totalCountEl = document.getElementById('total-count');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');

// helpers for invite listeners below
/**
 * Opens the invite modal only after a team has been resolved from the URL.
 * Also populates the copyable join link for the current team.
 */
function openInvite() {
	if (!state.currentTeamId) {
		showToast('No active team selected.');
		return;
	}
	inviteBackdrop.classList.add('open');

	if (inviteLinkDisplay) {
		inviteLinkDisplay.value = new URL(`join.html?team_id=${state.currentTeamId}`, window.location.href).href;
	}

	setTimeout(() => inviteInput.focus(), 30);
}

/**
 * Closes the invite modal and clears the draft recipient.
 */
function closeInvite() {
	inviteBackdrop.classList.remove('open');
	inviteInput.value = '';
}

if (copyInviteLinkBtn) {
	copyInviteLinkBtn.addEventListener('click', async () => {
		const url = inviteLinkDisplay?.value;
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			const original = copyInviteLinkBtn.textContent;
			copyInviteLinkBtn.textContent = 'Copied!';
			setTimeout(() => {
				copyInviteLinkBtn.textContent = original;
			}, 1500);
		} catch {
			showToast('Could not copy link — try selecting it manually.');
		}
	});
}

if (openInviteModalBtn) openInviteModalBtn.addEventListener('click', openInvite);

document.getElementById('cancel-invite').addEventListener('click', closeInvite);

inviteBackdrop.addEventListener('click', (e) => {
	if (e.target === inviteBackdrop) closeInvite();
});

confirmInviteBtn.addEventListener('click', async () => {
	const val = inviteInput.value.trim();
	if (!val) {
		inviteInput.focus();
		return;
	}

	const isEmail = val.includes('@');
	const payload = isEmail ? { email: val } : { username: val };

	const originalText = confirmInviteBtn.textContent;
	confirmInviteBtn.textContent = 'Sending...';
	confirmInviteBtn.disabled = true;

	try {
		await inviteToTeam(state.currentTeamId, payload);
		showToast(`Invitation sent to ${val}`);
		closeInvite();
	} catch (err) {
		showToast(err.message || 'Failed to send invite.');
	} finally {
		confirmInviteBtn.textContent = originalText;
		confirmInviteBtn.disabled = false;
	}
});

/**
 * Whether an issue matches a sidebar tag filter.
 * @param {object} issue Issue data from the API.
 * @param {string} tag Sidebar tag filter value.
 * @returns {boolean}
 */
function issueMatchesTag(issue, tag) {
	if ((issue.tags || []).includes(tag)) return true;
	if (tag === 'bug' && issue.category === 'Bug') return true;
	return false;
}

/**
 * Builds sidebar TAG filter rows from TAGS in constants.js.
 */
function renderTagFilters() {
	const container = document.getElementById('tag-filters');
	if (!container) return;

	container.innerHTML = TAGS.map(
		(t) => `
		<div class="filter-item" data-group="tag" data-val="${t}">
			<span class="indicator label-${t}"></span> ${t}
			<span class="count" id="cnt-${t}">0</span>
		</div>`,
	).join('');
}

/**
 * Populates the new-issue tag dropdown from TAGS.
 */
function populateNewTagSelect() {
	const select = document.getElementById('new-tag');
	if (!select) return;

	select.innerHTML = TAGS.map((t) => `<option value="${t}">${t}</option>`).join('');
}

/**
 * Gets issue counts and updates the sidebar UI
 * Reuses the fetched issue list so counts match the active team and filters.
 */
function syncSidebar() {
	if (!ISSUES) return;

	const safeSet = (id, count) => {
		const el = document.getElementById(id);
		if (el) el.textContent = count;
	};

	safeSet('cnt-all', ISSUES.length);

	safeSet('cnt-open', ISSUES.filter((i) => i.status === 'Open').length);
	safeSet('cnt-prog', ISSUES.filter((i) => i.status === 'In Progress').length);
	safeSet('cnt-resolved', ISSUES.filter((i) => i.status === 'Resolved').length);
	safeSet('cnt-closed', ISSUES.filter((i) => i.status === 'Closed').length);

	// Tag counts drive sidebar filter badges (cnt-bug, cnt-ui, cnt-infra, cnt-auth, cnt-perf).
	TAGS.forEach((t) => {
		safeSet(`cnt-${t}`, ISSUES.filter((i) => issueMatchesTag(i, t)).length);
	});
}

const sidebarEl = document.querySelector('.sidebar');
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
	});
}

renderTagFilters();
populateNewTagSelect();

/**
 * Filters, sorts, groups, and re-renders the issue list.
 */
function renderList() {
	syncSidebar();

	let items = ISSUES.slice();

	if (state.tag !== 'all') {
		items = items.filter((i) => issueMatchesTag(i, state.tag));
	}
	if (state.status !== 'all') {
		// Each status filter maps to a single backend status value.
		items = items.filter((i) => i.status === state.status);
	}

	if (state.sort === 'priority') {
		items.sort((a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority] || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
	} else if (state.sort === 'updated') {
		items.sort((a, b) => ISSUES.indexOf(a) - ISSUES.indexOf(b));
	}

	totalCountEl.textContent = items.length;

	let groups;
	if (state.sort === 'priority') {
		// Priority groups stay in product order even when some buckets are empty.
		const buckets = { Critical: [], High: [], Medium: [], Low: [] };
		items.forEach((i) => buckets[i.priority]?.push(i));
		groups = [
			{ label: 'Critical', rows: buckets.Critical },
			{ label: 'High', rows: buckets.High },
			{ label: 'Medium', rows: buckets.Medium },
			{ label: 'Low', rows: buckets.Low },
		].filter((g) => g.rows.length);
	} else {
		groups = [{ label: 'Most recent', rows: items }];
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
			// Selection should reveal the pane; otherwise a row click can look
			// ignored after the user has collapsed issue details.
			if (!state.detailOpen) toggleDetail();
		});
	});
}

/**
 * Creates team menu
 * Renders the team switcher from API-backed team membership.
 */
function renderTeamMenu() {
	const teamMenu = document.getElementById('team-menu');

	const currentId = Number(new URLSearchParams(location.search).get('team_id'));

	const itemsHtml = state.teams
		.map((t) => {
			const words = t.team_name.trim().split(' ');
			const mark = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : t.team_name.substring(0, 2).toUpperCase();

			const isActive = t.id === currentId ? 'active' : '';

			return `
            <div class="item ${isActive}" data-id="${t.id}">
                <span class="mark c1">${mark}</span>
                ${t.team_name}
            </div>
        `;
		})
		.join('');

	teamMenu.innerHTML = `
        ${itemsHtml}
        <div class="divider"></div>
        <div class="item" data-action="all-teams">
            <span class="mark all-teams-mark">+</span>
            All teams &amp; settings
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
 * Renders the team members avatars in the sidebar based on real API data
 */
/**
 * Renders the team members avatars in the sidebar based on real API data
 * Falls back to username/email when profile names are not present.
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
			let initials = '??';

			// safe check since API was not updated during tests
			// Older API fixtures may not have profile names yet.
			if (member.first_name && member.last_name) {
				initials = (member.first_name.charAt(0) + member.last_name.charAt(0)).toUpperCase();
			} else {
				const identifier = member.username || member.email || '??';
				initials = identifier.substring(0, 2).toUpperCase();
			}

			const displayName = member.first_name && member.last_name ? `${member.first_name} ${member.last_name}` : member.username;

			return `<div class="avatar" title="${displayName} (${member.role})">${initials}</div>`;
		})
		.join('');

	membersContainer.innerHTML = membersHtml;
}

// === Date Formatting === //
/**
 * @param {string | null | undefined} value - Raw timestamp from the API.
 * @returns {Date | null}
 */
function parseIssueTimestamp(value) {
	if (!value) return null;
	const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
	const date = new Date(normalized);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {string | null | undefined} value - Raw timestamp from the API.
 * @returns {string}
 */
function formatIssueDate(value) {
	const date = parseIssueTimestamp(value);
	if (!date) return value || '—';

	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayDiff = Math.round((startOfToday - startOfDate) / 86400000);

	if (dayDiff === 0) return 'Today';
	if (dayDiff === 1) return 'Yesterday';

	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/**
 * @param {string | null | undefined} value - Raw timestamp from the API.
 * @returns {string}
 */
function formatIssueDateTime(value) {
	const date = parseIssueTimestamp(value);
	if (!date) return value || '';

	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	}).format(date);
}

// === Issue detail display (view pane) === //
// Summary, Hypothesis, and Steps come from LLM enrichment; Details is the user's create-form description.

/**
 * Escape user/LLM text before inserting into detail pane HTML.
 * @param {string} text - Raw text to escape.
 * @returns {string}
 */
function escapeHtml(text) {
	return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Plain-text section body with fallback when LLM/user field is empty.
 * @param {string | null | undefined} value - Field value from the issue record.
 * @param {string} [fallback='Not available yet'] - Text shown when value is empty.
 * @returns {string}
 */
function formatIssueText(value, fallback = 'Not available yet') {
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
function formatStepsToReproduce(value) {
	if (value === null || value === undefined || value === '') return 'Not available yet';

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
		if (items.length === 0) return 'Not available yet';
		return `<ol class="issue-section-body issue-steps">${items.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>`;
	}

	const text = String(steps).trim();
	return text ? `<p class="issue-section-body">${escapeHtml(text)}</p>` : 'Not available yet';
}

/**
 * Resolve the primary tag for an issue from tags or legacy category.
 * @param {object} issue - Issue record from the API.
 * @returns {string}
 */
function getIssueTag(issue) {
	const tag = (issue.tags || []).find((t) => TAGS.includes(t));
	if (tag) return tag;
	const cat = issue.category?.toLowerCase();
	if (TAGS.includes(cat)) return cat;
	return 'bug';
}

/**
 * Build HTML for a single issue row in the list.
 * @param {object} i - Issue record.
 * @returns {string} HTML string for the row.
 */
function rowHtml(i) {
	const isSel = state.selected === i.id;
	const statusKey = i.status === 'In Progress' ? 'prog' : i.status.toLowerCase();

	// Tag Shrink Logic
	const maxTags = 2;
	const visibleTags = (i.tags || []).slice(0, maxTags);
	const moreCount = (i.tags || []).length - maxTags;

	const tagsHtml =
		visibleTags.map((l) => `<span class="chip tag-${l}">${l}</span>`).join('') +
		(moreCount > 0 ? `<span class="chip tag-more">+${moreCount}</span>` : '');

	return `
	<div class="issue-row ${isSel ? 'selected' : ''}" data-id="${i.id}">
		<div class="title">
			<span>${i.title}</span>
			<span class="sub">${i.summary || ''}</span>
		</div>
		<div class="labels">${tagsHtml}</div>
		<span class="chip st-${statusKey}">${STATUS_NAME[i.status]}</span>
		<span class="updated" title="${formatIssueDateTime(i.updated_at)}">${formatIssueDate(i.updated_at)}</span>
	</div>`;
}

// ============================================================
// RENDER DETAIL
// ============================================================
const detailEl = document.getElementById('detail');

/**
 * Renders the currently selected issue, including derived assignee display.
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

	// Implementation of View vs Edit Mode
	if (!state.isEditing) {
		// --- VIEW MODE ---
		// Sections: Summary / Steps / Hypothesis (LLM) + Details (user description on create)
		detailEl.innerHTML = `
			<div class="issue-details-header">
				<h1 class="h-2" style="margin:0">${i.title}</h1>
				<button type="button" class="btn sm edit-issue-btn" title="Edit Issue">✎</button>
			</div>
			
			<div class="details-meta-grid">
				<div class="meta-col">
					<span class="label-sm">STATUS</span>
					<span class="chip st-${statusKey} sm">${i.status}</span>
				</div>
				<div class="meta-col">
					<span class="label-sm">PRIORITY</span>
					<span class="chip sm"><span class="dot" style="background:var(--pri-${i.priority.toLowerCase()})"></span>${i.priority}</span>
				</div>
				<div class="meta-col">
					<span class="label-sm">LABELS</span>
					<div class="tag-container">
						${(i.tags || []).map((t) => `<span class="chip sm tag-${t}">${t}</span>`).join('')}
					</div>
				</div>
				<div class="meta-col">
					<span class="label-sm">ASSIGNEE</span>
					<div class="avatar sm">AT</div>
				</div>
			</div>

			<div class="detail-body">
				<div class="ai-content-block">
					<span class="label-sm">Summary</span>
					<p class="issue-section-body">${formatIssueText(i.summary)}</p>
				</div>
				<div class="ai-content-block" style="margin-top:24px">
					<span class="label-sm">Steps to reproduce</span>
					${formatStepsToReproduce(i.steps_to_reproduce)}
				</div>
				<div class="ai-content-block" style="margin-top:24px">
					<span class="label-sm">Hypothesis</span>
					<p class="issue-section-body">${formatIssueText(i.hypothesis)}</p>
				</div>
				<div class="ai-content-block" style="margin-top:24px">
					<span class="label-sm">Details</span>
					<p class="issue-section-body">${formatIssueText(i.description, 'No description provided.')}</p>
				</div>
			</div>`;
	} else {
		// --- EDIT MODE — human fields only; LLM sections stay read-only in view mode ---
		detailEl.innerHTML = `
			<div class="issue-details-header">
				<input class="input h-2" id="edit-title" value="${i.title}" style="width: 70%">
				<div class="actions">
					<button type="button" class="btn sm" id="cancel-edit">Cancel</button>
					<button type="button" class="btn sm primary" id="save-edit">Save</button>
				</div>
			</div>
			
			<div class="details-meta-grid">
				<div class="meta-col">
					<span class="label-sm">STATUS</span>
					<select class="input sm" id="edit-status">
						<option ${i.status === 'Open' ? 'selected' : ''}>Open</option>
						<option ${i.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
						<option ${i.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
						<option ${i.status === 'Closed' ? 'selected' : ''}>Closed</option>
					</select>
				</div>
				<div class="meta-col">
					<span class="label-sm">PRIORITY</span>
					<select class="input sm" id="edit-priority">
						<option ${i.priority === 'Critical' ? 'selected' : ''}>Critical</option>
						<option ${i.priority === 'High' ? 'selected' : ''}>High</option>
						<option ${i.priority === 'Medium' ? 'selected' : ''}>Medium</option>
						<option ${i.priority === 'Low' ? 'selected' : ''}>Low</option>
					</select>
				</div>
				<div class="meta-col">
					<span class="label-sm">TAG</span>
					<select class="input sm" id="edit-tag">
						${TAGS.map((t) => `<option value="${t}" ${getIssueTag(i) === t ? 'selected' : ''}>${t}</option>`).join('')}
					</select>
				</div>
			</div>

			<div class="detail-body">
				<span class="label-sm">Details</span>
				<textarea class="textarea" id="edit-desc" style="margin-top:8px">${i.description || ''}</textarea>
			</div>`;
	}
}

// ============================================================
// CONTROLS — search, sort, tag
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
		document.querySelectorAll('.sort-btn').forEach((x) => x.classList.remove('on'));
		b.classList.add('on');
		state.sort = b.dataset.sort;
		renderList();
	});
});
document.querySelectorAll('.chip-btn').forEach((b) => {
	b.addEventListener('click', () => {
		document.querySelectorAll('.chip-btn').forEach((x) => x.classList.remove('on'));
		b.classList.add('on');
		state.tag = b.dataset.tag;
		renderList();
	});
});

// ============================================================
// DIVIDER DRAG
// ============================================================
const content = document.getElementById('content');
const divider = document.getElementById('divider');
let dragging = false;
divider.addEventListener('mousedown', () => {
	dragging = true;
	divider.classList.add('dragging');
	document.body.style.userSelect = 'none';
});
window.addEventListener('mouseup', () => {
	if (!dragging) return;
	dragging = false;
	divider.classList.remove('dragging');
	document.body.style.userSelect = '';
	localStorage.setItem('detailWidth', content.style.gridTemplateColumns);
});
window.addEventListener('mousemove', (e) => {
	if (!dragging) return;
	const rect = content.getBoundingClientRect();
	let left = e.clientX - rect.left;
	// Clamp the divider so both panes remain usable before persisting the grid
	// template as the user's preferred layout.
	left = Math.max(340, Math.min(rect.width - 380, left));
	content.style.gridTemplateColumns = `${left}px 6px 1fr`;
});
const savedWidth = localStorage.getItem('detailWidth');
if (savedWidth) content.style.gridTemplateColumns = savedWidth;

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
 */
function toggleDetail() {
	state.detailOpen = !state.detailOpen;
	content.classList.toggle('collapsed-detail', !state.detailOpen);
}
document.getElementById('toggle-detail').addEventListener('click', toggleDetail);

// ============================================================
// NEW ISSUE MODAL
// ============================================================
const newBackdrop = document.getElementById('new-backdrop');
const confirmNewBtn = document.getElementById('confirm-new');
let pendingFiles = [];

/**
 * Opens the new issue modal and refreshes assignee options from team members.
 */
function openNew() {
	newBackdrop.classList.add('open');

	const assigneeSelect = document.getElementById('new-assignee');
	if (assigneeSelect && state.teamMembers) {
		const options = state.teamMembers
			.map((m) => {
				const name = m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username;
				return `<option value="${m.id}">${name}</option>`;
			})
			.join('');
		assigneeSelect.innerHTML = `<option value="">Unassigned</option>${options}`;
	}

	setTimeout(() => document.getElementById('new-title').focus(), 30);
}

/**
 * Closes the new issue modal and discards unsent draft state.
 */
function closeNew() {
	newBackdrop.classList.remove('open');
	resetForm();
}
/**
 * Clears fields that only exist in the client-side issue draft.
 */
function resetForm() {
	document.getElementById('new-title').value = '';
	document.getElementById('new-desc').value = '';
	document.getElementById('file-list').innerHTML = '';
	document.querySelectorAll('#tag-picker .tag-opt').forEach((btn) => btn.classList.remove('selected'));
	pendingFiles = [];
}
document.getElementById('new-issue').addEventListener('click', openNew);
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
	const tag = document.getElementById('new-tag')?.value;
	const assignee = document.getElementById('new-assignee')?.value;
	const difficulty = document.getElementById('new-difficulty')?.value;
	const selectedTags = Array.from(document.querySelectorAll('#tag-picker .tag-opt.selected'))
		.map((btn) => btn.dataset.tag)
		.join(',');

	if (priority) formData.append('priority', priority);
	if (tag) {
		formData.append('tags', tag);
		formData.append('category', TAG_MAP[tag]);
	}
	if (assignee) formData.append('assigned_to', assignee);
	if (difficulty) formData.append('difficulty', difficulty);
	if (selectedTags) formData.append('tags', selectedTags);

	pendingFiles.forEach((f) => formData.append('attachments', f));

	const originalText = confirmNewBtn.textContent;
	confirmNewBtn.textContent = 'Creating...';
	confirmNewBtn.disabled = true;

	try {
		showToast('Creating and analyzing issue...');

		const response = await createIssue(formData);

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
// TOAST & DOWNLOADS
// ============================================================
const toast = document.getElementById('toast');
/**
 * Show a short-lived toast notification.
 * @param {string} msg - Message to display.
 * @returns {void}
 */
function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

document.getElementById('download-skills').addEventListener('click', () => {
	const blob = new Blob([SKILLS_MD], { type: 'text/markdown' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'skills.md';
	document.body.appendChild(a);
	a.click();
	a.remove();
	// Object URLs hold browser resources until explicitly released.
	URL.revokeObjectURL(url);
	showToast('skills.md downloaded');
});

// ============================================================
// KEYBOARD
// ============================================================
document.addEventListener('keydown', (e) => {
	if (e.target.matches('input, textarea')) return;
	if (e.key === 'Escape') {
		if (newBackdrop.classList.contains('open')) closeNew();
		if (inviteBackdrop.classList.contains('open')) closeInvite();
		teamMenu.classList.remove('open');
	}
	if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
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
	const editBtn = e.target.closest('.edit-issue-btn');
	if (editBtn) {
		state.isEditing = true;
		renderDetail();
		return;
	}

	const cancelBtn = e.target.closest('#cancel-edit');
	if (cancelBtn) {
		state.isEditing = false;
		renderDetail();
		return;
	}

	const saveBtn = e.target.closest('#save-edit');
	if (saveBtn) {
		const currentIssue = ISSUES.find((issue) => issue.id === state.selected);
		if (!currentIssue) return;

		const title = document.getElementById('edit-title')?.value.trim();
		const status = document.getElementById('edit-status')?.value;
		const priority = document.getElementById('edit-priority')?.value;
		const tag = document.getElementById('edit-tag')?.value;
		const description = document.getElementById('edit-desc')?.value.trim();

		if (!title || !description) {
			showToast('Title and details are required');
			return;
		}

		const updates = { title, status, priority, description, tags: [tag], category: TAG_MAP[tag] };

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

	// Fix close details blank page
	// If your "Back" or "Details" toggle clears selection, ensure it re-renders
	if (e.target.id === 'toggle-detail') {
		state.selected = null; // Clear selection to avoid "stuck" highlights
		renderList();
		renderDetail();
	}
	if (e.target.matches('.mark-done-btn')) {
		const btn = e.target;
		btn.textContent = 'Saving...';
		btn.disabled = true;
		try {
			await updateIssue(state.selected, { status: 'Resolved' });

			const index = ISSUES.findIndex((i) => i.id === state.selected);
			if (index !== -1) ISSUES[index] = { ...ISSUES[index], status: 'Resolved' };

			renderList();
			renderDetail();
			showToast('Issue marked as resolved');
		} catch {
			btn.textContent = 'Mark done';
			btn.disabled = false;
			showToast('Failed to update status');
		}
	}
});

// ============================================================
// TEAM NOT FOUND
// ============================================================

/**
 * Replaces the content pane with a 404-style error when the requested team
 * does not exist or the user no longer has access to it.
 * @param {number} teamId requested team id from the URL.
 */
function renderTeamNotFound(teamId) {
	const contentEl = document.getElementById('content');
	contentEl.classList.add('is-error');
	contentEl.innerHTML = `
		<div class="page-error">
			<div class="glyph">⊘</div>
			<h2>Team not found</h2>
			<p>The team <code>#${teamId}</code> doesn't exist, or you no longer have access to it. Check the link, or pick a team you belong to.</p>
			<div class="pe-actions">
				<a class="btn primary" href="teams.html">← Back to teams</a>
				<button class="btn" id="retry-team">Retry</button>
			</div>
			<div><span class="pe-status"><span class="code">404</span> GET /teams/${teamId}</span></div>
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
 */
async function initTracker() {
	const qs = new URLSearchParams(location.search);
	const teamIdParam = qs.get('team_id');
	const teamId = teamIdParam ? Number(teamIdParam) : null;

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
			const words = currentTeam.team_name.trim().split(' ');
			markEl.textContent =
				words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : currentTeam.team_name.substring(0, 2).toUpperCase();
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
		}

		if (ISSUES.length > 0 && !ISSUES.find((i) => i.id === state.selected)) {
			state.selected = ISSUES[0].id;
		}

		renderTeamMembers();
		renderList();
		renderDetail();
	} catch {
		showToast('Failed to load workspace data.');
	}
}

initTracker();
