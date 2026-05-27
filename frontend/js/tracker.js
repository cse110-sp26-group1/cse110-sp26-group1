import { PRI_ORDER, STATUS_ORDER, PRI_LABEL, PRI_NAME, STATUS_NAME, SKILLS_MD } from './constants.js';

import { fetchIssues, fetchIssue, createIssue, updateIssue, deleteIssue } from './api.js';
import { requireAuth, inviteToTeam, fetchTeams, fetchTeamMembers } from './api.js';

requireAuth(); // forces the user to sign up if this page is accessed without credentials

// STATE
const state = {
	sort: 'priority',
	tag: 'all',
	status: 'all',
	priority: 'all',
	query: '',
	selected: null,
	detailOpen: true,
	teams: [],
	currentTeamId: null,
	teamMembers: [],
};

let ISSUES = [];

const inviteBackdrop = document.getElementById('invite-backdrop');
const confirmInviteBtn = document.getElementById('confirm-invite');
const inviteInput = document.getElementById('invite-input');
const openInviteModalBtn = document.getElementById('open-invite-modal');

const listEl = document.getElementById('issue-list');
const totalCountEl = document.getElementById('total-count');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');

// helpers for invite listeners below
/**
 * Opens the invite modal only after a team has been resolved from the URL.
 */
function openInvite() {
	if (!state.currentTeamId) {
		showToast('No active team selected.');
		return;
	}
	inviteBackdrop.classList.add('open');
	setTimeout(() => inviteInput.focus(), 30);
}

/**
 * Closes the invite modal and clears the draft recipient.
 */
