import { requireAuth, fetchInvites, acceptInvite, rejectInvite } from './api.js';

requireAuth();

const toast = document.getElementById('toast');
const loadingEl = document.getElementById('join-loading');
const emptyEl = document.getElementById('join-empty');
const emptyMsgEl = document.getElementById('join-empty-msg');
const errorEl = document.getElementById('join-error');
const listEl = document.getElementById('invite-list');
const retryBtn = document.getElementById('retry-btn');

/**
 * Shows a short-lived toast notification.
 * @param {string} msg Message to display.
 */
function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

/**
 * Wires accept/decline buttons inside the invite list section.
 * @param {Array} invites - Filtered invite objects already in the DOM.
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

/**
 * Renders the filtered list of pending invites.
 * @param {Array} invites - All pending invites for the current user.
 */
function renderInvites(invites) {
	loadingEl.hidden = true;

	const teamIdParam = new URLSearchParams(location.search).get('team_id');
	const filtered = teamIdParam ? invites.filter((inv) => String(inv.team_id) === teamIdParam) : invites;

	if (!filtered.length) {
		emptyEl.hidden = false;
		if (teamIdParam) {
			emptyMsgEl.textContent = "You haven't been invited to this team, or the invitation no longer exists.";
		}
		return;
	}

	listEl.hidden = false;

	const inviteEls = filtered.map((inv) => {
		const inviteEl = document.createElement('div');
		inviteEl.className = 'invite';
		inviteEl.dataset.inviteId = inv.id;

		const infoEl = document.createElement('div');
		infoEl.className = 'info';

		const teamName = String(inv.team_name ?? '');
		const teamMarkEl = document.createElement('div');
		teamMarkEl.className = 'team-mark';
		teamMarkEl.textContent = teamName.substring(0, 2).toUpperCase();

		const detailsEl = document.createElement('div');
		const summaryEl = document.createElement('p');
		const teamEl = document.createElement('strong');
		teamEl.textContent = teamName;
		summaryEl.append(teamEl, ` · invited by ${String(inv.inviter_username ?? '')}`);

		const sentEl = document.createElement('p');
		sentEl.textContent = `Sent ${new Date(inv.created_at).toLocaleDateString()}`;

		detailsEl.append(summaryEl, sentEl);
		infoEl.append(teamMarkEl, detailsEl);

		const actionsEl = document.createElement('div');
		actionsEl.className = 'actions';

		const declineBtn = document.createElement('button');
		declineBtn.className = 'btn sm decline-btn';
		declineBtn.dataset.inviteId = inv.id;
		declineBtn.textContent = 'Decline';

		const acceptBtn = document.createElement('button');
		acceptBtn.className = 'btn primary sm accept-btn';
		acceptBtn.dataset.inviteId = inv.id;
		acceptBtn.textContent = 'Accept';

		actionsEl.append(declineBtn, acceptBtn);
		inviteEl.append(infoEl, actionsEl);
		return inviteEl;
	});

	listEl.replaceChildren(...inviteEls);

	wireButtons(filtered);
}

/**
 * Loads pending invites and renders them.
 */
async function init() {
	try {
		const invites = await fetchInvites();
		renderInvites(invites);
	} catch {
		loadingEl.hidden = true;
		errorEl.hidden = false;
	}
}

retryBtn.addEventListener('click', () => {
	errorEl.hidden = true;
	loadingEl.hidden = false;
	init();
});

init();
