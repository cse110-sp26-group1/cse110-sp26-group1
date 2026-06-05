// @ts-check
import { test, expect } from '@playwright/test';
import { setupApp } from './helpers/mock-api.js';

test.describe('Navigation & shell', () => {
	test('signed-out visit to root lands on login.html (NOT teams.html) and preserves redirect', async ({ page }) => {
		// index.html does a meta-refresh to teams.html; teams.html calls requireAuth(),
		// which must bounce a signed-out user to login.html?redirect=...teams.html.
		// We deliberately do NOT call setupApp(), so localStorage is empty and the auth
		// gate must fire. If gating ever breaks (e.g. requireAuth() is removed or a
		// regression lets teams.html render for anon users), this test fails.
		await page.goto('/html/index.html');

		// Strong URL assertion: must end up on login.html, and the redirect param
		// must point back at teams.html so the user returns to where they were headed.
		await expect(page).toHaveURL(/\/html\/login\.html\?redirect=[^&]*teams\.html/);

		// And a visible signal that the login page actually rendered.
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	});

	test('signed-in visit to root lands on teams.html (no redirect to login)', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/index.html');
		await expect(page).toHaveURL(/\/html\/teams\.html$/);
		await expect(page).not.toHaveURL(/login\.html/);
	});

	test('theme toggle persists dark mode across navigation', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/teams.html');

		await expect(page.locator('html')).not.toHaveClass(/dark/);
		await page.locator('#theme-toggle').click();
		await expect(page.locator('html')).toHaveClass(/dark/);

		// Navigate to the join page — theme class must still be applied (set in <head>).
		await page.goto('/html/join.html');
		await expect(page.locator('html')).toHaveClass(/dark/);
	});

	test('logo link on tracker returns the user to teams.html', async ({ page }) => {
		const { session } = await setupApp(page);
		if (!session) throw new Error('seed required');

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await expect(page.locator('#team-label')).toContainText(session.team.team_name);

		await page.locator('header.topbar .left a[href="teams.html"]').first().click();
		await expect(page).toHaveURL(/teams\.html$/);
	});
});
