// @ts-check
// Seeds issues via /issues with test_mode=true so LLM enrichment stays predictable.
import { test, expect } from '@playwright/test';
import {
	acceptInvite,
	createIssue,
	fetchTeamMembers,
	fetchIssues,
	inviteUser,
	makeUniqueIssueTitle,
	makeUniqueUser,
	registerUser,
	setBrowserSession,
	setupApp,
	setupAppWithIssues,
} from '../helpers/api.js';

/**
 * Issue payloads spanning statuses, priorities, tags, and categories.
 * @returns {object[]}
 */
function issueSeeds() {
	return [
		{
			title: makeUniqueIssueTitle('Login button not clickable'),
			description: 'The big blue login button is unresponsive in Firefox.',
			priority: 'Critical',
			category: 'Bug',
			tags: ['ui', 'authentication'],
		},
		{
			title: makeUniqueIssueTitle('Dashboard charts slow to load'),
			description: 'Charts take 6+ seconds to render with 1000 issues.',
			status: 'In Progress',
			priority: 'High',
			category: 'Bug',
			tags: ['performance'],
		},
		{
			title: makeUniqueIssueTitle('Add CSV export to issues'),
			description: 'Users want to export the filtered issue list as CSV.',
			priority: 'Medium',
			category: 'Feature',
			tags: ['enhancement'],
		},
		{
			title: makeUniqueIssueTitle('Audit deprecated API usage'),
			description: 'Replace remaining calls to deprecated /v1 endpoints.',
			status: 'Resolved',
			priority: 'Low',
			category: 'Task',
			tags: ['backend'],
		},
	];
}

test.describe('Issues — listing and detail', () => {
	test('renders issues grouped by priority with the correct total', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);

			await expect(page.locator('#total-count')).toHaveText('4', { timeout: 10_000 });
			const groupHeads = page.locator('.group-head');
			await expect(groupHeads.nth(0)).toContainText('Critical');
			await expect(groupHeads.nth(1)).toContainText('High');
			await expect(page.locator('.issue-row')).toHaveCount(4);
		} finally {
			await ctx.cleanup();
		}
	});

	test('clicking an issue row populates the detail pane with its title', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);
			const dashboardTitle = ctx.issues.find((i) => /Dashboard charts/.test(i.title)).title;
			await page.locator('.issue-row').filter({ hasText: dashboardTitle }).click();

			const detail = page.locator('#detail');
			await expect(detail.getByRole('heading', { name: dashboardTitle })).toBeVisible();
		} finally {
			await ctx.cleanup();
		}
	});

	test('invalid team_id renders the team-not-found error state', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('notfound_user'));
		await setBrowserSession(page, session);

		await page.goto('/html/tracker.html?team_id=999999999');
		await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
		await expect(page.locator('#issue-list .issue-row')).toHaveCount(0);
	});

	test('non-integer team_id renders the team-not-found error state', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('notinteger_user'));
		await setBrowserSession(page, session);

		await page.goto('/html/tracker.html?team_id=abc');
		await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
	});
});

test.describe('Issues — filter, search, sort', () => {
	test('status filter narrows the list to that status only', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);
			await expect(page.locator('.issue-row')).toHaveCount(4);

			await page.locator('.filter-item[data-group="status"][data-val="Open"]').click();
			const rows = page.locator('.issue-row');
			await expect(rows).toHaveCount(2);

			const login = ctx.issues.find((i) => /Login button/.test(i.title)).title;
			const csv = ctx.issues.find((i) => /CSV export/.test(i.title)).title;
			await expect(rows).toContainText([login, csv]);
		} finally {
			await ctx.cleanup();
		}
	});

	test('tag filter narrows the list to issues with that tag', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);
			await page.locator('.filter-item[data-group="tag"][data-val="performance"]').click();

			const rows = page.locator('.issue-row');
			await expect(rows).toHaveCount(1);
			await expect(rows).toContainText('Dashboard charts');
		} finally {
			await ctx.cleanup();
		}
	});

	test('category filter narrows the list (e.g. Feature)', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);
			await page.locator('.filter-item[data-group="category"][data-val="Feature"]').click();

			const rows = page.locator('.issue-row');
			await expect(rows).toHaveCount(1);
			await expect(rows).toContainText('CSV export');
		} finally {
			await ctx.cleanup();
		}
	});

	test('search filters the list by title/description/summary substring', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);
			await page.locator('#issue-search').fill('csv');

			const rows = page.locator('.issue-row');
			await expect(rows).toHaveCount(1);
			await expect(rows).toContainText('CSV export');

			await page.locator('#issue-search-clear').click();
			await expect(rows).toHaveCount(4);
		} finally {
			await ctx.cleanup();
		}
	});

	test('switching to "updated" sort collapses priority groups into a single "Most recent" group', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);
			await page.locator('.sort-btn[data-sort="updated"]').click();

			const groupHeads = page.locator('.group-head');
			await expect(groupHeads).toHaveCount(1);
			await expect(groupHeads.first()).toContainText('Most recent');
		} finally {
			await ctx.cleanup();
		}
	});
});

