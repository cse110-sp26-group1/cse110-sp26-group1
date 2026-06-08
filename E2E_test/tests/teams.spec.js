// @ts-check
import { test, expect } from '@playwright/test';
import {
	acceptInvite,
	createTeam,
	fetchTeamMembers,
	fetchTeams,
	inviteUser,
	makeUniqueTeamName,
	makeUniqueUser,
	registerUser,
	safeDeleteTeam,
	setBrowserSession,
} from '../helpers/api.js';

test.describe('Teams dashboard', () => {
	test('renders team cards from the API with names and roles', async ({ page }) => {
		// One owner with two teams: admin of A, member of B (via accepted invite from a second user).
		const owner = await registerUser(makeUniqueUser('owner'));
		const adminTeam = await createTeam(owner, { team_name: makeUniqueTeamName('Studio AI') });

		const memberAdmin = await registerUser(makeUniqueUser('member_admin'));
		const memberTeam = await createTeam(memberAdmin, { team_name: makeUniqueTeamName('Capstone') });
		const invite = await inviteUser(memberAdmin, memberTeam.id, { email: owner.credentials.email });

		// Accept the invite as `owner` so the team renders as a member-role card.
		await acceptInvite(owner, invite.invite_id);

		await setBrowserSession(page, owner);

		try {
			await page.goto('/html/teams.html');

			await expect(page.getByRole('heading', { name: adminTeam.team_name })).toBeVisible();
			await expect(page.getByRole('heading', { name: memberTeam.team_name })).toBeVisible();

			const cards = page.locator('team-card');
			await expect(cards.filter({ hasText: adminTeam.team_name })).toContainText('Workspace Admin');
			await expect(cards.filter({ hasText: memberTeam.team_name })).toContainText('Workspace Member');
		} finally {
			await safeDeleteTeam(owner, adminTeam.id);
			await safeDeleteTeam(memberAdmin, memberTeam.id);
		}
	});

	test('clicking a team card navigates to that team in the tracker', async ({ page }) => {
		const owner = await registerUser(makeUniqueUser('teamnav'));
		const team = await createTeam(owner, { team_name: makeUniqueTeamName('Nav Team') });
		await setBrowserSession(page, owner);

		try {
			await page.goto('/html/teams.html');
			const link = page.locator('team-card').filter({ hasText: team.team_name }).locator('a.team');
			await expect(link).toHaveAttribute('href', `tracker.html?team_id=${team.id}`);
			await link.click();
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));
		} finally {
			await safeDeleteTeam(owner, team.id);
		}
	});

	test('create-team modal validates the name and creates a new team', async ({ page }) => {
		const owner = await registerUser(makeUniqueUser('create_team'));
		await setBrowserSession(page, owner);

		const teamName = makeUniqueTeamName('Rocket Squad');
		let createdTeamId = null;

		try {
			await page.goto('/html/teams.html');
			await page.getByRole('button', { name: '+ New team' }).click();
			const modal = page.locator('#create-backdrop');
			await expect(modal).toHaveClass(/open/);

			// Empty submit keeps the modal open. Cross-check: cards count unchanged.
			const teamCards = page.locator('team-card');
			const cardCountBefore = await teamCards.count();
			await page.getByRole('button', { name: 'Create team' }).click();
			await expect(page).toHaveURL(/teams\.html/);
			await expect(modal).toHaveClass(/open/);
			await expect(teamCards).toHaveCount(cardCountBefore);

			// Real submit — watch the outgoing POST so we know the UI sent the right payload.
			await page.getByPlaceholder('e.g. Roost Robotics').fill(teamName);
			const [createReq, createRes] = await Promise.all([
				page.waitForRequest((req) => req.url().endsWith('/teams') && req.method() === 'POST'),
				page.waitForResponse((res) => res.url().endsWith('/teams') && res.request().method() === 'POST'),
				page.getByRole('button', { name: 'Create team' }).click(),
			]);
			expect(createReq.postDataJSON()).toMatchObject({ team_name: teamName });
			const body = await createRes.json();
			createdTeamId = Number(body.team_id);
			expect(createdTeamId).toBeGreaterThan(0);

			await expect(page.locator('#toast')).toContainText('Workspace created');
			await expect(page).toHaveURL(/tracker\.html\?team_id=\d+/, { timeout: 6000 });
		} finally {
			if (createdTeamId) await safeDeleteTeam(owner, createdTeamId);
		}
	});

	test('shows pending invitations for each inviting team', async ({ page }) => {
		const invitee = await registerUser(makeUniqueUser('pending_invitee'));
		const admin1 = await registerUser(makeUniqueUser('pending_admin1'));
		const admin2 = await registerUser(makeUniqueUser('pending_admin2'));
		const team1 = await createTeam(admin1, { team_name: makeUniqueTeamName('Hearth') });
		const team2 = await createTeam(admin2, { team_name: makeUniqueTeamName('SideQuest') });

		await inviteUser(admin1, team1.id, { email: invitee.credentials.email });
		await inviteUser(admin2, team2.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');
			const section = page.locator('#invites-section');
			await expect(section).toBeVisible();
			await expect(section.locator('invite-row')).toHaveCount(2);
			await expect(section).toContainText(team1.team_name);
			await expect(section).toContainText(team2.team_name);
		} finally {
			await safeDeleteTeam(admin1, team1.id);
			await safeDeleteTeam(admin2, team2.id);
		}
	});
});

