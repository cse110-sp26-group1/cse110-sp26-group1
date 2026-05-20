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
		return ['slug', 'name', 'mark', 'color', 'open', 'prog', 'done'];
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
		const slug = this.getAttribute('slug') ?? '';
		const name = this.getAttribute('name') ?? '';
		const mark = this.getAttribute('mark') ?? '';
		const color = this.getAttribute('color') ?? '0';

		const link = this.querySelector('a.team');
		const teamMark = this.querySelector('.team-mark');
		const title = this.querySelector('h2');
		const slugEl = this.querySelector('.slug');

		if (link) link.href = `tracker.html?team=${encodeURIComponent(slug)}`;
		if (teamMark) {
			teamMark.textContent = mark;
			teamMark.style.background = `oklch(0.92 0.04 ${color})`;
			teamMark.style.color = `oklch(0.4 0.12 ${color})`;
		}
		if (title) title.textContent = name;
		if (slugEl) slugEl.textContent = slug;

		const openEl = this.querySelector('.open-count');
		const progEl = this.querySelector('.prog-count');
		const doneEl = this.querySelector('.done-count');

		if (openEl) openEl.textContent = this.getAttribute('open') ?? '0';
		if (progEl) progEl.textContent = this.getAttribute('prog') ?? '0';
		if (doneEl) doneEl.textContent = this.getAttribute('done') ?? '0';
	}
}

await loadTeamCardTemplate();
customElements.define('team-card', TeamCard);