test.describe('Issues — create modal', () => {
	test('does not submit when title or description is empty', async ({ page }) => {
		const app = await setupApp(page);
		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);

			await page.getByRole('button', { name: '+ New issue' }).click();
			await page.getByRole('button', { name: 'Create issue' }).click();
			await expect(page.locator('#new-backdrop')).toHaveClass(/open/);

			await page.locator('#new-title').fill('Just a title');
			await page.getByRole('button', { name: 'Create issue' }).click();
			await expect(page.locator('#new-backdrop')).toHaveClass(/open/);
		} finally {
			await app.cleanup();
		}
	});

	test('creates an issue, closes the modal, and shows it in the list', async ({ page }) => {
		const app = await setupApp(page);
		const title = makeUniqueIssueTitle('Notifications panel crashes');
		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);

			await page.getByRole('button', { name: '+ New issue' }).click();
			await page.locator('#new-title').fill(title);
			await page.locator('#new-desc').fill('Clicking the bell throws TypeError: undefined is not an object.');
			await page.locator('#new-priority').selectOption('Critical');

			await page.getByRole('button', { name: 'Create issue' }).click();

			await expect(page.locator('#new-backdrop')).not.toHaveClass(/open/, { timeout: 15_000 });
			await expect(page.locator('#issue-list')).toContainText(title, { timeout: 10_000 });

			const persisted = (await fetchIssues(app.session, app.team.id)).find((issue) => issue.title === title);
			expect(persisted).toBeDefined();
			expect(persisted).toMatchObject({
				title,
				priority: 'Critical',
			});
		} finally {
			await app.cleanup();
		}
	});

	test('creates an issue assigned to a team member and persists the assignee', async ({ page }) => {
		const app = await setupApp(page);
		const member = await registerUser(makeUniqueUser('assign_member'));
		const invite = await inviteUser(app.session, app.team.id, { email: member.credentials.email });
		await acceptInvite(member, invite.invite_id);
		const assignee = (await fetchTeamMembers(app.session, app.team.id)).find((row) => row.email === member.credentials.email);
		if (!assignee) throw new Error('Expected invited user to appear in team members before assigning an issue.');

		const assigneeLabel = `${assignee.first_name} ${assignee.last_name}`;
		const title = makeUniqueIssueTitle('Assigned issue');

		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);

			await page.getByRole('button', { name: '+ New issue' }).click();
			await expect(page.locator('#new-assignee')).toContainText(assigneeLabel);
			await page.locator('#new-title').fill(title);
			await page.locator('#new-desc').fill('This issue should be assigned during creation.');
			await page.locator('#new-assignee').selectOption(String(assignee.id));
			await expect(page.locator('#new-assignee')).toHaveValue(String(assignee.id));

			await page.getByRole('button', { name: 'Create issue' }).click();

			await expect(page.locator('#new-backdrop')).not.toHaveClass(/open/, { timeout: 15_000 });
			await expect(page.locator('#issue-list')).toContainText(title, { timeout: 10_000 });
			await expect(page.locator(`#detail .avatar.sm[title="${assigneeLabel}"]`)).toBeVisible();

			const persisted = (await fetchIssues(app.session, app.team.id)).find((issue) => issue.title === title);
			expect(persisted).toBeDefined();
			expect(persisted.assigned_to).toBe(assignee.id);
		} finally {
			await app.cleanup();
		}
	});

	test('creates an issue with a text attachment and persists the attachment contents', async ({ page }) => {
		const app = await setupApp(page);
		const title = makeUniqueIssueTitle('Attachment repro');
		const attachmentText = 'TypeError: Cannot read properties of undefined in NotificationDrawer.open';

		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);

			await page.getByRole('button', { name: '+ New issue' }).click();
			await page.locator('#new-title').fill(title);
			await page.locator('#new-desc').fill('A crash log is attached with the exact stack text.');
			await page.locator('#file-input').setInputFiles({
				name: 'crash.log',
				mimeType: 'text/plain',
				buffer: Buffer.from(attachmentText),
			});
			await expect(page.locator('#file-list .file-chip')).toContainText('crash.log');

			await page.getByRole('button', { name: 'Create issue' }).click();

			await expect(page.locator('#new-backdrop')).not.toHaveClass(/open/, { timeout: 15_000 });
			await expect(page.locator('#issue-list')).toContainText(title, { timeout: 10_000 });
			await expect(page.locator('#detail')).toContainText(attachmentText);

			const persisted = (await fetchIssues(app.session, app.team.id)).find((issue) => issue.title === title);
			expect(persisted).toBeDefined();
			expect(persisted.description).toContain('--- Attachment: crash.log ---');
			expect(persisted.description).toContain(attachmentText);
		} finally {
			await app.cleanup();
		}
	});
});

