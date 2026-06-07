// @ts-check
import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/mock-api.js';

/**
 * Seeds a small set of issues for list/filter/sort/search tests.
 * @param {object} session Session data.
 * @returns {Array<object>}
 */
function seedIssues(session) {
	return [
		{
			id: 1001,
			team_id: session.team.id,
			title: 'Login button not clickable',
			description: 'The big blue login button is unresponsive in Firefox.',
			summary: 'Login button is dead.',
			status: 'Open',
			priority: 'Critical',
			category: 'Bug',
			tags: ['ui', 'authentication'],
			updated_at: '2025-05-30 11:00:00',
		},
		{
			id: 1002,
			team_id: session.team.id,
			title: 'Dashboard charts slow to load',
			description: 'Charts take 6+ seconds to render with 1000 issues.',
			summary: 'Dashboard charts are slow.',
			status: 'In Progress',
			priority: 'High',
			category: 'Bug',
			tags: ['performance'],
			updated_at: '2025-05-29 09:00:00',
		},
		{
			id: 1003,
			team_id: session.team.id,
			title: 'Add CSV export to issues',
			description: 'Users want to export the filtered issue list as CSV.',
			summary: 'CSV export feature.',
			status: 'Open',
			priority: 'Medium',
			category: 'Feature',
			tags: ['enhancement'],
			updated_at: '2025-05-28 09:00:00',
		},
		{
			id: 1004,
			team_id: session.team.id,
			title: 'Audit deprecated API usage',
			description: 'Replace remaining calls to deprecated /v1 endpoints.',
			summary: 'Deprecated API audit.',
			status: 'Resolved',
			priority: 'Low',
			category: 'Task',
			tags: ['backend'],
			updated_at: '2025-05-20 09:00:00',
		},
	];
}

test.describe('Issues — listing and detail', () => {
	test('renders issues grouped by priority with the correct total', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);

		await expect(page.locator('#total-count')).toHaveText('4');
		const groupHeads = page.locator('.group-head');
		await expect(groupHeads.nth(0)).toContainText('Critical');
		await expect(groupHeads.nth(1)).toContainText('High');
		await expect(page.locator('.issue-row')).toHaveCount(4);
	});

	test('clicking an issue row populates the detail pane with its title', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.locator('.issue-row').filter({ hasText: 'Dashboard charts slow to load' }).click();

		const detail = page.locator('#detail');
		await expect(detail.getByRole('heading', { name: 'Dashboard charts slow to load' })).toBeVisible();
		await expect(detail).toContainText('Dashboard charts are slow.');
	});

	test('invalid team_id renders the team-not-found error state', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/tracker.html?team_id=999999');
		await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
		// Critically: do NOT render the issue list when the team is missing.
		await expect(page.locator('#issue-list .issue-row')).toHaveCount(0);
	});

	test('non-integer team_id renders the team-not-found error state', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/tracker.html?team_id=abc');
		await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
	});
});

test.describe('Issues — filter, search, sort', () => {
	test('status filter narrows the list to that status only', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await expect(page.locator('.issue-row')).toHaveCount(4);

		await page.locator('.filter-item[data-group="status"][data-val="Open"]').click();
		const rows = page.locator('.issue-row');
		await expect(rows).toHaveCount(2);
		await expect(rows).toContainText(['Login button not clickable', 'Add CSV export to issues']);
	});

	test('tag filter narrows the list to issues with that tag', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.locator('.filter-item[data-group="tag"][data-val="performance"]').click();

		const rows = page.locator('.issue-row');
		await expect(rows).toHaveCount(1);
		await expect(rows).toContainText('Dashboard charts slow to load');
	});

	test('category filter narrows the list (e.g. Feature)', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.locator('.filter-item[data-group="category"][data-val="Feature"]').click();

		const rows = page.locator('.issue-row');
		await expect(rows).toHaveCount(1);
		await expect(rows).toContainText('CSV export');
	});

	test('search filters the list by title/description/summary substring', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.locator('#issue-search').fill('csv');

		const rows = page.locator('.issue-row');
		await expect(rows).toHaveCount(1);
		await expect(rows).toContainText('CSV export');

		// Clear restores the full list.
		await page.locator('#issue-search-clear').click();
		await expect(rows).toHaveCount(4);
	});

	test('switching to "updated" sort collapses priority groups into a single "Most recent" group', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.locator('.sort-btn[data-sort="updated"]').click();

		const groupHeads = page.locator('.group-head');
		await expect(groupHeads).toHaveCount(1);
		await expect(groupHeads.first()).toContainText('Most recent');

		// First row should now be the most-recently-updated one regardless of priority.
		await expect(page.locator('.issue-row').first()).toContainText('Login button not clickable');
	});
});

