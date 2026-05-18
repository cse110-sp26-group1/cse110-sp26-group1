import { PRI_ORDER, STATUS_ORDER, PRI_LABEL, PRI_NAME, STATUS_NAME, SKILLS_MD } from './constants.js';
import { fetchIssues, fetchTeams, createIssue, updateIssue } from './mock-api.js';

// ============================================================
// STATE
// ============================================================
const state = {
	sort: 'priority',
	tag: 'all',
	query: '',
	selected: null,
	detailOpen: true,
	teams: [],
};

let ISSUES = [];

// ============================================================
// TEAM SWITCH from query string
// ============================================================
/**
 *
 */
function applyTeamFromUrl() {
	const qs = new URLSearchParams(location.search);
	const slug = qs.get('team');

	// Look up from our fetched state instead of the static object
	const t = state.teams.find((team) => team.slug === slug);
	if (!t) return;

	document.getElementById('teamLabel').textContent = t.name;
	const mark = document.querySelector('.team-switch > .mark');
	mark.textContent = t.mark;
	mark.style.background = `oklch(0.92 0.04 ${t.color})`;
	mark.style.color = `oklch(0.4 0.12 ${t.color})`;
}

// ============================================================
// RENDER LIST
// ============================================================
const listEl = document.getElementById('issueList');
const totalCountEl = document.getElementById('totalCount');

/**
 *
 */
function renderList() {
	let items = ISSUES.slice();
	if (state.tag !== 'all') {
		items = items.filter((i) => i.labels.includes(state.tag));
	}

	if (state.query) {
		const q = state.query.toLowerCase();
		items = items.filter(
			(i) =>
				i.title.toLowerCase().includes(q) ||
				(i.summary && i.summary.toLowerCase().includes(q)) ||
				i.labels.some((l) => l.toLowerCase().includes(q)),
		);
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
		const buckets = { urgent: [], high: [], med: [], low: [] };
		items.forEach((i) => buckets[i.priority].push(i));
		groups = [
			{ label: 'Urgent', rows: buckets.urgent },
			{ label: 'High', rows: buckets.high },
			{ label: 'Medium', rows: buckets.med },
			{ label: 'Low', rows: buckets.low },
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
			if (!state.detailOpen) toggleDetail();
		});
	});
}

/**
 *
 * @param i
 */
function rowHtml(i) {
	const isSel = state.selected === i.id;
	const statusKey = i.status === 'in-progress' ? 'prog' : i.status;
	return `
    <div class="issue-row ${isSel ? 'selected' : ''}" data-id="${i.id}">
        <span class="pri-mark ${i.priority}" title="${PRI_NAME[i.priority]}">${PRI_LABEL[i.priority]}</span>
        <div class="title">
            <span>${i.title}</span>
            <span class="sub">${i.summary || ''}</span>
        </div>
        <div class="labels">${i.labels.map((l) => `<span class="chip tag-${l}">${l}</span>`).join('')}</div>
        <span class="chip st-${statusKey}">${STATUS_NAME[i.status]}</span>
        <span class="updated">${i.updated}</span>
    </div>`;
}

// ============================================================
// RENDER DETAIL
// ============================================================
const detailEl = document.getElementById('detail');

/**
 *
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
	const statusKey = i.status === 'in-progress' ? 'prog' : i.status;
	const processingBanner = i.status === 'pending' ? '<span class="processing">AI is enriching this issue…</span>' : '';

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
					<span class="chip st-${statusKey}">${STATUS_NAME[i.status]}</span>
				</div>
				<div class="cell">
					<span class="label">Priority</span>
					<span class="chip pri-${i.priority}"><span class="dot"></span>${PRI_NAME[i.priority]}</span>
				</div>
				<div class="cell">
					<span class="label">Difficulty</span>
					<span class="diff">${diffPips}</span>
				</div>
				<div class="cell" style="flex:1; min-width:160px;">
					<span class="label">Labels</span>
					<div style="display:flex; gap:4px; flex-wrap:wrap;">
						${i.labels.map((l) => `<span class="chip tag-${l}">${l}</span>`).join('')}
					</div>
				</div>
				<div class="cell">
					<span class="label">Assignee</span>
					<div style="display:flex; align-items:center; gap:6px;">
						<span class="avatar sm">JK</span>
						<span style="font-size:13px;">Jon K.</span>
					</div>
				</div>
			</div>
			${i.summary ? `<div class="summary-block"><span class="label">Summary</span><p>${i.summary}</p></div>` : ''}
			<div class="description">${i.description || '<p class="muted">No description.</p>'}</div>
			${
				i.activity && i.activity.length
					? `
			<div class="activity">
				<h4>Activity</h4>
				${i.activity
					.map(
						(a) => `
					<div class="item">
						<span class="avatar sm">${a.who}</span>
						<span>${a.what}</span>
						<span class="when">${a.when}</span>
					</div>`,
					)
					.join('')}
			</div>`
					: ''
			}
		</div>`;
}

// ============================================================
// CONTROLS — search, sort, tag
// ============================================================
const searchInput = document.getElementById('issueSearch');
const searchClearBtn = document.getElementById('issueSearchClear');

/**
 * Show or hide the search clear control based on input value.
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
	left = Math.max(340, Math.min(rect.width - 380, left));
	content.style.gridTemplateColumns = `${left}px 6px 1fr`;
});
const savedWidth = localStorage.getItem('detailWidth');
if (savedWidth) content.style.gridTemplateColumns = savedWidth;

// ============================================================
// TEAM MENU
// ============================================================
const teamSwitch = document.getElementById('teamSwitch');
const teamMenu = document.getElementById('teamMenu');
teamSwitch.addEventListener('click', (e) => {
	e.stopPropagation();
	teamMenu.classList.toggle('open');
});
document.addEventListener('click', () => teamMenu.classList.remove('open'));
teamMenu.addEventListener('click', (e) => e.stopPropagation());
teamMenu.querySelectorAll('.item[data-slug]').forEach((it) => {
	it.addEventListener('click', () => {
		const slug = it.dataset.slug;
		const t = state.teams.find((team) => team.slug === slug);
		if (!t) return;

		teamMenu.querySelectorAll('.item').forEach((x) => x.classList.remove('active'));
		it.classList.add('active');
		document.getElementById('teamLabel').textContent = t.name;
		const mark = document.querySelector('.team-switch > .mark');
		mark.textContent = t.mark;
		mark.style.background = `oklch(0.92 0.04 ${t.color})`;
		mark.style.color = `oklch(0.4 0.12 ${t.color})`;
		teamMenu.classList.remove('open');
		showToast(`Switched to ${t.name}`);
	});
});
const allTeamsItem = teamMenu.querySelector('[data-action="all-teams"]');
if (allTeamsItem) allTeamsItem.addEventListener('click', () => (location.href = 'teams.html'));

// ============================================================
// DETAIL TOGGLE
// ============================================================
/**
 *
 */