test.describe('Issues — edit', () => {
	test('saves edits and the updated title shows in the list', async ({ page }) => {
		const app = await setupApp(page);
		const original = makeUniqueIssueTitle('Login button bug');
		await createIssue(app.session, app.team.id, {
			title: original,
			description: 'login button broken in firefox',
			priority: 'Critical',
			category: 'Bug',
			tags: ['ui'],
		});

		const updated = `${original} (firefox-only)`;

		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);
			await page.locator('.issue-row').filter({ hasText: original }).click();

			await page.locator('#detail .edit-issue-btn').click();
			await page.locator('#edit-title').fill(updated);
			await page.locator('#edit-status').selectOption('In Progress');
			await page.getByRole('button', { name: 'Save' }).click();

			await expect(page.locator('#issue-list')).toContainText(updated, { timeout: 10_000 });

			const issues = await fetchIssues(app.session, app.team.id);
			const persisted = issues.find((issue) => issue.title === updated);
			expect(persisted).toBeDefined();
			expect(persisted).toMatchObject({
				title: updated,
				status: 'In Progress',
			});
			expect(issues.find((issue) => issue.title === original)).toBeUndefined();
		} finally {
			await app.cleanup();
		}
	});

	test('refuses to save when title or description is cleared', async ({ page }) => {
		const app = await setupApp(page);
		const original = makeUniqueIssueTitle('Edit guard');
		await createIssue(app.session, app.team.id, {
			title: original,
			description: 'Will try to clear the title and confirm save is blocked.',
		});

		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);
			await page.locator('.issue-row').filter({ hasText: original }).click();

			await page.locator('#detail .edit-issue-btn').click();
			await page.locator('#edit-title').fill('');
			await page.getByRole('button', { name: 'Save' }).click();

			await expect(page.locator('#toast')).toContainText('required');
			await expect(page.locator('#edit-title')).toBeVisible();
		} finally {
			await app.cleanup();
		}
	});
});

test.describe('Issues — delete', () => {
	test('deletes an issue from the detail pane and it disappears from the list', async ({ page }) => {
		const app = await setupApp(page);
		const title = makeUniqueIssueTitle('Delete me');
		await createIssue(app.session, app.team.id, {
			title,
			description: 'About to be deleted via the UI.',
		});

		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);
			await page.locator('.issue-row').filter({ hasText: title }).click();

			await page.locator('#detail .edit-issue-btn').click();
			await page.locator('#detail .delete-issue-btn').click();
			await expect(page.locator('#delete-backdrop')).toHaveClass(/open/);
			await page.locator('#confirm-delete').click();

			await expect(page.locator('#issue-list')).not.toContainText(title, { timeout: 10_000 });
			const issues = await fetchIssues(app.session, app.team.id);
			expect(issues.find((issue) => issue.title === title)).toBeUndefined();
		} finally {
			await app.cleanup();
		}
	});
});

test.describe('Issues — keyboard navigation', () => {
	test('pressing j moves the selected row down', async ({ page }) => {
		const ctx = await setupAppWithIssues(page, issueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);
			const rows = page.locator('.issue-row');
			await expect(rows.first()).toHaveClass(/selected/, { timeout: 10_000 });

			await page.evaluate(() => {
				const active = /** @type {HTMLElement|null} */ (document.activeElement);
				if (active && typeof active.blur === 'function') active.blur();
			});
			await page.keyboard.press('j');

			await expect(rows.nth(1)).toHaveClass(/selected/);
		} finally {
			await ctx.cleanup();
		}
	});
});
