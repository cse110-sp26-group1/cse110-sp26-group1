// @ts-check
// Real-backend version of invites.spec.js.
import { test, expect } from '@playwright/test';
import {
	configureRealApiPage,
	createRealTeam,
	fetchRealInvites,
	inviteRealUser,
	makeUniqueTeamName,
	makeUniqueUser,
	registerRealUser,
	safeDeleteRealTeam,
	setBrowserSession,
	storeBrowserSession,
} from '../helpers/real-api.js';

test.describe('Invites — teams page (real backend)', () => {
	test("accepting an invite: row disappears, remaining invite stays, team appears in the user's team list", async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('accept_inv'));
		const adminA = await registerRealUser(makeUniqueUser('hearth_admin'));
		const adminB = await registerRealUser(makeUniqueUser('side_admin'));

		const hearth = await createRealTeam(adminA, { team_name: makeUniqueTeamName('Hearth OS') });
		const sideQuest = await createRealTeam(adminB, { team_name: makeUniqueTeamName('Side Quest') });

		const hearthInvite = await inviteRealUser(adminA, hearth.id, { email: invitee.credentials.email });
		await inviteRealUser(adminB, sideQuest.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');

			const section = page.locator('#invites-section');
			await expect(section).toBeVisible();
			// Both invites are present before accepting.
			await expect(section.locator('.invite')).toHaveCount(2);
			const acceptedRow = page.locator(`#invites-section .invite[data-invite-id="${hearthInvite.invite_id}"]`);
			await expect(acceptedRow).toBeVisible();
			await expect(page.locator(`team-card[name="${hearth.team_name}"]`)).toHaveCount(0);

			await acceptedRow.getByRole('button', { name: 'Accept' }).click();

			// Accepted row is gone; one invite (Side Quest) still present.
			await expect(acceptedRow).toHaveCount(0);
			await expect(section.locator('.invite')).toHaveCount(1);
			// Newly-joined team renders in the team grid as a card the user can click.
			const newTeamCard = page.locator(`team-card[name="${hearth.team_name}"]`);
			await expect(newTeamCard).toHaveCount(1);
			await expect(newTeamCard).toBeVisible();
			await expect(page.locator('#toast')).toContainText('Invitation accepted');

			// Cross-check the real API state: only the side-quest invite should still be pending.
			const remaining = await fetchRealInvites(invitee);
			expect(remaining.length).toBe(1);
			expect(remaining[0].team_id).toBe(sideQuest.id);
		} finally {
			await safeDeleteRealTeam(adminA, hearth.id);
			await safeDeleteRealTeam(adminB, sideQuest.id);
		}
	});

	test('accepting the LAST invite hides the invitations section entirely', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('last_invitee'));
		const admin = await registerRealUser(makeUniqueUser('last_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Hearth Last') });
		const invite = await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');
			const section = page.locator('#invites-section');
			await expect(section).toBeVisible();
			await expect(section.locator('.invite')).toHaveCount(1);

			await page.locator(`#invites-section .invite[data-invite-id="${invite.invite_id}"]`).getByRole('button', { name: 'Accept' }).click();

			// Section hides when there are no remaining invites.
			await expect(section).toBeHidden();
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('decline removes the invite row and surfaces a toast', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('decline_user'));
		const admin = await registerRealUser(makeUniqueUser('decline_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Decline Team') });
		const invite = await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');
			const row = page.locator(`#invites-section .invite[data-invite-id="${invite.invite_id}"]`);
			await expect(row).toBeVisible();

			await row.getByRole('button', { name: 'Decline' }).click();
			await expect(row).toHaveCount(0);
			await expect(page.locator('#toast')).toContainText('Invitation declined.');

			// Real-API cross-check: this user should now have no pending invites.
			const remaining = await fetchRealInvites(invitee);
			expect(remaining.find((i) => i.id === invite.invite_id)).toBeUndefined();
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});
});

test.describe('Invites — join.html (real backend)', () => {
	test('shows the empty state when there are no pending invites', async ({ page }) => {
		const user = await registerRealUser(makeUniqueUser('join_empty'));
		await setBrowserSession(page, user);

		await page.goto('/html/join.html');
		await expect(page.locator('#join-empty')).toBeVisible();
		await expect(page.locator('#join-empty')).toContainText('no pending invitations');
	});

	test('lists pending invites in the code-entry view', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('join_list_invitee'));
		const admin = await registerRealUser(makeUniqueUser('join_list_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Side Quest List') });
		await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/join.html');
			const list = page.locator('#invite-list');
			await expect(list).toBeVisible();
			await expect(list).toContainText(team.team_name);
			await expect(list).toContainText(admin.credentials.username);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('preview view renders for ?team_id matching a pending invite', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('join_prev_invitee'));
		const admin = await registerRealUser(makeUniqueUser('join_prev_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Roost Robotics') });
		await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto(`/html/join.html?team_id=${team.id}`);
			await expect(page.locator('#join-preview-view')).toBeVisible();
			await expect(page.locator('#preview-name')).toHaveText(team.team_name);
			await expect(page.locator('#preview-meta')).toContainText(admin.credentials.username);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('preview view shows invalid-code message when no invite matches ?team_id', async ({ page }) => {
		const user = await registerRealUser(makeUniqueUser('join_invalid'));
		await setBrowserSession(page, user);

		// Use a clearly non-existent team_id. The frontend doesn't try to fetch
		// the team — it only checks the pending-invites list — so any id works.
		await page.goto('/html/join.html?team_id=999999999');
		await expect(page.locator('#join-invalid')).toBeVisible();
		await expect(page.locator('#join-invalid')).toContainText(/invalid|expired/i);
	});

	test('preview "Join workspace" button accepts the invite and redirects to tracker', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('join_accept_invitee'));
		const admin = await registerRealUser(makeUniqueUser('join_accept_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Roost Accept') });
		const invite = await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto(`/html/join.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Join workspace' }).click();

			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`), { timeout: 6000 });

			const remaining = await fetchRealInvites(invitee);
			expect(remaining.find((i) => i.id === invite.invite_id)).toBeUndefined();
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('code-entry form rejects empty input with an inline error', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('code_empty_invitee'));
		const admin = await registerRealUser(makeUniqueUser('code_empty_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Hearth Empty') });
		await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/join.html');
			await page.getByRole('button', { name: 'Look up' }).click();
			await expect(page.locator('#code-error')).toBeVisible();
			await expect(page.locator('#code-error')).toContainText('Enter an invite code');
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('code-entry form rejects garbage input with an inline error', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('code_garbage_invitee'));
		const admin = await registerRealUser(makeUniqueUser('code_garbage_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Hearth Garbage') });
		await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/join.html');
			await page.locator('#code-input').fill('not-a-code');
			await page.getByRole('button', { name: 'Look up' }).click();
			await expect(page.locator('#code-error')).toBeVisible();
			await expect(page.locator('#code-error')).toContainText("doesn't look like a valid invite code");
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});
});

