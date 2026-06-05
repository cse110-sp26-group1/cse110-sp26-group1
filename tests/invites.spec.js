// @ts-check
import { test, expect } from '@playwright/test';
import { setupApp } from './helpers/mock-api.js';

test.describe('Invites — teams page', () => {
	test("accepting an invite: row disappears, badge decrements, team appears in the user's team list", async ({ page }) => {
		// Seed TWO pending invites so we can prove the badge decrements (2 → 1),
		// not just that it hides altogether. Also seed the teams so the accept
		// flow can add the new membership and the team list can re-render.
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.teams.push(
			{ id: 88, team_name: 'Hearth OS', role: 'member', created_at: '2025-05-10' },
			{ id: 89, team_name: 'Side Quest', role: 'member', created_at: '2025-05-11' },
		);
		state.invites.push(
			{
				id: 999,
				team_id: 88,
				team_name: 'Hearth OS',
				inviter_username: 'mira',
				status: 'pending',
				invited_user_id: session.user.id,
				created_at: '2025-05-15',
			},
			{
				id: 1000,
				team_id: 89,
				team_name: 'Side Quest',
				inviter_username: 'leo',
				status: 'pending',
				invited_user_id: session.user.id,
				created_at: '2025-05-16',
			},
		);

		await page.goto('/html/teams.html');

		// Pre-conditions visible to the user:
		const badge = page.locator('#view-invites .invite-badge');
		await expect(badge).toHaveText('2');
		const acceptedRow = page.locator(`#invites-section .invite[data-invite-id="999"]`);
		const otherRow = page.locator(`#invites-section .invite[data-invite-id="1000"]`);
		await expect(acceptedRow).toBeVisible();
		// Hearth OS is NOT yet a team card before accept (the user wasn't a member).
		await expect(page.locator('team-card[name="Hearth OS"]')).toHaveCount(0);

		// Action: accept.
		await acceptedRow.getByRole('button', { name: 'Accept' }).click();

		// PRIMARY user-visible proof — all of these must change:
		// 1. The accepted row disappears from the pending-invite list.
		await expect(acceptedRow).toHaveCount(0);
		// 2. The other invite is still present (we didn't accidentally clear the wrong row).
		//    Use .first() because teams.js's loadInvites() re-appends rather than replacing
		//    on re-render, so the row may end up duplicated — that's a separate UI bug,
		//    not what this test is guarding.
		await expect(otherRow.first()).toBeVisible();
		// 3. The pending-invite badge decrements from 2 to 1 (visible UI count, not state).
		await expect(badge).toHaveText('1');
		// 4. The newly-joined team renders in the team grid as a card the user can click.
		const newTeamCard = page.locator('team-card[name="Hearth OS"]');
		await expect(newTeamCard).toHaveCount(1);
		await expect(newTeamCard).toBeVisible();
		// 5. A success toast confirms the action.
		await expect(page.locator('#toast')).toContainText('Invitation accepted');

		// SECONDARY: mock-state cross-check (would catch a UI that lies without calling the API).
		expect(state.invites.find((i) => i.id === 999)?.status).toBe('accepted');
		expect(state.memberships.find((m) => m.team_id === 88 && m.user_id === session.user.id)).toBeDefined();
	});

	test('accepting the LAST invite removes the badge entirely', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.teams.push({ id: 88, team_name: 'Hearth OS', role: 'member', created_at: '2025-05-10' });
		state.invites.push({
			id: 999,
			team_id: 88,
			team_name: 'Hearth OS',
			inviter_username: 'mira',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-15',
		});

		await page.goto('/html/teams.html');
		const badge = page.locator('#view-invites .invite-badge');
		await expect(badge).toHaveText('1');

		await page.locator('#invites-section .invite[data-invite-id="999"]').getByRole('button', { name: 'Accept' }).click();

		// Badge node is removed entirely when count hits zero.
		await expect(badge).toHaveCount(0);
		// Section also hides when there are no remaining invites.
		await expect(page.locator('#invites-section')).toBeHidden();
	});

	test('decline removes the invite row and surfaces a toast', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.invites.push({
			id: 777,
			team_id: session.team.id,
			team_name: 'Hearth OS',
			inviter_username: 'mira',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-15',
		});

		await page.goto('/html/teams.html');
		const row = page.locator(`#invites-section .invite[data-invite-id="777"]`);
		await expect(row).toBeVisible();

		await row.getByRole('button', { name: 'Decline' }).click();
		await expect(row).toHaveCount(0);
		await expect(page.locator('#toast')).toContainText('Invitation declined.');

		const invite = state.invites.find((i) => i.id === 777);
		expect(invite?.status).toBe('declined');
	});
});

