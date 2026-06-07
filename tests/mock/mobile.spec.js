// @ts-check
import { test, expect } from '@playwright/test';
import { setupApp } from '../helpers/mock-api.js';

// These tests run ONLY in the `mobile-chrome` project (Pixel 5 viewport, 393×851).
// The desktop projects skip this file entirely via playwright.config.js's testMatch,
// so we don't duplicate the desktop suite — we cover only the behaviors that meaningfully
// differ on a narrow viewport: the filter-sidebar drawer, the relocated search input,
// and the master/detail (full-screen issue) navigation with the back button.

/**
 * @param {object} session
 */
function seedThreeIssues(session) {
	return [
		{
			id: 2001,
			team_id: session.team.id,
			title: 'Login button not clickable',
			description: 'Big blue login button is dead.',
			summary: 'Login button is dead.',
			status: 'Open',
			priority: 'Critical',
			category: 'Bug',
			tags: ['ui'],
			updated_at: '2025-05-30 11:00:00',
		},
		{
			id: 2002,
			team_id: session.team.id,
			title: 'Dashboard charts slow to load',
			description: 'Charts take 6+ seconds.',
			summary: 'Charts are slow.',
			status: 'In Progress',
			priority: 'High',
			category: 'Bug',
			tags: ['performance'],
			updated_at: '2025-05-29 09:00:00',
		},
		{
			id: 2003,
			team_id: session.team.id,
			title: 'Add CSV export to issues',
			description: 'Users want CSV.',
			summary: 'CSV export.',
			status: 'Open',
			priority: 'Medium',
			category: 'Feature',
			tags: ['enhancement'],
			updated_at: '2025-05-28 09:00:00',
		},
	];
}

test.describe('Mobile — tracker sidebar drawer', () => {
	test('sidebar starts closed; toggle opens it as an overlay; backdrop closes it', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedThreeIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);

		const app = page.locator('.app');
		const toggle = page.locator('#sidebar-toggle');
		const backdrop = page.locator('#sidebar-backdrop');
		const statusFilter = page.locator('.filter-item[data-group="status"][data-val="Open"]');

		// On mobile, the toggle button is visible (it's display:none on desktop).
		await expect(toggle).toBeVisible();
		// Drawer starts closed.
		await expect(app).not.toHaveClass(/sidebar-open/);
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(backdrop).toBeHidden();
		// Sidebar filter is off-screen (translated out via CSS). The element exists but
		// is not in the user's viewport — clicking it without opening the drawer would
		// not be possible. Playwright's isVisible considers transforms, so the most
		// reliable check is the `.sidebar-open` class + aria-expanded.

		// Open the drawer.
		await toggle.click();
		await expect(app).toHaveClass(/sidebar-open/);
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await expect(backdrop).toBeVisible();
		// Filter row is now reachable for a tap.
		await expect(statusFilter).toBeVisible();

		// Tap the backdrop to close.
		await backdrop.click();
		await expect(app).not.toHaveClass(/sidebar-open/);
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(backdrop).toBeHidden();
	});

	test('search input lives inside the sidebar drawer on mobile (relocated from the topbar)', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedThreeIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);

		// Verify the .search-wrap was MOVED out of #topbar-search-slot and into
		// #sidebar-search-slot. This is the visible behavior a user notices: the
		// search field is no longer in the cramped topbar.
		const slotId = await page
			.locator('#issue-search')
			.evaluate((el) => /** @type {HTMLElement} */ (el).closest('.search-wrap')?.parentElement?.id);
		expect(slotId).toBe('sidebar-search-slot');

		// Open the drawer and confirm search is actually usable (filters the list).
		await page.locator('#sidebar-toggle').click();
		await expect(page.locator('.app')).toHaveClass(/sidebar-open/);
		await page.locator('#issue-search').fill('csv');
		await expect(page.locator('.issue-row')).toHaveCount(1);
		await expect(page.locator('.issue-row')).toContainText('CSV export');
	});
});

test.describe('Mobile — tracker master/detail', () => {
	test('tapping a row shows the issue detail full-screen; back button returns to the list', async ({ page }) => {
		const { session, state } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.issues.push(...seedThreeIssues(session));

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);

		// On mobile, the list pane fills the screen and the detail pane is hidden
		// until a row is tapped. The CSS rules .content .detail{display:none} and
		// .content.mobile-detail-view .detail{display:flex} drive this.
		const content = page.locator('#content');
		const listPane = page.locator('.list-pane');
		const detail = page.locator('#detail');

		await expect(listPane).toBeVisible();
		await expect(content).not.toHaveClass(/mobile-detail-view/);

		// Tap an issue row.
		await page.locator('.issue-row').filter({ hasText: 'Dashboard charts slow to load' }).click();

		// Detail is now visible full-screen, list pane is hidden.
		await expect(content).toHaveClass(/mobile-detail-view/);
		await expect(detail).toBeVisible();
		await expect(listPane).toBeHidden();
		await expect(detail.getByRole('heading', { name: 'Dashboard charts slow to load' })).toBeVisible();

		// Tap the mobile back button (rendered inside the detail header on mobile).
		await detail.getByRole('button', { name: /Back/ }).click();

		await expect(content).not.toHaveClass(/mobile-detail-view/);
		await expect(listPane).toBeVisible();
	});
});

test.describe('Mobile — teams page', () => {
	test('new-team action and pending invites remain visible and usable', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.invites.push({
			id: 5001,
			team_id: session.team.id,
			team_name: session.team.team_name,
			inviter_username: 'mira',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-15',
		});

		await page.goto('/html/teams.html');

		const newTeam = page.getByRole('button', { name: '+ New team' });
		await expect(newTeam).toBeVisible();
		const invitesSection = page.locator('#invites-section');
		await expect(invitesSection).toBeVisible();
		await expect(invitesSection.locator('.invite')).toHaveCount(1);
		await expect(invitesSection).toContainText(session.team.team_name);

		// Tapping "New team" actually opens the modal (proves the button is hittable).
		await newTeam.click();
		await expect(page.locator('#create-backdrop')).toHaveClass(/open/);
	});
});