test.describe('Issues — create modal', () => {
	test('does not submit when title or description is empty', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);

		const before = state.issues.length;
		await page.getByRole('button', { name: '+ New issue' }).click();
		await page.getByRole('button', { name: 'Create issue' }).click();

		// Modal still open, no new issue was created.
		await expect(page.locator('#new-backdrop')).toHaveClass(/open/);
		expect(state.issues.length).toBe(before);

		// Filling in title alone is still not enough.
		await page.locator('#new-title').fill('Just a title');
		await page.getByRole('button', { name: 'Create issue' }).click();
		expect(state.issues.length).toBe(before);
		await expect(page.locator('#new-backdrop')).toHaveClass(/open/);
	});

	test('creates an issue, closes the modal, and shows it in the list', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);

		await page.getByRole('button', { name: '+ New issue' }).click();
		await page.locator('#new-title').fill('Notifications panel crashes on open');
		await page.locator('#new-desc').fill('Clicking the bell throws TypeError: undefined is not an object.');
		await page.locator('#new-priority').selectOption('Critical');

		await page.getByRole('button', { name: 'Create issue' }).click();

		await expect(page.locator('#new-backdrop')).not.toHaveClass(/open/);
		await expect(page.locator('#issue-list')).toContainText('Notifications panel crashes on open');

		// And the backend (mock) actually has the row.
		const created = state.issues.find((i) => i.title === 'Notifications panel crashes on open');
		expect(created).toBeDefined();
		expect(created?.priority).toBe('Critical');
	});
});

test.describe('Issues — edit', () => {
	test('saves edits and the updated title shows in the list', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.locator('.issue-row').filter({ hasText: 'Login button not clickable' }).click();

		await page.locator('#detail .edit-issue-btn').click();
		await page.locator('#edit-title').fill('Login button unresponsive on Firefox');
		await page.locator('#edit-status').selectOption('In Progress');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page.locator('#issue-list')).toContainText('Login button unresponsive on Firefox');

		const updated = state.issues.find((i) => i.id === 1001);
		expect(updated?.title).toBe('Login button unresponsive on Firefox');
		expect(updated?.status).toBe('In Progress');
	});

	test('refuses to save when title or description is cleared', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.locator('.issue-row').filter({ hasText: 'Login button not clickable' }).click();

		await page.locator('#detail .edit-issue-btn').click();
		await page.locator('#edit-title').fill('');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect(page.locator('#toast')).toContainText('required');
		// Stays in edit mode.
		await expect(page.locator('#edit-title')).toBeVisible();
		const stored = state.issues.find((i) => i.id === 1001);
		expect(stored?.title).toBe('Login button not clickable');
	});
});

test.describe('Issues — keyboard navigation', () => {
	test('pressing j moves the selected row down', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		// Default selection is the first issue (highest priority).
		const rows = page.locator('.issue-row');
		await expect(rows.first()).toHaveClass(/selected/);

		// Drop focus from any input. Clicking the body would land on a list row
		// (which IS focusable via the row click handler) and pre-emptively change
		// the selection, so use blur instead.
		await page.evaluate(() => {
			const active = /** @type {HTMLElement|null} */ (document.activeElement);
			if (active && typeof active.blur === 'function') active.blur();
		});
		await page.keyboard.press('j');

		await expect(rows.nth(1)).toHaveClass(/selected/);
	});
});
