import { loadHtmlTemplate } from './load-template.js';
import { getUserInitials, getUserDisplayName } from '../helpers.js';

let teamCardTemplate;

/**
 * Loads the team card markup from the shared HTML component file.
 * @returns {Promise<HTMLTemplateElement>}
 */
async function loadTeamCardTemplate() {
	if (teamCardTemplate) return teamCardTemplate;
	teamCardTemplate = await loadHtmlTemplate(import.meta.url, '../../html/components/team-card.html', 'team-card-template');
	return teamCardTemplate;
}

/** Team workspace card shown on the teams dashboard grid. */
class TeamCard extends HTMLElement {
	/** @returns {string[]} */
	static get observedAttributes() {
		return ['team-id', 'name', 'mark', 'color', 'role', 'bio', 'members'];
	}

	#rendered = false;

	/** Clones the team card template on first connect. */
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

	/** Re-renders when an observed attribute changes. */
	attributeChangedCallback() {
		if (this.#rendered) this.#update();
	}

	/** Syncs template nodes from element attributes. */
	#update() {
		const teamId = this.getAttribute('team-id') ?? '';
		const name = this.getAttribute('name') ?? '';
		const mark = this.getAttribute('mark') ?? '';
		const color = this.getAttribute('color') ?? '0';
		const role = this.getAttribute('role') ?? 'Member';
		const bio = this.getAttribute('bio') ?? '';

		const link = this.querySelector('a.team');
		const teamMark = this.querySelector('.team-mark');
		const title = this.querySelector('h2');
		const subtitleEl = this.querySelector('.slug');
		const bioEl = this.querySelector('.team-bio');

		const oldAvatarEl = this.querySelector('.avatar');
		if (oldAvatarEl) oldAvatarEl.remove();

		if (link) link.href = `tracker.html?team_id=${teamId}`;

		if (teamMark) {
			teamMark.textContent = mark;
			teamMark.style.background = `oklch(0.92 0.04 ${color})`;
			teamMark.style.color = `oklch(0.4 0.12 ${color})`;
		}

		if (title) title.textContent = name;

		if (subtitleEl) subtitleEl.textContent = role === 'admin' ? 'Workspace Admin' : 'Workspace Member';

		if (bioEl) {
			const trimmedBio = bio.trim();
			if (trimmedBio) {
				bioEl.textContent = trimmedBio;
				bioEl.classList.remove('empty');
			} else {
				bioEl.textContent = 'No bio yet.';
				bioEl.classList.add('empty');
			}
		}

		const membersAttr = this.getAttribute('members');
		if (membersAttr) {
			try {
				const members = JSON.parse(membersAttr);

				const membersHtml = members
					.map((m) => {
						const memberName = getUserDisplayName(m);
						return `<div class="avatar sm" title="${memberName}">${getUserInitials(m)}</div>`;
					})
					.join('');

				let membersContainer = this.querySelector('.member-stack');

				if (!membersContainer) {
					membersContainer = document.createElement('div');
					membersContainer.className = 'member-stack';
					membersContainer.style.marginTop = '1rem';

					if (link) link.appendChild(membersContainer);
				}

				membersContainer.innerHTML = membersHtml;
			} catch (err) {
				console.error('Failed to parse team members for card', err);
			}
		}
	}
}

await loadTeamCardTemplate();
customElements.define('team-card', TeamCard);
