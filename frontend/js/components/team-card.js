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
		return ['team-id', 'name', 'mark', 'color', 'role', 'bio', 'members'];
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
					.map((m, index) => {
						const initials =
							m.first_name && m.last_name
								? (m.first_name[0] + m.last_name[0]).toUpperCase()
								: (m.username || m.email || '??').substring(0, 2).toUpperCase();
						const name = m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.username;

						return `<div class="avatar sm" title="${name}">${initials}</div>`;
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
