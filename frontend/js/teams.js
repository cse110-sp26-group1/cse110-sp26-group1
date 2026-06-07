import { fetchTeams, createTeam, requireAuth, acceptInvite, rejectInvite, fetchInvites, fetchTeamMembers } from './api.js';
import { formatRelativeDate, showToast, getTeamMark, initTheme, initUserMenu } from './helpers.js';
import { TEAM_MARK_HUES } from './constants.js';

import './components/team-card.js';
import './components/invite-row.js';

initTheme();
initUserMenu();

const backdrop = document.getElementById('create-backdrop');
const teamNameEl = document.getElementById('team-name');

const MAX_BIO_LENGTH = 50;

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
document.getElementById('team-grid').addEventListener('click', (e) => {
	if (e.target.closest('#create-team-2')) {
		e.preventDefault();
		openModal();
	}
});
document.getElementById('cancel-create').addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => {
	if (e.target === backdrop) {
		closeModal();
	}
});

document.getElementById('confirm-create').addEventListener('click', async () => {
	const nameEl = document.getElementById('team-name');
	const bioEl = document.getElementById('team-bio');

	const name = nameEl.value.trim();
	const bio = bioEl.value.trim();

	if (!name) {
		nameEl.focus();
		return;
	}

	const confirmBtn = document.getElementById('confirm-create');
	const originalText = confirmBtn.textContent;
	confirmBtn.textContent = 'Creating...';
	confirmBtn.disabled = true;

	try {
		const newTeam = await createTeam({
			team_name: name,
			bio: bio,
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
 * Loads pending invites, renders the rows from API data, then attaches the
 * accept/decline listeners to the newly-created buttons.
 */
async function loadInvites() {
	const section = document.getElementById('invites-section');
	if (!section) return;
	section.querySelectorAll('invite-row').forEach((row) => row.remove());

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

	invites.forEach((inv) => {
		const row = document.createElement('invite-row');
		row.setAttribute('invite-id', String(inv.id));
		row.setAttribute('team-name', inv.team_name);
		row.setAttribute('inviter-name', inv.inviter_username);
		row.setAttribute('invite-date', formatRelativeDate(inv.created_at));

		section.appendChild(row);
	});

	section.querySelectorAll('.accept-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const inviteId = Number(e.target.dataset.inviteId);
			e.target.textContent = 'Accepting...';
			e.target.disabled = true;
			try {
				await acceptInvite(inviteId);
				showToast('Invitation accepted!');
				e.target.closest('invite-row').remove();
				await initTeamsPage();
			} catch {
				showToast('Failed to accept invite.');
				e.target.textContent = 'Accept';
				e.target.disabled = false;
			}
		});
	});

	// success keeps the UI from drifting away from the stored invite state.
	section.querySelectorAll('.decline-btn').forEach((btn) => {
		btn.addEventListener('click', async (e) => {
			const inviteId = Number(e.target.dataset.inviteId);
			e.target.textContent = 'Declining...';
			e.target.disabled = true;
			try {
				await rejectInvite(inviteId);
				e.target.closest('invite-row').remove();
				showToast('Invitation declined.');
				const remaining = section.querySelectorAll('invite-row').length;
				if (!remaining) section.hidden = true;
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

		const teamCards = await Promise.all(
			teams.map(async (team, index) => {
				const card = document.createElement('team-card');
				card.setAttribute('team-id', String(team.id));
				card.setAttribute('name', team.team_name);

				card.setAttribute('mark', getTeamMark(team.team_name));
				card.setAttribute('color', String(TEAM_MARK_HUES[index % TEAM_MARK_HUES.length]));
				card.setAttribute('role', team.role);

				let bioText = team.bio ?? '';
				if (bioText.length > MAX_BIO_LENGTH) {
					// bio truncation
					bioText = bioText.substring(0, MAX_BIO_LENGTH).trim() + '...';
				}
				card.setAttribute('bio', bioText);
				try {
					const members = await fetchTeamMembers(team.id);
					const topMembers = members.slice(0, 4);
					card.setAttribute('members', JSON.stringify(topMembers));
				} catch {
					card.setAttribute('members', '[]');
				}

				return card;
			}),
		);

		grid.replaceChildren(...teamCards);
		grid.insertAdjacentHTML('beforeend', createBtnHtml);

		await loadInvites();
	} catch {
		showToast('Failed to load dashboard.');
	}
}

(async () => {
	if (!(await requireAuth())) return;
	await initTeamsPage();
})();
