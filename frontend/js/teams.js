import { fetchTeams, createTeam, requireAuth, acceptInvite, rejectInvite, fetchInvites } from './api.js';

import './components/team-card.js';

requireAuth(); // forces the user to sign up if this page is accessed without credentials

const backdrop = document.getElementById('create-backdrop');
const teamNameEl = document.getElementById('team-name');
const toast = document.getElementById('toast');

/**
 * Opens the create-team modal and focuses the team-name input.
 */
function openModal() {
	backdrop.classList.add('open');
	teamNameEl.focus();
}

/**
 * Closes the create-team modal.
 */
function closeModal() {
	backdrop.classList.remove('open');
}

document.getElementById('create-team').addEventListener('click', openModal);
document.getElementById('create-team-2').addEventListener('click', (e) => {
	e.preventDefault();
	openModal();
});
document.getElementById('cancel-create').addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => {
	if (e.target === backdrop) {
		closeModal();
	}
});

/**
 * Shows a temporary status message.
 *
 * @param {string} msg Message to display.
 */
function showToast(msg) {
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(showToast._t);
	showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

document.querySelectorAll('.accept-btn').forEach((btn) => {
	btn.addEventListener('click', async (e) => {
		const teamSlug = e.target.dataset.slug;
		const originalText = e.target.textContent;

		e.target.textContent = 'Accepting...';
		e.target.disabled = true;

		try {
			await acceptInvite(teamSlug);
			showToast('Invitation accepted!');

			// Remove the invite from the screen
			e.target.closest('.invite').remove();

			// Re-render the grid to show the newly unlocked team
			// The accepted invite creates team membership server-side.
			initTeamsPage();
		} catch {
			showToast('Failed to accept invite.');
			e.target.textContent = originalText;
			e.target.disabled = false;
		}
	});
});

document.querySelectorAll('.decline-btn').forEach((btn) => {
	btn.addEventListener('click', (e) => {
		e.target.closest('.invite').remove();
		showToast('Invitation declined.');
	});
});

document.getElementById('confirm-create').addEventListener('click', async () => {
	const nameEl = document.getElementById('team-name');
	const _bioEl = document.getElementById('team-bio'); // add bio support next (STRETCH GOAL)

	const name = nameEl.value.trim();
	//const _bio = _bioEl.value.trim();

	if (!name) {
		nameEl.focus();
		return;
	}

	const confirmBtn = document.getElementById('confirm-create');
	const originalText = confirmBtn.textContent;
	confirmBtn.textContent = 'Creating...';
	confirmBtn.disabled = true;

	try {
		const words = name.split(' ');
		let mark = words[0].substring(0, 2).toUpperCase();
		if (words.length > 1) {
			mark = (words[0][0] + words[1][0]).toUpperCase();
		}

		const newTeam = await createTeam({
			team_name: name,
		});

		showToast(`Workspace created! Redirecting...`);
		closeModal();

		setTimeout(() => {
			location.href = `tracker.html?team_id=${newTeam.team_id}`;
		}, 800);
	} catch (err) {
		showToast(err.message || 'Failed to create team.');
	} finally {
		confirmBtn.textContent = originalText;
		confirmBtn.disabled = false;
	}
});

/**
 * Loads pending invites and wires accept/decline actions after rendering them.
 */
async function loadInvites() {
	const section = document.getElementById('invites-section');
	if (!section) return;

	let invites;
	try {
		invites = await fetchInvites();
	} catch {
		section.hidden = true;
		return;
	}

	if (!invites.length) {
		section.hidden = true;
		return;
	}

	section.hidden = false;

	const list = invites
		.map(
			(inv) => `
		<div class="invite" data-invite-id="${inv.id}">
		<div class="info">
			<div class="team-mark">${inv.team_name.substring(0, 2).toUpperCase()}</div>
			<div>
			<p><strong>${inv.team_name}</strong> · invited by ${inv.inviter_username}</p>
			<p>Invited ${inv.created_at}</p>
			</div>
		</div>
		<div class="actions">
			<button class="btn sm decline-btn" data-invite-id="${inv.id}">Decline</button>
			<button class="btn primary sm accept-btn" data-invite-id="${inv.id}">Accept</button>
		</div>
		</div>
	`,
		)
		.join('');

	// Invites are inserted after the heading so the static section shell can
	// stay in HTML while the rows reflect the latest API state.
	section.querySelector('h3').insertAdjacentHTML('afterend', list);

	section.querySelectorAll('.accept-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const inviteId = Number(e.target.dataset.inviteId);
			e.target.textContent = 'Accepting...';
			e.target.disabled = true;
			try {
				await acceptInvite(inviteId);
				showToast('Invitation accepted!');
				e.target.closest('.invite').remove();
				initTeamsPage();
			} catch {
				showToast('Failed to accept invite.');
				e.target.textContent = 'Accept';
				e.target.disabled = false;
			}
		});
	});

	section.querySelectorAll('.decline-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const inviteId = Number(e.target.dataset.inviteId);
			e.target.textContent = 'Declining...';
			e.target.disabled = true;
			try {
				await rejectInvite(inviteId);
				e.target.closest('.invite').remove();
				showToast('Invitation declined.');
				if (!section.querySelectorAll('.invite').length) section.hidden = true;
			} catch {
				showToast('Failed to decline invite.');
				e.target.textContent = 'Decline';
				e.target.disabled = false;
			}
		});
	});
}

/**
 * Loads the user's teams and rebuilds the dashboard grid from API data.
 */
async function initTeamsPage() {
	try {
		const teams = await fetchTeams();
		const grid = document.getElementById('team-grid');
		const createBtnHtml = grid.querySelector('.team.new').outerHTML;

		const teamCards = teams.map((team) => {
			const card = document.createElement('team-card');
			card.setAttribute('team-id', String(team.id));
			card.setAttribute('name', team.team_name);

			const words = team.team_name.trim().split(' ');
			const mark = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : team.team_name.substring(0, 2).toUpperCase();
			card.setAttribute('mark', mark);
			card.setAttribute('color', '220');
			card.setAttribute('role', team.role);
			return card;
		});

		grid.replaceChildren(...teamCards);
		grid.insertAdjacentHTML('beforeend', createBtnHtml);

		document.getElementById('create-team-2').addEventListener('click', (e) => {
			e.preventDefault();
			openModal();
		});

		await loadInvites();
	} catch {
		showToast('Failed to load dashboard.');
	}
}

initTeamsPage();
