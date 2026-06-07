const templateUrl = new URL('../../html/components/issue-row.html', import.meta.url);

let issueRowTemplate;

async function loadIssueRowTemplate() {
	if (issueRowTemplate) return issueRowTemplate;

	const response = await fetch(templateUrl);
	if (!response.ok) {
		throw new Error(`Failed to load issue row template (${response.status})`);
	}

	const html = await response.text();
	const doc = new DOMParser().parseFromString(html, 'text/html');
	issueRowTemplate = doc.getElementById('issue-row-template');

	if (!issueRowTemplate) {
		throw new Error('issue-row-template not found in issue-row.html');
	}

	return issueRowTemplate;
}

class IssueRow extends HTMLElement {
	static get observedAttributes() {
		return ['issue-title', 'summary', 'status', 'updated-date', 'updated-time', 'tags'];
	}

	#rendered = false;

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

	attributeChangedCallback() {
		if (this.#rendered) this.#update();
	}

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
			const STATUS_NAME = { Open: 'Open', 'In Progress': 'In Progress', Resolved: 'Resolved', Closed: 'Closed' };

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

			labelsEl.innerHTML = visibleTags.map((l) => `<span class="chip tag-${l}">${l}</span>`).join('') + (moreCount > 0 ? `<span class="chip tag-more">+${moreCount}</span>` : '');
		}
	}
}

await loadIssueRowTemplate();
customElements.define('issue-row', IssueRow);
