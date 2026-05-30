import { requireAuth, fetchInvites, acceptInvite, rejectInvite, fetchTeamMembers } from './api.js';

requireAuth();

const toast = document.getElementById('toast');
const loadingEl = document.getElementById('join-loading');

// Code-entry view elements
const codeView = document.getElementById('join-code-view');
const codeInput = document.getElementById('code-input');
const codeSubmitBtn = document.getElementById('code-submit');
const codeErrorEl = document.getElementById('code-error');
const invitesHeadingEl = document.getElementById('invites-heading');
const listEl = document.getElementById('invite-list');
const emptyEl = document.getElementById('join-empty');

// Preview view elements
const previewView = document.getElementById('join-preview-view');
const previewMarkEl = document.getElementById('preview-mark');
const previewNameEl = document.getElementById('preview-name');
const previewMetaEl = document.getElementById('preview-meta');
const previewMembersEl = document.getElementById('preview-members');
const previewMemberCountEl = document.getElementById('preview-member-count');
const previewJoinBtn = document.getElementById('preview-join');

// Error / invalid-code elements
const invalidEl = document.getElementById('join-invalid');
const errorEl = document.getElementById('join-error');
const retryBtn = document.getElementById('retry-btn');

let currentInvite = null;

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

// Color variants cycle for team marks (matches teams.css / tracker.css)
const COLOR_CLASSES = ['c1', 'c2', 'c3', 'c4'];
/**
 *
 * @param teamId
 */
function markColor(teamId) {
	return COLOR_CLASSES[(Number(teamId) - 1) % COLOR_CLASSES.length];
}

/**
 * Renders the preview card for a known invite and optionally its member list.
 * @param {object} inv - Invite object from fetchInvites().
 * @param {Array} members - Team members array (may be empty).
 */
function showPreview(inv, members) {
	currentInvite = inv;
	loadingEl.hidden = true;

	const teamName = String(inv.team_name ?? '');
	previewMarkEl.textContent = teamName.substring(0, 2).toUpperCase();
	// Cycle through color classes based on team_id
	previewMarkEl.className = `team-mark ${markColor(inv.team_id)}`;

	previewNameEl.textContent = teamName;
	const inviter = String(inv.inviter_username ?? '');
	const sent = new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	previewMetaEl.textContent = inviter ? `Invited by ${inviter} · ${sent}` : sent;

	// Member avatar stack (up to 6)
	const visible = members.slice(0, 6);
	previewMembersEl.innerHTML = visible
		.map((m) => {
			const initials =
				m.first_name && m.last_name
					? (m.first_name[0] + m.last_name[0]).toUpperCase()
					: (m.username || m.email || '??').substring(0, 2).toUpperCase();
			const name = m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username || '';
			return `<div class="avatar sm" title="${name}">${initials}</div>`;
		})
		.join('');

	if (members.length > 0) {
		const extra = members.length > 6 ? ` +${members.length - 6} more` : '';
		previewMemberCountEl.textContent = `${members.length} member${members.length !== 1 ? 's' : ''}${extra}`;
	} else {
		previewMemberCountEl.textContent = '';
	}

	previewView.hidden = false;
}

previewJoinBtn?.addEventListener('click', async () => {
	if (!currentInvite) return;
	const original = previewJoinBtn.textContent;
	previewJoinBtn.textContent = 'Joining…';
	previewJoinBtn.disabled = true;
	try {
		await acceptInvite(currentInvite.id);
		showToast('Joined! Redirecting…');
		setTimeout(() => {
			location.href = `tracker.html?team_id=${currentInvite.team_id}`;
		}, 900);
	} catch (err) {
		showToast(err.message || 'Failed to join. Please try again.');
		previewJoinBtn.textContent = original;
		previewJoinBtn.disabled = false;
	}
});

/**
 * Searches the given invite list for one matching teamId, then shows preview or invalid state.
 * @param {string|number} teamId
 * @param {Array} invites
 */
async function resolveTeamId(teamId, invites) {
	const inv = invites.find((i) => String(i.team_id) === String(teamId));
	if (!inv) {
		loadingEl.hidden = true;
		invalidEl.hidden = false;
		return;
	}
	let members = [];
	try {
		members = await fetchTeamMembers(inv.team_id);
	} catch {
		/* member list is optional — show preview without it */
	}
	showPreview(inv, members);
}

/**
 * Renders the code-entry view with the full list of pending invites below.
 * @param {Array} invites
 */
function showCodeView(invites) {
	loadingEl.hidden = true;
	codeView.hidden = false;

	if (!invites.length) {
		emptyEl.hidden = false;
		return;
	}

	invitesHeadingEl.hidden = false;
	listEl.hidden = false;
	renderInviteList(invites);
}

/**
 * Builds the invite row elements and wires accept/decline buttons.
 * @param {Array} invites
 */
