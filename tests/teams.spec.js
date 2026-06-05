// @ts-check
import { test, expect } from '@playwright/test';
import { setupApp } from './helpers/mock-api.js';

test.describe('Teams dashboard', () => {
	test('renders team cards from the API with names and roles', async ({ page }) => {
		const { state, session } = await setupApp(page, {
			team: { id: 1, team_name: 'Studio · AI Tools', role: 'admin' },
		});
		if (!session) throw new Error('seed required');
		// Add a second team for the same user.
		state.teams.push({
			id: 2,
			team_name: 'Group 8 · Capstone',
			role: 'member',
			created_at: '2025-05-02 12:00:00',
		});
		state.memberships.push({ team_id: 2, user_id: session.user.id, role: 'member' });

		await page.goto('/html/teams.html');

		await expect(page.getByRole('heading', { name: 'Studio · AI Tools' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Group 8 · Capstone' })).toBeVisible();

		// Role subtitle is rendered by the team-card web component.
		const cards = page.locator('team-card');
		await expect(cards).toHaveCount(2);
		await expect(cards.filter({ hasText: 'Studio · AI Tools' })).toContainText('Workspace Admin');
		await expect(cards.filter({ hasText: 'Group 8 · Capstone' })).toContainText('Workspace Member');
	});

	test('clicking a team card navigates to that team in the tracker', async ({ page }) => {
		const { session } = await setupApp(page);
		if (!session) throw new Error('seed required');

		await page.goto('/html/teams.html');
		const link = page.locator('team-card a.team').first();
		await expect(link).toHaveAttribute('href', `tracker.html?team_id=${session.team.id}`);
		await link.click();
		await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${session.team.id}`));
	});

	test('create-team modal validates the name and creates a new team', async ({ page }) => {
		const { state } = await setupApp(page);

		await page.goto('/html/teams.html');
		await page.getByRole('button', { name: '+ New team' }).click();
		const modal = page.locator('#create-backdrop');
		await expect(modal).toHaveClass(/open/);

		// PRIMARY (user-visible): empty submit keeps the modal open and stays on teams.html.
		// We also assert no team-card was added to the grid.
		const before = state.teams.length;
		const teamCards = page.locator('team-card');
		const cardCountBefore = await teamCards.count();
		await page.getByRole('button', { name: 'Create team' }).click();
		await expect(page).toHaveURL(/teams\.html/);
		await expect(modal).toHaveClass(/open/);
		await expect(teamCards).toHaveCount(cardCountBefore);
		// SECONDARY: state didn't move either.
		expect(state.teams.length).toBe(before);

		// Real create — fill in a name and submit.
		await page.getByPlaceholder('e.g. Roost Robotics').fill('Rocket Squad');
		// Watch the outgoing POST so we know the UI actually sent the right payload
		// (and that this is not just an optimistic-UI shortcut).
		const [createReq] = await Promise.all([
			page.waitForRequest((req) => req.url().endsWith('/teams') && req.method() === 'POST'),
			page.getByRole('button', { name: 'Create team' }).click(),
		]);
		expect(createReq.postDataJSON()).toMatchObject({ team_name: 'Rocket Squad' });

		// PRIMARY (user-visible): a success toast appears, then teams.js redirects to the
		// new team's tracker page.
		await expect(page.locator('#toast')).toContainText('Workspace created');
		await expect(page).toHaveURL(/tracker\.html\?team_id=\d+/, { timeout: 4000 });

		// SECONDARY: mock confirms the row exists.
		expect(state.teams.find((t) => t.team_name === 'Rocket Squad')).toBeDefined();
	});

	test('shows the pending-invites badge with the correct count', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');

		// Two pending invites for the signed-in user.
		state.teams.push(
			{ id: 50, team_name: 'Hearth OS', role: 'member', created_at: '2025-05-10' },
			{ id: 51, team_name: 'Side Quest', role: 'member', created_at: '2025-05-11' },
		);
		state.invites.push(
			{
				id: 901,
				team_id: 50,
				team_name: 'Hearth OS',
				inviter_username: 'mira',
				status: 'pending',
				invited_user_id: session.user.id,
				created_at: '2025-05-15',
			},
			{
				id: 902,
				team_id: 51,
				team_name: 'Side Quest',
				inviter_username: 'leo',
				status: 'pending',
				invited_user_id: session.user.id,
				created_at: '2025-05-16',
			},
		);

		await page.goto('/html/teams.html');

		const inviteBtn = page.locator('#view-invites');
		await expect(inviteBtn.locator('.invite-badge')).toHaveText('2');
	});

	test('shows the pending-invitations section listing all invites by team', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.invites.push({
			id: 900,
			team_id: session.team.id,
			team_name: 'Hearth OS',
			inviter_username: 'mira',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-15',
		});

		await page.goto('/html/teams.html');
		const invitesSection = page.locator('#invites-section');
		await expect(invitesSection).toBeVisible();
		await expect(invitesSection).toContainText('Hearth OS');
		await expect(invitesSection).toContainText('mira');
	});
});
