import { loadHtmlTemplate } from './load-template.js';
import { getTeamMark } from '../helpers.js';

let inviteRowTemplate;

/**
 * Loads the invite row markup from the shared HTML component file.
 * @returns {Promise<HTMLTemplateElement>}
 */
async function loadInviteRowTemplate() {
	if (inviteRowTemplate) return inviteRowTemplate;
	inviteRowTemplate = await loadHtmlTemplate(import.meta.url, '../../html/components/invite-row.html', 'invite-row-template');
	return inviteRowTemplate;
}

/** A pending team invitation row displayed on the teams dashboard. */
class InviteRow extends HTMLElement {
	/** @returns {string[]} */
	static get observedAttributes() {
		return ['invite-id', 'team-name', 'inviter-name', 'invite-date'];
	}

	#rendered = false;

	/** Clones the invite row template on first connect. */
	connectedCallback() {
		if (this.#rendered) {
			this.#update();
			return;
		}

		this.classList.add('invite');

		const fragment = inviteRowTemplate.content.cloneNode(true);
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
		const teamName = this.getAttribute('team-name') ?? '';
		const inviterName = this.getAttribute('inviter-name') ?? '';
		const inviteDate = this.getAttribute('invite-date') ?? '';
		const inviteId = this.getAttribute('invite-id') ?? '';

		const markEl = this.querySelector('.team-mark');
		const teamNameEl = this.querySelector('.team-name');
		const inviterNameEl = this.querySelector('.inviter-name');
		const dateEl = this.querySelector('.invite-date');
		const acceptBtn = this.querySelector('.accept-btn');
		const declineBtn = this.querySelector('.decline-btn');

		if (markEl) markEl.textContent = getTeamMark(teamName);
		if (teamNameEl) teamNameEl.textContent = teamName;
		if (inviterNameEl) inviterNameEl.textContent = inviterName;
		if (dateEl) dateEl.textContent = inviteDate;

		if (acceptBtn) acceptBtn.dataset.inviteId = inviteId;
		if (declineBtn) declineBtn.dataset.inviteId = inviteId;
	}
}

await loadInviteRowTemplate();
customElements.define('invite-row', InviteRow);
