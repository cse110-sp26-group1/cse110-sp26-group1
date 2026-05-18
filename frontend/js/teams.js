import { fetchTeams, createTeam } from './mock-api.js';

const backdrop = document.getElementById('createBackdrop');
const teamNameEl = document.getElementById('teamName');
const teamSlugEl = document.getElementById('teamSlug');
const toast = document.getElementById('toast');

const gridEl = document.querySelector('.grid');
const confirmCreateBtn = document.getElementById('confirmCreate');

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

document.getElementById('createTeam').addEventListener('click', openModal);
document.getElementById('createTeam2').addEventListener('click', (e) => {
	e.preventDefault();
	openModal();
});
document.getElementById('cancelCreate').addEventListener('click', closeModal);
backdrop.addEventListener('click', (e) => {
	if (e.target === backdrop) {
		closeModal();
	}
});

// auto-slug from name
teamNameEl.addEventListener('input', (e) => {
	const slug = e.target.value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	teamSlugEl.value = slug;
});

document.getElementById('confirmCreate').addEventListener('click', () => {
	const name = teamNameEl.value.trim();
	if (!name) {
		teamNameEl.focus();
		return;
	}
	const slug = teamSlugEl.value.trim() || 'new-team';
	location.href = `tracker.html?team=${encodeURIComponent(slug)}`;
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

document.querySelectorAll('.invite .actions .primary').forEach((b) => {
	b.addEventListener('click', (e) => {
		e.stopPropagation();
		showToast('Invitation accepted - opening workspace...');
		setTimeout(() => {
			location.href = 'tracker.html?team=invited';
		}, 900);
	});
});

const gridEl = document.querySelector('.grid');

async function initTeams() {
	try {
		const teams = await fetchTeams();

		const teamsHtml = teams.map(t => `
			<a class="team" href="tracker.html?team=${t.slug}">
				<div class="team-head">
					<div class="team-mark" style="background: oklch(0.92 0.04 ${t.color}); color: oklch(0.4 0.12 ${t.color});">${t.mark}</div>
					<div>
						<h2>${t.name}</h2>
						<div class="slug">${t.slug}</div>
					</div>
				</div>
				<div class="stats">
					<div class="stat"><span class="n">?</span><span class="l">open</span></div>
				</div>
				<div class="team-foot">
					<span class="last-active">active recently</span>
				</div>
			</a>
		`).join('');

		const createBtnHtml = `
			<button class="team new" id="createTeam2">
				<div>
					<div class="plus">+</div>
					<h2>Create new team</h2>
					<p class="new-team-caption">Start a fresh workspace.</p>
				</div>
			</button>
		`;

		gridEl.innerHTML = teamsHtml + createBtnHtml;

		document.getElementById('createTeam2').addEventListener('click', (e) => {
			e.preventDefault();
			openModal();
		});

	} catch (err) {
		showToast("Failed to load your workspaces.");
	}
}

confirmCreateBtn.addEventListener('click', async () => {
	const name = teamNameEl.value.trim();
	if (!name) {
		teamNameEl.focus();
		return;
	}
	const slug = teamSlugEl.value.trim() || 'new-team';
	const desc = document.querySelector('.modal-body .textarea').value.trim();

	const originalText = confirmCreateBtn.textContent;
	confirmCreateBtn.textContent = 'Creating...';
	confirmCreateBtn.disabled = true;

	try {
		await createTeam(name, slug, desc);
		location.href = `tracker.html?team=${encodeURIComponent(slug)}`;
	} catch (err) {
		showToast("Failed to create team.");
		confirmCreateBtn.textContent = originalText;
		confirmCreateBtn.disabled = false;
	}
});

initTeams();