test.describe('Teams — tracker settings modal', () => {
	test('member leaves a team from settings and loses backend membership', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('leave_admin'));
		const member = await registerUser(makeUniqueUser('leave_member'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Leave Flow') });
		const invite = await inviteUser(admin, team.id, { email: member.credentials.email });
		await acceptInvite(member, invite.invite_id);
		await setBrowserSession(page, member);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await expect(page.locator('#settings-edit-btn')).toHaveAttribute('hidden', '');
			await expect(page.getByRole('button', { name: 'Send invite' })).toHaveCount(0);
			await expect(page.locator('#settings-delete-team')).toHaveCount(0);
			await expect(page.locator('#settings-leave-team')).toBeVisible();

			const [leaveResponse] = await Promise.all([
				page.waitForResponse((res) => res.url().endsWith(`/teams/${team.id}/leave`) && res.request().method() === 'DELETE'),
				page.locator('#settings-leave-team').click(),
			]);
			expect(leaveResponse.status()).toBe(200);

			await expect(page).toHaveURL(/teams\.html/);
			await expect(page.locator('team-card').filter({ hasText: team.team_name })).toHaveCount(0);

			const memberTeams = await fetchTeams(member);
			expect(memberTeams.find((row) => row.id === team.id)).toBeUndefined();

			const members = await fetchTeamMembers(admin, team.id);
			expect(members.find((row) => row.email === member.credentials.email)).toBeUndefined();
			expect(members.find((row) => row.email === admin.credentials.email)).toBeDefined();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('admin cannot leave a team that still has members from settings', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('blocked_admin'));
		const member = await registerUser(makeUniqueUser('blocked_member'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Blocked Leave') });
		const invite = await inviteUser(admin, team.id, { email: member.credentials.email });
		await acceptInvite(member, invite.invite_id);
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await expect(page.locator('#settings-edit-btn')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Send invite' })).toBeVisible();
			await expect(page.locator('#settings-delete-team')).toBeVisible();

			const [leaveResponse] = await Promise.all([
				page.waitForResponse((res) => res.url().endsWith(`/teams/${team.id}/leave`) && res.request().method() === 'DELETE'),
				page.locator('#settings-leave-team').click(),
			]);
			expect(leaveResponse.status()).toBe(409);

			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await expect(page.locator('#toast')).toContainText('Admins cannot leave');

			const adminTeams = await fetchTeams(admin);
			expect(adminTeams.find((row) => row.id === team.id)).toBeDefined();

			const members = await fetchTeamMembers(admin, team.id);
			expect(members.find((row) => row.email === admin.credentials.email)).toBeDefined();
			expect(members.find((row) => row.email === member.credentials.email)).toBeDefined();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('admin deletes a team from settings after entering via the teams page', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('delete_admin'));
		const member = await registerUser(makeUniqueUser('delete_member'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Delete Flow') });
		const invite = await inviteUser(admin, team.id, { email: member.credentials.email });
		await acceptInvite(member, invite.invite_id);
		await setBrowserSession(page, admin);

		try {
			await page.goto('/html/teams.html');
			await page.locator('team-card').filter({ hasText: team.team_name }).locator('a.team').click();
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await expect(page.locator('#settings-delete-team')).toBeVisible();

			await page.locator('#settings-delete-team').click();
			await expect(page.locator('#delete-team-backdrop')).toHaveClass(/open/);

			const [deleteResponse] = await Promise.all([
				page.waitForResponse((res) => res.url().endsWith(`/teams/${team.id}`) && res.request().method() === 'DELETE'),
				page.locator('#confirm-delete-team').click(),
			]);
			expect(deleteResponse.status()).toBe(200);

			await expect(page.locator('#toast')).toContainText('Team deleted');
			await expect(page).toHaveURL(/teams\.html/, { timeout: 6000 });
			await expect(page.locator('team-card').filter({ hasText: team.team_name })).toHaveCount(0);

			const adminTeams = await fetchTeams(admin);
			expect(adminTeams.find((row) => row.id === team.id)).toBeUndefined();

			const memberTeams = await fetchTeams(member);
			expect(memberTeams.find((row) => row.id === team.id)).toBeUndefined();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('admin can cancel delete-team confirmation and remains on the tracker', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('cancel_delete_admin'));
		const member = await registerUser(makeUniqueUser('cancel_delete_member'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Cancel Delete') });
		const invite = await inviteUser(admin, team.id, { email: member.credentials.email });
		await acceptInvite(member, invite.invite_id);
		await setBrowserSession(page, admin);

		try {
			await page.goto('/html/teams.html');
			await page.locator('team-card').filter({ hasText: team.team_name }).locator('a.team').click();
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await page.locator('#settings-delete-team').click();
			await expect(page.locator('#delete-team-backdrop')).toHaveClass(/open/);

			await page.locator('#cancel-delete-team').click();
			await expect(page.locator('#delete-team-backdrop')).not.toHaveClass(/open/);
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));

			const adminTeams = await fetchTeams(admin);
			expect(adminTeams.find((row) => row.id === team.id)).toBeDefined();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('admin edits team name and bio from settings', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('edit_profile_admin'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Edit Profile') });
		const newName = makeUniqueTeamName('Renamed');
		const newBio = 'Updated bio for E2E test.';
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);
			await page.locator('#settings-edit-btn').click();
			await page.locator('#settings-team-name').fill(newName);
			await page.locator('#settings-team-bio').fill(newBio);
			await page.locator('#settings-save-edit').click();

			await expect(page.locator('#toast')).toContainText('Team updated');
			await expect(page.locator('#team-label')).toHaveText(newName);
			await expect(page.locator('.settings-name')).toHaveText(newName);

			const teams = await fetchTeams(admin);
			const updated = teams.find((row) => row.id === team.id);
			expect(updated).toBeDefined();
			expect(updated.team_name).toBe(newName);
			expect(updated.bio).toBe(newBio);
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('cancel edit discards unsaved profile changes', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('cancel_edit_admin'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Cancel Edit') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			await page.getByRole('button', { name: 'Settings' }).click();
			await page.locator('#settings-edit-btn').click();
			await page.locator('#settings-team-name').fill(makeUniqueTeamName('Unsaved'));
			await page.locator('#settings-cancel-edit').click();

			await expect(page.locator('.settings-name')).toHaveText(team.team_name);
			await expect(page.locator('#team-label')).toHaveText(team.team_name);
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('save blocked when team name is cleared in settings edit mode', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('empty_name_admin'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Empty Name') });
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Settings' }).click();
			await page.locator('#settings-edit-btn').click();
			await page.locator('#settings-team-name').fill('');
			await page.locator('#settings-save-edit').click();

			await expect(page.locator('#toast')).toContainText('Team name is required');
			await expect(page.locator('#settings-team-name')).toBeVisible();

			const teams = await fetchTeams(admin);
			expect(teams.find((row) => row.id === team.id)?.team_name).toBe(team.team_name);
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('admin removes a member from settings', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('remove_member_admin'));
		const member = await registerUser(makeUniqueUser('remove_member_user'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Remove Member') });
		const invite = await inviteUser(admin, team.id, { email: member.credentials.email });
		await acceptInvite(member, invite.invite_id);

		const memberRow = (await fetchTeamMembers(admin, team.id)).find((row) => row.email === member.credentials.email);
		if (!memberRow) throw new Error('Expected invited user to appear in team members before removal.');

		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);

			await page.locator(`.remove-member-btn[data-user-id="${memberRow.id}"]`).click();
			await expect(page.locator('#toast')).toContainText('Member removed');
			await expect(page.locator('.settings-members')).not.toContainText(member.credentials.username);

			const members = await fetchTeamMembers(admin, team.id);
			expect(members.find((row) => row.email === member.credentials.email)).toBeUndefined();
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});

	test('admin promotes a member to admin via settings role select', async ({ page }) => {
		const admin = await registerUser(makeUniqueUser('role_change_admin'));
		const member = await registerUser(makeUniqueUser('role_change_member'));
		const team = await createTeam(admin, { team_name: makeUniqueTeamName('Role Change') });
		const invite = await inviteUser(admin, team.id, { email: member.credentials.email });
		await acceptInvite(member, invite.invite_id);

		const memberRow = (await fetchTeamMembers(admin, team.id)).find((row) => row.email === member.credentials.email);
		if (!memberRow) throw new Error('Expected invited user to appear in team members before role change.');

		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await page.getByRole('button', { name: 'Settings' }).click();
			await expect(page.locator('#settings-backdrop')).toHaveClass(/open/);

			await page.locator(`.member-role-select[data-user-id="${memberRow.id}"]`).selectOption('admin');
			await expect(page.locator('#toast')).toContainText('Role updated');

			const members = await fetchTeamMembers(admin, team.id);
			expect(members.find((row) => row.email === member.credentials.email)?.role).toBe('admin');
		} finally {
			await safeDeleteTeam(admin, team.id);
		}
	});
});

test.describe('Teams — tracker team switcher', () => {
	test('switching teams from the tracker menu after entering via the teams page', async ({ page }) => {
		const owner = await registerUser(makeUniqueUser('switch_owner'));
		const teamA = await createTeam(owner, { team_name: makeUniqueTeamName('Switch Alpha') });
		const teamB = await createTeam(owner, { team_name: makeUniqueTeamName('Switch Beta') });
		await setBrowserSession(page, owner);

		try {
			await page.goto('/html/teams.html');
			await page.locator('team-card').filter({ hasText: teamA.team_name }).locator('a.team').click();
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${teamA.id}`));
			await expect(page.locator('#team-label')).toHaveText(teamA.team_name);

			await page.locator('#team-switch').click();
			const menu = page.locator('#team-menu');
			await expect(menu).toHaveClass(/open/);
			await expect(menu.locator(`.item[data-id="${teamA.id}"]`)).toHaveClass(/active/);
			await expect(menu.locator(`.item[data-id="${teamB.id}"]`)).not.toHaveClass(/active/);
			await expect(menu).toContainText(teamA.team_name);
			await expect(menu).toContainText(teamB.team_name);

			await menu.locator(`.item[data-id="${teamB.id}"]`).click();
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${teamB.id}`));
			await expect(page.locator('#team-label')).toHaveText(teamB.team_name);

			await page.locator('#team-switch').click();
			await expect(menu).toHaveClass(/open/);
			await expect(menu.locator(`.item[data-id="${teamB.id}"]`)).toHaveClass(/active/);
			await expect(menu.locator(`.item[data-id="${teamA.id}"]`)).not.toHaveClass(/active/);
		} finally {
			await safeDeleteTeam(owner, teamA.id);
			await safeDeleteTeam(owner, teamB.id);
		}
	});

	test('team menu "All teams" navigates back to the teams page after entering via a team card', async ({ page }) => {
		const owner = await registerUser(makeUniqueUser('all_teams_nav'));
		const team = await createTeam(owner, { team_name: makeUniqueTeamName('All Teams Nav') });
		await setBrowserSession(page, owner);

		try {
			await page.goto('/html/teams.html');
			await page.locator('team-card').filter({ hasText: team.team_name }).locator('a.team').click();
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			await page.locator('#team-switch').click();
			await expect(page.locator('#team-menu')).toHaveClass(/open/);
			await page.locator('#team-menu .item[data-action="all-teams"]').click();
			await expect(page).toHaveURL(/teams\.html$/);
			await expect(page.getByRole('heading', { name: team.team_name })).toBeVisible();
		} finally {
			await safeDeleteTeam(owner, team.id);
		}
	});
});
