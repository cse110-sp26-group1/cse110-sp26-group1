import { STATUS_NAME } from '../constants.js';
import { loadHtmlTemplate } from './load-template.js';

let issueRowTemplate;

/**
 * Loads the issue row markup from the shared HTML component file.
 * @returns {Promise<HTMLTemplateElement>}
 */
async function loadIssueRowTemplate() {
	if (issueRowTemplate) return issueRowTemplate;
	issueRowTemplate = await loadHtmlTemplate(import.meta.url, '../../html/components/issue-row.html', 'issue-row-template');
	return issueRowTemplate;
}

/** A single issue list item displayed on the tracker page. */
class IssueRow extends HTMLElement {
	/** @returns {string[]} */
	static get observedAttributes() {
		return ['issue-title', 'summary', 'status', 'updated-date', 'updated-time', 'tags'];
	}

	#rendered = false;

	/** Clones the issue row template on first connect. */
	connectedCallback() {
		if (this.#rendered) {
			this.#update();
			return;
		}

		this.classList.add('issue-row');

		const fragment = issueRowTemplate.content.cloneNode(true);
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
		const titleEl = this.querySelector('.title-text');
		const summaryEl = this.querySelector('.summary-text');
		const labelsEl = this.querySelector('.labels');
		const statusEl = this.querySelector('.status-chip');
		const updatedEl = this.querySelector('.updated');

		if (titleEl) titleEl.textContent = this.getAttribute('issue-title') ?? '';
		if (summaryEl) summaryEl.textContent = this.getAttribute('summary') ?? '';

		if (statusEl) {
			const status = this.getAttribute('status') ?? 'Open';
			const statusKey = status === 'In Progress' ? 'prog' : status.toLowerCase();

			statusEl.textContent = STATUS_NAME[status] || status;
			statusEl.className = `chip status-chip st-${statusKey}`;
		}

		if (updatedEl) {
			updatedEl.textContent = this.getAttribute('updated-date') ?? '';
			updatedEl.title = this.getAttribute('updated-time') ?? '';
		}

		if (labelsEl) {
			const tagsStr = this.getAttribute('tags');
			const tags = tagsStr ? tagsStr.split(',') : [];
			const maxTags = window.matchMedia('(width <= 640px)').matches ? 1 : 2;
			const visibleTags = tags.slice(0, maxTags);
			const moreCount = tags.length - maxTags;

			labelsEl.innerHTML =
				visibleTags.map((l) => `<span class="chip tag-${l}">${l}</span>`).join('') +
				(moreCount > 0 ? `<span class="chip tag-more">+${moreCount}</span>` : '');
		}
	}
}

await loadIssueRowTemplate();
customElements.define('issue-row', IssueRow);
