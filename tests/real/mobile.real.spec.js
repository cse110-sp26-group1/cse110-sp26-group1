// @ts-check
// Real-backend version of mobile.spec.js. Only runs in the mobile-chrome
// Playwright project (Pixel 5 viewport) so we don't duplicate desktop coverage.
import { test, expect } from '@playwright/test';
import {
	createRealTeam,
	inviteRealUser,
	makeUniqueIssueTitle,
	makeUniqueTeamName,
	makeUniqueUser,
	registerRealUser,
	safeDeleteRealTeam,
	setBrowserSession,
	setupRealAppWithIssues,
} from '../helpers/real-api.js';

/**
 * Three predictable issue payloads — Critical / High / Medium — used to drive
 * the mobile drawer, search relocation, and master/detail tests.
 * @returns {object[]}
 */
function threeIssueSeeds() {
	return [
		{
			title: makeUniqueIssueTitle('Login button not clickable'),
			description: 'Big blue login button is dead.',
			priority: 'Critical',
			category: 'Bug',
			tags: ['ui'],
		},
		{
			title: makeUniqueIssueTitle('Dashboard charts slow to load'),
			description: 'Charts take 6+ seconds.',
			status: 'In Progress',
			priority: 'High',
			category: 'Bug',
			tags: ['performance'],
		},
		{
			title: makeUniqueIssueTitle('Add CSV export to issues'),
			description: 'Users want CSV.',
			priority: 'Medium',
			category: 'Feature',
			tags: ['enhancement'],
		},
	];
}

test.describe('Mobile — tracker sidebar drawer (real backend)', () => {
	test('sidebar starts closed; toggle opens it as an overlay; backdrop closes it', async ({ page }) => {
		const ctx = await setupRealAppWithIssues(page, threeIssueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);

			const app = page.locator('.app');
			const toggle = page.locator('#sidebar-toggle');
			const backdrop = page.locator('#sidebar-backdrop');
			const statusFilter = page.locator('.filter-item[data-group="status"][data-val="Open"]');

			await expect(toggle).toBeVisible();
			await expect(app).not.toHaveClass(/sidebar-open/);
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect(backdrop).toBeHidden();

			await toggle.click();
			await expect(app).toHaveClass(/sidebar-open/);
			await expect(toggle).toHaveAttribute('aria-expanded', 'true');
			await expect(backdrop).toBeVisible();
			await expect(statusFilter).toBeVisible();

			await backdrop.click();
			await expect(app).not.toHaveClass(/sidebar-open/);
			await expect(toggle).toHaveAttribute('aria-expanded', 'false');
			await expect(backdrop).toBeHidden();
		} finally {
			await ctx.cleanup();
		}
	});

	test('search input lives inside the sidebar drawer on mobile (relocated from the topbar)', async ({ page }) => {
		const ctx = await setupRealAppWithIssues(page, threeIssueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);

			const slotId = await page
				.locator('#issue-search')
				.evaluate((el) => /** @type {HTMLElement} */ (el).closest('.search-wrap')?.parentElement?.id);
			expect(slotId).toBe('sidebar-search-slot');

			await page.locator('#sidebar-toggle').click();
			await expect(page.locator('.app')).toHaveClass(/sidebar-open/);
			await page.locator('#issue-search').fill('csv');
			await expect(page.locator('.issue-row')).toHaveCount(1);
			await expect(page.locator('.issue-row')).toContainText('CSV export');
		} finally {
			await ctx.cleanup();
		}
	});
});

test.describe('Mobile — tracker master/detail (real backend)', () => {
	test('tapping a row shows the issue detail full-screen; back button returns to the list', async ({ page }) => {
		const ctx = await setupRealAppWithIssues(page, threeIssueSeeds());
		try {
			await page.goto(`/html/tracker.html?team_id=${ctx.team.id}`);

			const content = page.locator('#content');
			const listPane = page.locator('.list-pane');
			const detail = page.locator('#detail');

			await expect(listPane).toBeVisible();
			await expect(content).not.toHaveClass(/mobile-detail-view/);

			const dashboardTitle = ctx.issues.find((i) => /Dashboard charts/.test(i.title)).title;
			await page.locator('.issue-row').filter({ hasText: dashboardTitle }).click();

			await expect(content).toHaveClass(/mobile-detail-view/);
			await expect(detail).toBeVisible();
			await expect(listPane).toBeHidden();
			await expect(detail.getByRole('heading', { name: dashboardTitle })).toBeVisible();

			await detail.getByRole('button', { name: /Back/ }).click();

			await expect(content).not.toHaveClass(/mobile-detail-view/);
			await expect(listPane).toBeVisible();
		} finally {
			await ctx.cleanup();
		}
	});
});

test.describe('Mobile — teams page (real backend)', () => {
	test('hero "New team" button + pending invites remain visible and usable at narrow viewport', async ({ page }) => {
		// The hero "Pending invites" button has been removed (commit c16d5fe).
		// On mobile, we still expect: the +New team CTA stays hittable, and any
		// pending invites render in the #invites-section list.
		const invitee = await registerRealUser(makeUniqueUser('mobile_invitee'));
		const admin = await registerRealUser(makeUniqueUser('mobile_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Mobile Hero') });
		await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');

			const newTeam = page.getByRole('button', { name: '+ New team' });
			await expect(newTeam).toBeVisible();

			const section = page.locator('#invites-section');
			await expect(section).toBeVisible();
			await expect(section.locator('.invite')).toHaveCount(1);

			await newTeam.click();
			await expect(page.locator('#create-backdrop')).toHaveClass(/open/);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});
});