function toggleDetail() {
	state.detailOpen = !state.detailOpen;
	content.classList.toggle('collapsed-detail', !state.detailOpen);
}
document.getElementById('toggleDetail').addEventListener('click', toggleDetail);

// ============================================================
// NEW ISSUE MODAL
// ============================================================
const newBackdrop = document.getElementById('newBackdrop');
const confirmNewBtn = document.getElementById('confirmNew');
let pendingFiles = [];

/**
 *
 */
function openNew() {
	newBackdrop.classList.add('open');
	setTimeout(() => document.getElementById('nTitle').focus(), 30);
}
/**
 *
 */
function closeNew() {
	newBackdrop.classList.remove('open');
	resetForm();
}
/**
 *
 */
function resetForm() {
	document.getElementById('nTitle').value = '';
	document.getElementById('nDesc').value = '';
	document.getElementById('fileList').innerHTML = '';
	pendingFiles = [];
}
document.getElementById('newIssue').addEventListener('click', openNew);
document.getElementById('cancelNew').addEventListener('click', closeNew);
newBackdrop.addEventListener('click', (e) => {
	if (e.target === newBackdrop) closeNew();
});

// file upload
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');

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
 *
 * @param files
 */
function addFiles(files) {
	Array.from(files).forEach((f) => pendingFiles.push(f));
	renderFiles();
}
/**
 *
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
	const titleEl = document.getElementById('nTitle');
	const descEl = document.getElementById('nDesc');
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
	pendingFiles.forEach((f) => formData.append('attachments', f));

	const originalText = confirmNewBtn.textContent;
	confirmNewBtn.textContent = 'Creating...';
	confirmNewBtn.disabled = true;

	try {
		showToast(`Creating issue...`);
		const newIssue = await createIssue(formData);

		ISSUES.unshift(newIssue);
		state.selected = newIssue.id;

		closeNew();
		renderList();
		renderDetail();
	} catch (err) {
		showToast('Failed to create issue.');
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
 *
 * @param msg
 */
function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

document.getElementById('downloadSkills').addEventListener('click', () => {
	const blob = new Blob([SKILLS_MD], { type: 'text/markdown' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'skills.md';
	document.body.appendChild(a);
	a.click();
	a.remove();
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
			const updatedData = await updateIssue(state.selected, { status: 'done' });
			const index = ISSUES.findIndex((i) => i.id === state.selected);
			if (index !== -1) ISSUES[index] = updatedData;
			renderList();
			renderDetail();
			showToast('Issue marked as done');
		} catch (err) {
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
		const newStatus = prompt('Edit Status (open, in-progress, done):', currentIssue.status);
		if (newStatus === null) return;

		const updates = {
			title: newTitle.trim() || currentIssue.title,
			status: newStatus.trim() || currentIssue.status,
		};

		btn.textContent = 'Saving...';
		btn.disabled = true;
		try {
			const updatedIssueData = await updateIssue(state.selected, updates);
			const index = ISSUES.findIndex((i) => i.id === state.selected);
			if (index !== -1) ISSUES[index] = updatedIssueData;
			renderList();
			renderDetail();
			showToast('Issue updated successfully');
		} catch (err) {
			console.error(err);
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
 *
 */
async function initTracker() {
	try {
		const [teams, issues] = await Promise.all([fetchTeams(), fetchIssues()]);

		state.teams = teams;
		ISSUES = issues;

		applyTeamFromUrl();

		if (ISSUES.length > 0 && !ISSUES.find((i) => i.id === state.selected)) {
			state.selected = ISSUES[0].id;
		}

		renderList();
		renderDetail();
	} catch (err) {
		showToast('Failed to load mock data.');
		console.error(err);
	}
}

initTracker();
