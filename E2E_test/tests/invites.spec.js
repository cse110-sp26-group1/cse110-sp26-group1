// @ts-check
import { test, expect } from '@playwright/test';
import {
	createTeam,
	fetchInvites,
	inviteUser,
	makeUniqueTeamName,
	makeUniqueUser,
	registerUser,
	safeDeleteTeam,
	setBrowserSession,
} from '../helpers/api.js';

test.describe('Invites — teams page', () => {
	test("accepting an invite: row disappears, remaining invite stays, team appears in the user's team list", async ({ page }) => {
		const invitee = await registerUser(makeUniqueUser('accept_inv'));
		const adminA = await registerUser(makeUniqueUser('hearth_admin'));
		const adminB = await registerUser(makeUniqueUser('side_admin'));

		const hearth = await createTeam(adminA, { team_name: makeUniqueTeamName('Hearth OS') });
		const sideQuest = await createTeam(adminB, { team_name: makeUniqueTeamName('Side Quest') });

		const hearthInvite = await inviteUser(adminA, hearth.id, { email: invitee.credentials.email });
		await inviteUser(adminB, sideQuest.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');

			const section = page.locator('#invites-section');
			await expect(section).toBeVisible();
			// Both invites are present before accepting.
			await expect(section.locator('invite-row')).toHaveCount(2);
			const acceptedRow = page.locator(`#invites-section invite-row[invite-id="${hearthInvite.invite_id}"]`);
			await expect(acceptedRow).toBeVisible();
			await expect(page.locator(`team-card[name="${hearth.team_name}"]`)).toHaveCount(0);

			await acceptedRow.getByRole('button', { name: 'Accept' }).click();

			// Accepted row is gone; one invite (Side Quest) still present.
			await expect(acceptedRow).toHaveCount(0);
			await expect(section.locator('invite-row')).toHaveCount(1);
			// Newly-joined team renders in the team grid as a card the user can click.
			const newTeamCard = page.locator(`team-card[name="${hearth.team_name}"]`);
			await expect(newTeamCard).toHaveCount(1);
			await expect(newTeamCard).toBeVisible();
			await expect(page.locator('#toast')).toContainText('Invitation accepted');

			// Cross-check the real API state: only the side-quest invite should still be pending.
			const remaining = await fetchInvites(invitee);
			expect(remaining.length).toBe(1);
			expect(remaining[0].team_id).toBe(sideQuest.id);
		} finally {
			await safeDeleteTeam(adminA, hearth.id);
			await safeDeleteTeam(adminB, sideQuest.id);
		}
	});

	test('accepting the LAST invite hides the invitations section entirely', async ({ page }) => {
		const invitee = await registerUser(makeUniqueUser('last_invitee'));
		const admin = await registerUser(makeUniqueUser('last_admin'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Hearth Last') });
		const invite = await inviteUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');
			const section = page.locator('#invites-section');
			await expect(section).toBeVisible();
			await expect(section.locator('invite-row')).toHaveCount(1);

			await page.locator(`#invites-section invite-row[invite-id="${invite.invite_id}"]`).getByRole('button', { name: 'Accept' }).click();

			// Section hides when there are no remaining invites.
			await expect(section).toBeHidden();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('decline removes the invite row and surfaces a toast', async ({ page }) => {
		const invitee = await registerUser(makeUniqueUser('decline_user'));
		const admin = await registerUser(makeUniqueUser('decline_admin'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Decline Team') });
		const invite = await inviteUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');
			const row = page.locator(`#invites-section invite-row[invite-id="${invite.invite_id}"]`);
			await expect(row).toBeVisible();

			await row.getByRole('button', { name: 'Decline' }).click();
			await expect(row).toHaveCount(0);
			await expect(page.locator('#toast')).toContainText('Invitation declined.');

			// API cross-check: this user should now have no pending invites.
			const remaining = await fetchInvites(invitee);
			expect(remaining.find((i) => i.id === invite.invite_id)).toBeUndefined();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});
});

test.describe('Invites — tracker settings modal', () => {
	test('sends an invite to an existing user', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('tracker_inv_admin'));
		const target = await registerUser(makeUniqueUser('tracker_inv_target'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Invite Modal') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await expect(page.locator('#settings-edit-btn')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Send invite' })).toBeVisible();
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill(target.credentials.username);
			await page.getByRole('button', { name: 'Send invite' }).click();

			await expect(page.locator('#toast')).toContainText(`Invitation sent to ${target.credentials.username}`);

			// Cross-check via API that the target now has a pending invite for this team.
			const invites = await fetchInvites(target);
			expect(invites.find((i) => i.team_id === team.id)).toBeDefined();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('shows an inline error when the user does not exist (404)', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('inv_404_admin'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('404 Team') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);

			const ghost = `nobody_e2e_${Date.now().toString(36)}`;
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill(ghost);
			await page.getByRole('button', { name: 'Send invite' }).click();

			const err = page.locator('#invite-error');
			await expect(err).toBeVisible();
			await expect(err).toContainText(`No user found for '${ghost}'`);
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('rejects obviously invalid email format inline (no API call)', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('inv_email_admin'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Email Team') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill('not-an-email@');
			await page.getByRole('button', { name: 'Send invite' }).click();

			const err = page.locator('#invite-error');
			await expect(err).toBeVisible();
			await expect(err).toContainText(/valid email/i);
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('keeps the modal open and does not create a second pending invite for a duplicate invite', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('inv_dup_admin'));
		const target = await registerUser(makeUniqueUser('inv_dup_target'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Duplicate Invite') });
		await inviteUser(admin, team.id, { email: target.credentials.email });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await page.getByPlaceholder(/ada@example|adalovelace/i).fill(target.credentials.username);
			await page.getByRole('button', { name: 'Send invite' }).click();

			const err = page.locator('#invite-error');
			await expect(err).toBeVisible();
			await expect(err).toContainText('already has a pending invite');
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await expect(page.locator('#delete-team-backdrop')).not.toHaveClass(/open/);
			await expect(page.getByPlaceholder(/ada@example|adalovelace/i)).toHaveValue(target.credentials.username);

			const pending = (await fetchInvites(target)).filter((invite) => invite.team_id === team.id);
			expect(pending).toHaveLength(1);
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});
});
