import { getUserInitials } from '../user-profile.js';

const templateUrl = new URL('../../html/components/team-card.html', import.meta.url);

let teamCardTemplate;

/**
 * Loads the team card markup from the shared HTML component file.
 * @returns {Promise<HTMLTemplateElement>}
 */
async function loadTeamCardTemplate() {
	if (teamCardTemplate) return teamCardTemplate;

	const response = await fetch(templateUrl);
	if (!response.ok) {
		throw new Error(`Failed to load team card template (${response.status})`);
	}

	const html = await response.text();
	const doc = new DOMParser().parseFromString(html, 'text/html');
	teamCardTemplate = doc.getElementById('team-card-template');

	if (!teamCardTemplate) {
		throw new Error('team-card-template not found in team-card.html');
	}

	return teamCardTemplate;
}

/**
 * Team workspace card shown on the teams dashboard grid.
 */
class TeamCard extends HTMLElement {
	/**
	 * @returns {string[]}
	 */
	static get observedAttributes() {
		// Added status attributes to support issue-aware dashboard
		return ['team-id', 'name', 'mark', 'color', 'role', 'open', 'prog', 'done', 'user-initials'];
	}

	#rendered = false;

	/** @returns {void} */
	connectedCallback() {
		if (this.#rendered) {
			this.#update();
			return;
		}

		const fragment = teamCardTemplate.content.cloneNode(true);
		this.appendChild(fragment);
		this.#rendered = true;
		this.#update();
	}

	/** @returns {void} */
	attributeChangedCallback() {
		if (this.#rendered) this.#update();
	}

	/** @returns {void} */
	#update() {
		const teamId = this.getAttribute('team-id') ?? '';
		const name = this.getAttribute('name') ?? '';
		const mark = this.getAttribute('mark') ?? '';
		const color = this.getAttribute('color') ?? '0';
		const role = this.getAttribute('role') ?? 'Member';

		// Status values
		const openCount = this.getAttribute('open') ?? '0';
		const progCount = this.getAttribute('prog') ?? '0';
		const doneCount = this.getAttribute('done') ?? '0';
		const userInitials = this.getAttribute('user-initials') ?? getUserInitials();

		const link = this.querySelector('a.team');
		const teamMark = this.querySelector('.team-mark');
		const title = this.querySelector('h2');
		const subtitleEl = this.querySelector('.slug');
		const avatarEl = this.querySelector('.avatar');

		if (link) link.href = `tracker.html?team_id=${teamId}`;

		if (teamMark) {
			teamMark.textContent = mark;
			teamMark.style.background = `oklch(0.92 0.04 ${color})`;
			teamMark.style.color = `oklch(0.4 0.12 ${color})`;
		}

		if (title) title.textContent = name;

		if (subtitleEl) subtitleEl.textContent = role === 'admin' ? 'Workspace Admin' : 'Workspace Member';

		// Ensure initials match the current user
		if (avatarEl) avatarEl.textContent = userInitials;

		// Enabling stats display
		const statsEl = this.querySelector('.stats');
		if (statsEl) {
			statsEl.style.display = 'grid'; // Remove 'none' to show counts

			const openEl = this.querySelector('.open-count');
			const progEl = this.querySelector('.prog-count');
			const doneEl = this.querySelector('.done-count');

			if (openEl) openEl.textContent = openCount;
			if (progEl) progEl.textContent = progCount;
			if (doneEl) doneEl.textContent = doneCount;
		}
	}
}

await loadTeamCardTemplate();
customElements.define('team-card', TeamCard);