function renderInviteList(invites) {
	const els = invites.map((inv) => {
		const teamName = String(inv.team_name ?? '');

		const row = document.createElement('div');
		row.className = 'invite';
		row.dataset.inviteId = inv.id;

		const info = document.createElement('div');
		info.className = 'info';

		const markEl = document.createElement('div');
		markEl.className = 'team-mark';
		markEl.textContent = teamName.substring(0, 2).toUpperCase();

		const details = document.createElement('div');
		const summary = document.createElement('p');
		const nameEl = document.createElement('strong');
		nameEl.textContent = teamName;
		summary.append(nameEl, ` · invited by ${String(inv.inviter_username ?? '')}`);

		const sentEl = document.createElement('p');
		sentEl.textContent = `Sent ${new Date(inv.created_at).toLocaleDateString()}`;

		details.append(summary, sentEl);
		info.append(markEl, details);

		const actions = document.createElement('div');
		actions.className = 'actions';

		const declineBtn = document.createElement('button');
		declineBtn.className = 'btn sm decline-btn';
		declineBtn.dataset.inviteId = inv.id;
		declineBtn.textContent = 'Decline';

		const acceptBtn = document.createElement('button');
		acceptBtn.className = 'btn primary sm accept-btn';
		acceptBtn.dataset.inviteId = inv.id;
		acceptBtn.textContent = 'Accept';

		actions.append(declineBtn, acceptBtn);
		row.append(info, actions);
		return row;
	});

	listEl.replaceChildren(...els);
	wireButtons(invites);
}

/**
 * Wires accept/decline click handlers on the rendered invite rows.
 * @param {Array} invites
 */
function wireButtons(invites) {
	listEl.querySelectorAll('.accept-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const inviteId = Number(e.target.dataset.inviteId);
			const inv = invites.find((i) => i.id === inviteId);

			e.target.textContent = 'Accepting…';
			e.target.disabled = true;
			const declineBtn = e.target.closest('.invite')?.querySelector('.decline-btn');
			if (declineBtn) declineBtn.disabled = true;

			try {
				await acceptInvite(inviteId);
				showToast('Invitation accepted! Redirecting…');
				setTimeout(() => {
					location.href = `tracker.html?team_id=${inv.team_id}`;
				}, 900);
			} catch (err) {
				showToast(err.message || 'Failed to accept invite.');
				e.target.textContent = 'Accept';
				e.target.disabled = false;
				if (declineBtn) declineBtn.disabled = false;
			}
		});
	});

	listEl.querySelectorAll('.decline-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const inviteId = Number(e.target.dataset.inviteId);

			e.target.textContent = 'Declining…';
			e.target.disabled = true;
			const acceptBtn = e.target.closest('.invite')?.querySelector('.accept-btn');
			if (acceptBtn) acceptBtn.disabled = true;

			try {
				await rejectInvite(inviteId);
				e.target.closest('.invite').remove();
				showToast('Invitation declined.');

				if (!listEl.querySelectorAll('.invite').length) {
					listEl.hidden = true;
					invitesHeadingEl.hidden = true;
					emptyEl.hidden = false;
				}
			} catch (err) {
				showToast(err.message || 'Failed to decline invite.');
				e.target.textContent = 'Decline';
				e.target.disabled = false;
				if (acceptBtn) acceptBtn.disabled = false;
			}
		});
	});
}

// Code-entry lookup handler
codeSubmitBtn?.addEventListener('click', async () => {
	codeErrorEl.hidden = true;
	codeInput.classList.remove('invalid');

	const raw = codeInput.value.trim();
	if (!raw) {
		codeErrorEl.textContent = 'Enter an invite code.';
		codeErrorEl.hidden = false;
		codeInput.classList.add('invalid');
		codeInput.focus();
		return;
	}

	// Extract digits from pasted link (e.g. "…join.html?team_id=42") or plain number
	const match = raw.match(/team_id=(\d+)/) || raw.match(/^(\d+)$/);
	const teamId = match ? match[1] : null;

	if (!teamId) {
		codeErrorEl.textContent = "That doesn't look like a valid invite code.";
		codeErrorEl.hidden = false;
		codeInput.classList.add('invalid');
		return;
	}

	const original = codeSubmitBtn.textContent;
	codeSubmitBtn.textContent = 'Looking up…';
	codeSubmitBtn.disabled = true;

	try {
		const invites = await fetchInvites();
		const inv = invites.find((i) => String(i.team_id) === teamId);

		if (!inv) {
			codeErrorEl.textContent = 'That invite code is invalid or has expired.';
			codeErrorEl.hidden = false;
			codeInput.classList.add('invalid');
		} else {
			let members = [];
			try {
				members = await fetchTeamMembers(inv.team_id);
			} catch {
				/* member list optional */
			}
			codeView.hidden = true;
			showPreview(inv, members);
		}
	} catch {
		showToast('Failed to look up invite. Please try again.');
	} finally {
		codeSubmitBtn.textContent = original;
		codeSubmitBtn.disabled = false;
	}
});

codeInput?.addEventListener('input', () => {
	codeErrorEl.hidden = true;
	codeInput.classList.remove('invalid');
});

// Allow pressing Enter in the code input to trigger lookup
codeInput?.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') codeSubmitBtn?.click();
});

/**
 * Loads pending invites, then routes to preview or code-entry view based on URL params.
 */
async function init() {
	try {
		const invites = await fetchInvites();
		const teamIdParam = new URLSearchParams(location.search).get('team_id');

		if (teamIdParam) {
			await resolveTeamId(teamIdParam, invites);
		} else {
			showCodeView(invites);
		}
	} catch {
		loadingEl.hidden = true;
		errorEl.hidden = false;
	}
}

retryBtn?.addEventListener('click', () => {
	errorEl.hidden = true;
	loadingEl.hidden = false;
	init();
});

init();