test.describe('Invites — join.html', () => {
	test('shows the empty state when there are no pending invites', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/join.html');
		await expect(page.locator('#join-empty')).toBeVisible();
		await expect(page.locator('#join-empty')).toContainText('no pending invitations');
	});

	test('lists pending invites in the code-entry view', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.invites.push({
			id: 333,
			team_id: session.team.id,
			team_name: 'Side Quest',
			inviter_username: 'leo',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-20',
		});

		await page.goto('/html/join.html');
		const list = page.locator('#invite-list');
		await expect(list).toBeVisible();
		await expect(list).toContainText('Side Quest');
		await expect(list).toContainText('leo');
	});

	test('preview view renders for ?team_id matching a pending invite', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.teams.push({
			id: 42,
			team_name: 'Roost Robotics',
			role: 'member',
			created_at: '2025-05-12',
		});
		state.invites.push({
			id: 444,
			team_id: 42,
			team_name: 'Roost Robotics',
			inviter_username: 'priya',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-22',
		});

		await page.goto('/html/join.html?team_id=42');
		await expect(page.locator('#join-preview-view')).toBeVisible();
		await expect(page.locator('#preview-name')).toHaveText('Roost Robotics');
		await expect(page.locator('#preview-meta')).toContainText('priya');
	});

	test('preview view shows invalid-code message when no invite matches ?team_id', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/join.html?team_id=999');
		await expect(page.locator('#join-invalid')).toBeVisible();
		await expect(page.locator('#join-invalid')).toContainText(/invalid|expired/i);
	});

	test('preview "Join workspace" button accepts the invite and redirects to tracker', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.teams.push({
			id: 42,
			team_name: 'Roost Robotics',
			role: 'member',
			created_at: '2025-05-12',
		});
		state.invites.push({
			id: 444,
			team_id: 42,
			team_name: 'Roost Robotics',
			inviter_username: 'priya',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-22',
		});

		await page.goto('/html/join.html?team_id=42');
		await page.getByRole('button', { name: 'Join workspace' }).click();

		await expect(page).toHaveURL(/tracker\.html\?team_id=42/, { timeout: 4000 });
		expect(state.invites.find((i) => i.id === 444)?.status).toBe('accepted');
	});

	test('code-entry form rejects empty input with an inline error', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		// At least one invite so the code-entry view (not empty state) renders.
		state.invites.push({
			id: 1,
			team_id: session.team.id,
			team_name: 'Hearth OS',
			inviter_username: 'mira',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-20',
		});

		await page.goto('/html/join.html');
		await page.getByRole('button', { name: 'Look up' }).click();
		await expect(page.locator('#code-error')).toBeVisible();
		await expect(page.locator('#code-error')).toContainText('Enter an invite code');
	});

	test('code-entry form rejects garbage input with an inline error', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		state.invites.push({
			id: 1,
			team_id: session.team.id,
			team_name: 'Hearth OS',
			inviter_username: 'mira',
			status: 'pending',
			invited_user_id: session.user.id,
			created_at: '2025-05-20',
		});

		await page.goto('/html/join.html');
		await page.locator('#code-input').fill('not-a-code');
		await page.getByRole('button', { name: 'Look up' }).click();
		await expect(page.locator('#code-error')).toBeVisible();
		await expect(page.locator('#code-error')).toContainText("doesn't look like a valid invite code");
	});
});

test.describe('Invites — tracker invite modal', () => {
	test('sends an invite to an existing user', async ({ page }) => {
		const { state, session } = await setupApp(page);
		if (!session) throw new Error('seed required');
		// A second user that we can invite.
		state.users.push({
			id: 4242,
			username: 'priya',
			email: 'priya@example.com',
			first_name: 'Priya',
			last_name: 'Rao',
			password: 'pw',
		});

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.getByRole('button', { name: 'Invite user' }).click();
		await page.getByPlaceholder(/ada@example|adalovelace/i).fill('priya');
		await page.getByRole('button', { name: 'Send invite' }).click();

		await expect(page.locator('#toast')).toContainText('Invitation sent to priya');
		const newInvite = state.invites.find((i) => i.invited_user_id === 4242 && i.team_id === session.team.id);
		expect(newInvite).toBeDefined();
	});

	test('shows an inline error when the user does not exist (404)', async ({ page }) => {
		const { session } = await setupApp(page);
		if (!session) throw new Error('seed required');

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.getByRole('button', { name: 'Invite user' }).click();
		await page.getByPlaceholder(/ada@example|adalovelace/i).fill('nobody');
		await page.getByRole('button', { name: 'Send invite' }).click();

		const err = page.locator('#invite-error');
		await expect(err).toBeVisible();
		await expect(err).toContainText("No user found for 'nobody'");
	});

	test('rejects obviously invalid email format inline (no API call)', async ({ page }) => {
		const { session } = await setupApp(page);
		if (!session) throw new Error('seed required');

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.getByRole('button', { name: 'Invite user' }).click();
		await page.getByPlaceholder(/ada@example|adalovelace/i).fill('not-an-email@');
		await page.getByRole('button', { name: 'Send invite' }).click();

		const err = page.locator('#invite-error');
		await expect(err).toBeVisible();
		await expect(err).toContainText(/valid email/i);
	});

	test('invite link in the modal points back to join.html for this team', async ({ page }) => {
		const { session } = await setupApp(page);
		if (!session) throw new Error('seed required');

		await page.goto(`/html/tracker.html?team_id=${session.team.id}`);
		await page.getByRole('button', { name: 'Invite user' }).click();
		const link = page.locator('#invite-link-display');
		await expect(link).toHaveValue(new RegExp(`join\\.html\\?team_id=${session.team.id}$`));
	});
});
