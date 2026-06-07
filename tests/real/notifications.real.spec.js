// @ts-check
// Real-backend version of notifications.spec.js. The notification dropdown
// markup is commented out, so this only verifies the per-user localStorage
// notification entry written after a successful issue create.
import { test, expect } from '@playwright/test';
import { makeUniqueIssueTitle, setupRealApp } from '../helpers/real-api.js';

test.describe('Notifications (real backend)', () => {
	test('creating an issue produces a notification entry in localStorage', async ({ page }) => {
		const app = await setupRealApp(page);
		const title = makeUniqueIssueTitle('Search box loses focus');

		try {
			await page.goto(`/html/tracker.html?team_id=${app.team.id}`);
			await page.getByRole('button', { name: '+ New issue' }).click();
			await page.locator('#new-title').fill(title);
			await page.locator('#new-desc').fill('Focus jumps to the sidebar after each keystroke.');
			await page.getByRole('button', { name: 'Create issue' }).click();

			await expect(page.locator('#issue-list .issue-row')).toContainText(title, { timeout: 10_000 });

			const stored = await page.evaluate(() => {
				const u = JSON.parse(localStorage.getItem('allegro_user') || 'null');
				const id = u && (u.username || u.email);
				const key = id ? `allegro_notifications_${id}` : 'allegro_notifications_anon';
				return JSON.parse(localStorage.getItem(key) || '[]');
			});

			expect(stored.length).toBeGreaterThanOrEqual(1);
			const last = stored[0];
			expect(last.type).toBe('new_issue');
			expect(last.message).toBe(title);
			expect(last.isRead).toBe(false);
		} finally {
			await app.cleanup();
		}
	});
});
