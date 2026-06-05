// @ts-check
import { test, expect } from '@playwright/test';
import { setupApp } from './helpers/mock-api.js';

test.describe('Notifications', () => {
	test('creating an issue produces a notification entry in localStorage', async ({ page }) => {
		const { session } = await setupApp(page);
		if (!session) throw new Error('seed required');

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.getByRole('button', { name: '+ New issue' }).click();
		await page.locator('#new-title').fill('Search box loses focus when you type');
		await page.locator('#new-desc').fill('Focus jumps to the sidebar after each keystroke.');
		await page.getByRole('button', { name: 'Create issue' }).click();

		await expect(page.locator('#issue-list .issue-row')).toContainText('Search box loses focus when you type');

		const stored = await page.evaluate(() => {
			const u = JSON.parse(localStorage.getItem('allegro_user') || 'null');
			const id = u && (u.username || u.email);
			const key = id ? `allegro_notifications_${id}` : 'allegro_notifications_anon';
			return JSON.parse(localStorage.getItem(key) || '[]');
		});

		expect(stored.length).toBeGreaterThanOrEqual(1);
		const last = stored[0];
		expect(last.type).toBe('new_issue');
		expect(last.message).toBe('Search box loses focus when you type');
		expect(last.isRead).toBe(false);
	});
});