test.describe('Invites — tracker invite modal (real backend)', () => {
	test('sends an invite to an existing user', async ({ page }) => {
		const admin = await registerRealUser(makeUniqueUser('tracker_inv_admin'));
		const target = await registerRealUser(makeUniqueUser('tracker_inv_target'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Invite Modal') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Invite user' }).click();
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill(target.credentials.username);
			await page.getByRole('button', { name: 'Send invite' }).click();

			await expect(page.locator('#toast')).toContainText(`Invitation sent to ${target.credentials.username}`);

			// Cross-check via API that the target now has a pending invite for this team.
			const invites = await fetchRealInvites(target);
			expect(invites.find((i) => i.team_id === team.id)).toBeDefined();
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('shows an inline error when the user does not exist (404)', async ({ page }) => {
		const admin = await registerRealUser(makeUniqueUser('inv_404_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('404 Team') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Invite user' }).click();

			const ghost = `nobody_e2e_${Date.now().toString(36)}`;
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill(ghost);
			await page.getByRole('button', { name: 'Send invite' }).click();

			const err = page.locator('#invite-error');
			await expect(err).toBeVisible();
			await expect(err).toContainText(`No user found for '${ghost}'`);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('rejects obviously invalid email format inline (no API call)', async ({ page }) => {
		const admin = await registerRealUser(makeUniqueUser('inv_email_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Email Team') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Invite user' }).click();
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill('not-an-email@');
			await page.getByRole('button', { name: 'Send invite' }).click();

			const err = page.locator('#invite-error');
			await expect(err).toBeVisible();
			await expect(err).toContainText(/valid email/i);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('keeps the modal open and does not create a second pending invite for a duplicate invite', async ({ page }) => {
		const admin = await registerRealUser(makeUniqueUser('inv_dup_admin'));
		const target = await registerRealUser(makeUniqueUser('inv_dup_target'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Duplicate Invite') });
		await inviteRealUser(admin, team.id, { email: target.credentials.email });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Invite user' }).click();
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill(target.credentials.username);
			await page.getByRole('button', { name: 'Send invite' }).click();

			const err = page.locator('#invite-error');
			await expect(err).toBeVisible();
			await expect(err).toContainText('already has a pending invite');
			await expect(page.locator('#invite-backdrop')).toHaveClass(/open/);
			await expect(page.getByPlaceholder(/ada@example|adalovelace/i)).toHaveValue(target.credentials.username);

			const pending = (await fetchRealInvites(target)).filter((invite) => invite.team_id === team.id);
			expect(pending).toHaveLength(1);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	// The invite-link copy field (#invite-link-display) was removed from
	// tracker.html, so there is no user-visible invite-link element to assert on.
});

test.describe('Invites — full admin → invitee flow (real backend)', () => {
	test('admin sends an invite through the UI and invitee accepts from teams.html', async ({ page }) => {
		const admin = await registerRealUser(makeUniqueUser('flow_admin'));
		const invitee = await registerRealUser(makeUniqueUser('flow_invitee'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('E2E Flow') });

		try {
			// Use configureRealApiPage + storeBrowserSession (not setBrowserSession)
			// so we can switch sessions mid-test. setBrowserSession's init script
			// would otherwise reinstate the admin's token on every navigation and
			// stomp on storeBrowserSession's invitee write.
			await configureRealApiPage(page);
			await page.goto('/html/login.html');
			await storeBrowserSession(page, admin);
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await expect(page.locator('#team-label')).toHaveText(team.team_name, { timeout: 10_000 });
			await page.locator('#open-invite-modal').click();
			await expect(page.locator('#invite-backdrop')).toHaveClass(/open/);
			await page.locator('#invite-input').fill(invitee.credentials.email);
			await page.getByRole('button', { name: 'Send invite' }).click();
			await expect(page.locator('#toast')).toContainText('Invitation sent', { timeout: 10_000 });
			await expect.poll(async () => (await fetchRealInvites(invitee)).length).toBe(1);

			await storeBrowserSession(page, invitee);
			await page.goto('/html/teams.html');

			const invitesSection = page.locator('#invites-section');
			await expect(invitesSection).toBeVisible({ timeout: 10_000 });
			await expect(invitesSection).toContainText(team.team_name);

			await invitesSection.getByRole('button', { name: 'Accept' }).click();
			await expect(page.locator('#toast')).toContainText('Invitation accepted', { timeout: 10_000 });
			await expect(page.locator('team-card').filter({ hasText: team.team_name })).toHaveCount(1);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});
});
