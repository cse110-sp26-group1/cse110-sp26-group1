// @ts-check
import { test, expect } from '@playwright/test';
import { configureApiPage, makeUniqueUser, registerUser, safeDeleteTeam, setBrowserSession, setupApp } from '../helpers/api.js';

test.describe('Navigation & shell', () => {
	test('signed-out visit to root lands on login.html (NOT teams.html) and preserves redirect', async ({ page }) => {
		await configureApiPage(page);
		await page.goto('/html/index.html');
		await expect(page).toHaveURL(/\/html\/login\.html\?redirect=[^&]*teams\.html/);
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	});

	test('signed-in visit to root lands on teams.html (no redirect to login)', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('nav_root'));
		await setBrowserSession(page, session);

		await page.goto('/html/index.html');
		await expect(page).toHaveURL(/\/html\/teams\.html$/);
		await expect(page).not.toHaveURL(/login\.html/);
	});

	test('theme toggle persists dark mode across navigation', async ({ page }) => {
		const app = await setupApp(page);

		try {
			await page.goto('/html/teams.html');
			await expect(page.locator('html')).not.toHaveClass(/dark/);
			await page.locator('#theme-toggle').click();
			await expect(page.locator('html')).toHaveClass(/dark/);

			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);
			await expect(page.locator('html')).toHaveClass(/dark/);
		} finally {
			await safeDeleteTeam(app.session, app.team.id);
		}
	});

	test('logo link on tracker returns the user to teams.html', async ({ page }) => {
		const app = await setupApp(page);
		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);
			await expect(page.locator('#team-label')).toContainText(app.team.team_name, { timeout: 10_000 });

			await page.locator('header.topbar .left a[href="teams.html"]').first().click();
			await expect(page).toHaveURL(/teams\.html$/);
		} finally {
			await safeDeleteTeam(app.session, app.team.id);
		}
	});
});