function closeInvite() {
	inviteBackdrop.classList.remove('open');
	inviteInput.value = '';
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
 * Applies the team selected by URL slug after teams are fetched.
 */
function applyTeamFromUrl() {
	const qs = new URLSearchParams(location.search);
	const slug = qs.get('team');

	// Look up from our fetched state instead of the static object
	// The page can only render teams returned by the API for this user.
	const t = state.teams.find((team) => team.slug === slug);
	if (!t) return;

	document.getElementById('team-label').textContent = t.name;
	const mark = document.querySelector('.team-switch > .mark');
	mark.textContent = t.mark;
	mark.style.background = `oklch(0.92 0.04 ${t.color})`;
	mark.style.color = `oklch(0.4 0.12 ${t.color})`;
}

/**
 * Calculates issue counts and updates the sidebar UI
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
	safeSet('cnt-done', ISSUES.filter((i) => ['Resolved', 'Closed'].includes(i.status)).length);

	safeSet('cnt-crit', ISSUES.filter((i) => i.priority === 'Critical').length);
	safeSet('cnt-high', ISSUES.filter((i) => i.priority === 'High').length);
	safeSet('cnt-med', ISSUES.filter((i) => i.priority === 'Medium').length);
	safeSet('cnt-low', ISSUES.filter((i) => i.priority === 'Low').length);

	['bug', 'ui', 'infra', 'auth', 'perf'].forEach((t) => {
		safeSet(`cnt-${t}`, ISSUES.filter((i) => (i.tags || []).includes(t)).length);
	});
}

document.querySelectorAll('.sidebar .nav-item[data-group]').forEach((item) => {
	item.addEventListener('click', () => {
		document.querySelectorAll('.sidebar .nav-item').forEach((el) => el.classList.remove('active'));
		item.classList.add('active');

		const group = item.dataset.group;
		const val = item.dataset.val;

		state.tag = 'all';
		state.status = 'all';
		state.priority = 'all';

		if (group === 'tag') state.tag = val;
		if (group === 'status') state.status = val;
		if (group === 'priority') state.priority = val;

		renderList();
	});
});

/**
 * Filters, sorts, groups, and re-renders the issue list.
 */
function renderList() {
	syncSidebar();

	let items = ISSUES.slice();

	if (state.tag !== 'all') {
		items = items.filter((i) => (i.tags || []).includes(state.tag));
	}
	if (state.status !== 'all') {
		if (state.status === 'Resolved') {
			items = items.filter((i) => ['Resolved', 'Closed'].includes(i.status));
		} else {
			items = items.filter((i) => i.status === state.status);
		}
	}
	if (state.priority !== 'all') {
		items = items.filter((i) => i.priority === state.priority);
	}

	if (state.sort === 'priority') {
		items.sort((a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority] || STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
	} else if (state.sort === 'updated') {
		items.sort((a, b) => ISSUES.indexOf(a) - ISSUES.indexOf(b));
	} else if (state.sort === 'difficulty') {
		items.sort((a, b) => b.difficulty - a.difficulty);
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
	} else if (state.sort === 'difficulty') {
		const map = {};
		items.forEach((i) => {
			const k = `Difficulty ${i.difficulty}`;
			if (!map[k]) map[k] = [];
			map[k].push(i);
		});
		groups = Object.entries(map).map(([label, rows]) => ({ label, rows }));
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

/**
 * Build HTML for a single issue row in the list.
 * @param {object} i - Issue record.
 * @returns {string} HTML string for the row.
 */
function rowHtml(i) {
	const isSel = state.selected === i.id;
	const statusKey = i.status === 'In Progress' ? 'prog' : i.status.toLowerCase();
	return `
	<div class="issue-row ${isSel ? 'selected' : ''}" data-id="${i.id}">
		<span class="pri-mark ${i.priority.toLowerCase()}" title="${PRI_NAME[i.priority]}">${PRI_LABEL[i.priority]}</span>
		<div class="title">
			<span>${i.title}</span>
			<span class="sub">${i.summary || ''}</span>
		</div>
		<div class="labels">${i.tags.map((l) => `<span class="chip tag-${l}">${l}</span>`).join('')}</div>
		<span class="chip st-${statusKey}">${STATUS_NAME[i.status]}</span>
		<span class="updated">${i.updated_at}</span>
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
	const diffPips = Array.from({ length: 3 }, (_, k) => `<span class="d ${k < i.difficulty ? 'on' : ''}"></span>`).join('');
	const statusKey = i.status === 'In Progress' ? 'prog' : i.status.toLowerCase();

	// FIX: temp thing for later loading
	// The backend flags issues being enriched by tagging them instead of
	// introducing a separate transient status.
	const processingBanner = i.tags.includes('ai-processing') ? '<span class="processing">AI is enriching this issue…</span>' : '';

	let assigneeHtml = `<span class="avatar sm" style="background: transparent; border: 1px dashed #888; color: #888;">--</span><span style="font-size:13px; color: #888;">Unassigned</span>`;

	if (i.assigned_to && state.teamMembers) {
		const member = state.teamMembers.find((m) => m.id === i.assigned_to);
		if (member) {
			const initials =
				(member.first_name?.charAt(0) || member.username?.charAt(0) || '?').toUpperCase() +
				(member.last_name?.charAt(0) || '').toUpperCase();
			const name = member.first_name && member.last_name ? `${member.first_name} ${member.last_name}` : member.username;
			assigneeHtml = `<span class="avatar sm">${initials}</span><span style="font-size:13px;">${name}</span>`;
		}
	}

	detailEl.innerHTML = `
        <div class="detail-head">
            ${processingBanner}
            <div class="actions">
                <button class="btn sm">Copy link</button>
                <button class="btn sm edit-issue-btn">Edit</button>
                <button class="btn sm primary mark-done-btn">Mark done</button>
            </div>
        </div>
        <div class="detail-body">
            <h1 class="issue-title">${i.title}</h1>
            <div class="meta-strip">
                <div class="cell">
                    <span class="label">Status</span>
                    <span class="chip st-${statusKey}">${STATUS_NAME[i.status] || i.status}</span>
                </div>
                <div class="cell">
                    <span class="label">Priority</span>
                    <span class="chip pri-${i.priority}"><span class="dot"></span>${PRI_NAME[i.priority] || i.priority}</span>
                </div>
                <div class="cell">
                    <span class="label">Difficulty</span>
                    <span class="diff">${diffPips}</span>
                </div>
                <div class="cell" style="flex:1; min-width:160px;">
                    <span class="label">Labels</span>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    	${i.tags.map((l) => `<span class="chip tag-${l}">${l}</span>`).join('')}
                    </div>
                </div>
                
                <div class="cell">
                    <span class="label">Assignee</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${assigneeHtml}
                    </div>
                </div>

            </div>
            ${i.summary ? `<div class="summary-block"><span class="label">Summary</span><p>${i.summary}</p></div>` : ''}
            <div class="description">${i.description || '<p class="muted">No description.</p>'}</div>
            </div>`;
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
	pendingFiles = [];
}
document.getElementById('new-issue').addEventListener('click', openNew);
document.getElementById('cancel-new').addEventListener('click', closeNew);
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
	const category = document.getElementById('new-category')?.value;
	const assignee = document.getElementById('new-assignee')?.value;
	const difficulty = document.getElementById('new-difficulty')?.value;
	const tags = document.getElementById('new-tags')?.value;

	if (priority) formData.append('priority', priority);
	if (category) formData.append('category', category);
	if (assignee) formData.append('assigned_to', assignee);
	if (difficulty) formData.append('difficulty', difficulty);
	if (tags) formData.append('tags', tags);

	pendingFiles.forEach((f) => formData.append('attachments', f));

	const originalText = confirmNewBtn.textContent;
	confirmNewBtn.textContent = 'Creating...';
	confirmNewBtn.disabled = true;

	try {
		showToast('Creating and analyzing issue...');

		const response = await createIssue(formData);

		ISSUES = await fetchIssues(state.currentTeamId);

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
	if (e.target.matches('.edit-issue-btn')) {
		const btn = e.target;
		const currentIssue = ISSUES.find((i) => i.id === state.selected);
		if (!currentIssue) return;

		const newTitle = prompt('Edit Title:', currentIssue.title);
		if (newTitle === null) return;
		const newStatus = prompt('Edit Status (Open, In Progress, Resolved, Closed):', currentIssue.status);
		if (newStatus === null) return;

		const statusMap = {
			open: 'Open',
			'in-progress': 'In Progress',
			'in progress': 'In Progress',
			done: 'Resolved',
			resolved: 'Resolved',
			closed: 'Closed',
		};
		// Prompt input accepts user-friendly aliases but the API stores the
		// canonical status labels used elsewhere in this file.
		const normalisedStatus = statusMap[newStatus.trim().toLowerCase()] ?? newStatus.trim();

		const updates = {
			title: newTitle.trim() || currentIssue.title,
			status: normalisedStatus || currentIssue.status,
		};

		btn.textContent = 'Saving...';
		btn.disabled = true;
		try {
			await updateIssue(state.selected, updates);

			const index = ISSUES.findIndex((i) => i.id === state.selected);
			if (index !== -1) ISSUES[index] = { ...ISSUES[index], ...updates };

			renderList();
			renderDetail();
			showToast('Issue updated');
		} catch {
			showToast('Failed to save edits');
			btn.textContent = 'Edit';
			btn.disabled = false;
		}
	}
});

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
