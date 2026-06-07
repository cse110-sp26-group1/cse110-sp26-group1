// @ts-check
// Real-backend version of teams.spec.js.
import { test, expect } from '@playwright/test';
import {
	acceptRealInvite,
	createRealTeam,
	fetchRealTeamMembers,
	fetchRealTeams,
	inviteRealUser,
	makeUniqueTeamName,
	makeUniqueUser,
	registerRealUser,
	safeDeleteRealTeam,
	setBrowserSession,
} from '../helpers/real-api.js';

test.describe('Teams dashboard (real backend)', () => {
	test('renders team cards from the API with names and roles', async ({ page }) => {
		// One owner with two teams: admin of A, member of B (via accepted invite from a second user).
		const owner = await registerRealUser(makeUniqueUser('owner'));
		const adminTeam = await createRealTeam(owner, { team_name: makeUniqueTeamName('Studio AI') });

		const memberAdmin = await registerRealUser(makeUniqueUser('member_admin'));
		const memberTeam = await createRealTeam(memberAdmin, { team_name: makeUniqueTeamName('Capstone') });
		const invite = await inviteRealUser(memberAdmin, memberTeam.id, { email: owner.credentials.email });

		// Accept the invite as `owner` so the team renders as a member-role card.
		await acceptRealInvite(owner, invite.invite_id);

		await setBrowserSession(page, owner);

		try {
			await page.goto('/html/teams.html');

			await expect(page.getByRole('heading', { name: adminTeam.team_name })).toBeVisible();
			await expect(page.getByRole('heading', { name: memberTeam.team_name })).toBeVisible();

			const cards = page.locator('team-card');
			await expect(cards.filter({ hasText: adminTeam.team_name })).toContainText('Workspace Admin');
			await expect(cards.filter({ hasText: memberTeam.team_name })).toContainText('Workspace Member');
		} finally {
			await safeDeleteRealTeam(owner, adminTeam.id);
			await safeDeleteRealTeam(memberAdmin, memberTeam.id);
		}
	});

	test('clicking a team card navigates to that team in the tracker', async ({ page }) => {
		const owner = await registerRealUser(makeUniqueUser('teamnav'));
		const team = await createRealTeam(owner, { team_name: makeUniqueTeamName('Nav Team') });
		await setBrowserSession(page, owner);

		try {
			await page.goto('/html/teams.html');
			const link = page.locator('team-card a.team').first();
			await expect(link).toHaveAttribute('href', `tracker.html?team_id=${team.id}`);
			await link.click();
			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));
		} finally {
			await safeDeleteRealTeam(owner, team.id);
		}
	});

	test('member leaves a team from the tracker menu and loses backend membership', async ({ page }) => {
		const admin = await registerRealUser(makeUniqueUser('leave_admin'));
		const member = await registerRealUser(makeUniqueUser('leave_member'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Leave Flow') });
		const invite = await inviteRealUser(admin, team.id, { email: member.credentials.email });
		await acceptRealInvite(member, invite.invite_id);
		await setBrowserSession(page, member);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			page.once('dialog', (dialog) => dialog.accept());
			await page.locator('#team-switch').click();
			const [leaveResponse] = await Promise.all([
				page.waitForResponse((res) => res.url().endsWith(`/teams/${team.id}/leave`) && res.request().method() === 'DELETE'),
				page.locator('#team-menu [data-action="leave-team"]').click(),
			]);
			expect(leaveResponse.status()).toBe(200);

			await expect(page).toHaveURL(/teams\.html/);
			await expect(page.locator('team-card').filter({ hasText: team.team_name })).toHaveCount(0);

			const memberTeams = await fetchRealTeams(member);
			expect(memberTeams.find((row) => row.id === team.id)).toBeUndefined();

			const members = await fetchRealTeamMembers(admin, team.id);
			expect(members.find((row) => row.email === member.credentials.email)).toBeUndefined();
			expect(members.find((row) => row.email === admin.credentials.email)).toBeDefined();
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('admin cannot leave a team that still has members', async ({ page }) => {
		const admin = await registerRealUser(makeUniqueUser('blocked_admin'));
		const member = await registerRealUser(makeUniqueUser('blocked_member'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Blocked Leave') });
		const invite = await inviteRealUser(admin, team.id, { email: member.credentials.email });
		await acceptRealInvite(member, invite.invite_id);
		await setBrowserSession(page, admin);

		try {
			await page.goto(`/html/tracker.html?team_id=${team.id}`);
			await expect(page.locator('#team-label')).toHaveText(team.team_name);

			page.once('dialog', (dialog) => dialog.accept());
			await page.locator('#team-switch').click();
			const [leaveResponse] = await Promise.all([
				page.waitForResponse((res) => res.url().endsWith(`/teams/${team.id}/leave`) && res.request().method() === 'DELETE'),
				page.locator('#team-menu [data-action="leave-team"]').click(),
			]);
			expect(leaveResponse.status()).toBe(409);

			await expect(page).toHaveURL(new RegExp(`tracker\\.html\\?team_id=${team.id}`));
			await expect(page.locator('#toast')).toContainText('Admins cannot leave');

			const adminTeams = await fetchRealTeams(admin);
			expect(adminTeams.find((row) => row.id === team.id)).toBeDefined();

			const members = await fetchRealTeamMembers(admin, team.id);
			expect(members.find((row) => row.email === admin.credentials.email)).toBeDefined();
			expect(members.find((row) => row.email === member.credentials.email)).toBeDefined();
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});

	test('create-team modal validates the name and creates a new team', async ({ page }) => {
		const owner = await registerRealUser(makeUniqueUser('create_team'));
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
			if (createdTeamId) await safeDeleteRealTeam(owner, createdTeamId);
		}
	});

	test('shows pending invitations for each inviting team', async ({ page }) => {
		// The hero "Pending invites" button was removed from teams.html (commit c16d5fe),
		// so the visible count today is the number of .invite rows inside #invites-section.
		const invitee = await registerRealUser(makeUniqueUser('badge_invitee'));
		const admin1 = await registerRealUser(makeUniqueUser('badge_admin1'));
		const admin2 = await registerRealUser(makeUniqueUser('badge_admin2'));
		const team1 = await createRealTeam(admin1, { team_name: makeUniqueTeamName('Hearth') });
		const team2 = await createRealTeam(admin2, { team_name: makeUniqueTeamName('SideQuest') });

		await inviteRealUser(admin1, team1.id, { email: invitee.credentials.email });
		await inviteRealUser(admin2, team2.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');
			const section = page.locator('#invites-section');
			await expect(section).toBeVisible();
			await expect(section.locator('.invite')).toHaveCount(2);
			await expect(section).toContainText(team1.team_name);
			await expect(section).toContainText(team2.team_name);
		} finally {
			await safeDeleteRealTeam(admin1, team1.id);
			await safeDeleteRealTeam(admin2, team2.id);
		}
	});

	test('shows the pending-invitations section listing all invites by team', async ({ page }) => {
		const invitee = await registerRealUser(makeUniqueUser('inv_section'));
		const admin = await registerRealUser(makeUniqueUser('inv_section_admin'));
		const team = await createRealTeam(admin, { team_name: makeUniqueTeamName('Hearth Section') });

		await inviteRealUser(admin, team.id, { email: invitee.credentials.email });

		await setBrowserSession(page, invitee);

		try {
			await page.goto('/html/teams.html');
			const invitesSection = page.locator('#invites-section');
			await expect(invitesSection).toBeVisible();
			await expect(invitesSection).toContainText(team.team_name);
			await expect(invitesSection).toContainText(admin.credentials.username);
		} finally {
			await safeDeleteRealTeam(admin, team.id);
		}
	});
});
