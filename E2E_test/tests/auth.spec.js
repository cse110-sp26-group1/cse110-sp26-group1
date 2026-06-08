// @ts-check
// Talks to the live Worker via E2E_test/helpers/api.js. Run with `npm run test:e2e`.
import { test, expect } from '@playwright/test';
import { configureApiPage, makeUniqueUser, registerUser, setBrowserSession } from '../helpers/api.js';

test.describe('Auth — login page', () => {
	test('redirects to teams when already signed in', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('login_redirect'));
		await setBrowserSession(page, session);

		await page.goto('/html/login.html');
		await expect(page).toHaveURL(/teams\.html$/);
	});

	test('shows the welcome heading when signed out', async ({ page }) => {
		await configureApiPage(page);

		await page.goto('/html/login.html');
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
	});

	test('rejects invalid credentials and stays on login.html', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('bad_login'));
		await configureApiPage(page);

		await page.goto('/html/login.html');
		await page.getByLabel('Email').fill(session.credentials.email);
		await page.getByRole('textbox', { name: 'Password' }).fill('definitely-not-the-password');
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect(page).toHaveURL(/login\.html/);
		// login.js surfaces the 401 in the #auth-error banner (not via setCustomValidity).
		await expect(page.locator('#auth-error')).toBeVisible();
		await expect(page.locator('#auth-error')).toContainText(/invalid email or password/i);
		await expect.poll(() => page.evaluate(() => localStorage.getItem('allegro_token'))).toBeNull();
	});

	test('successful login stores token and lands on teams.html', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('good_login'));
		await configureApiPage(page);

		await page.goto('/html/login.html');
		await page.getByLabel('Email').fill(session.credentials.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(session.credentials.password);
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect(page).toHaveURL(/teams\.html$/);
		const token = await page.evaluate(() => localStorage.getItem('allegro_token'));
		expect(token).toBeTruthy();
		const storedUser = JSON.parse((await page.evaluate(() => localStorage.getItem('allegro_user'))) ?? '{}');
		expect(storedUser.username).toBe(session.credentials.username);
	});

	test('after login, returns user to the ?redirect= page they came from', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('login_redir_param'));
		await configureApiPage(page);

		// getPostAuthRedirect only checks same-origin; the team_id doesn't have to exist.
		await page.goto('/html/login.html');
		const redirectTarget = `${new URL(page.url()).origin}/html/tracker.html?team_id=99`;
		await page.goto(`/html/login.html?redirect=${encodeURIComponent(redirectTarget)}`);

		await page.getByLabel('Email').fill(session.credentials.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(session.credentials.password);
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect(page).toHaveURL(/tracker\.html\?team_id=99/);
	});

	test('password toggle reveals the password text', async ({ page }) => {
		await configureApiPage(page);

		await page.goto('/html/login.html');
		const pwField = page.getByRole('textbox', { name: 'Password' });
		await pwField.fill('hello-world');
		await expect(pwField).toHaveAttribute('type', 'password');
		await page.getByRole('button', { name: 'Show password' }).click();
		await expect(pwField).toHaveAttribute('type', 'text');
	});
});

test.describe('Auth — signup page', () => {
	test('creates an account, signs the user in, and redirects to teams', async ({ page }) => {
		const credentials = makeUniqueUser('signup_happy');
		await configureApiPage(page);

		await page.goto('/html/signup.html');
		await page.getByLabel('First name').fill(credentials.first_name);
		await page.getByLabel('Last name').fill(credentials.last_name);
		await page.getByLabel('Username').fill(credentials.username);
		await page.getByLabel('Email').fill(credentials.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(credentials.password);
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page).toHaveURL(/teams\.html$/, { timeout: 10_000 });
		const token = await page.evaluate(() => localStorage.getItem('allegro_token'));
		expect(token).toBeTruthy();
	});

	test('duplicate account (HTTP 409) surfaces a friendly error and never the generic "Sign-up failed" fallback', async ({ page }) => {
		// Register a real user up front so the second signup conflicts on email + username.
		const existing = await registerUser(makeUniqueUser('signup_dup'));
		await configureApiPage(page);

		await page.goto('/html/signup.html');
		await page.getByLabel('First name').fill('Grace');
		await page.getByLabel('Last name').fill('Hopper');
		await page.getByLabel('Username').fill(existing.credentials.username);
		await page.getByLabel('Email').fill(existing.credentials.email);
		await page.getByRole('textbox', { name: 'Password' }).fill('cobol-1959');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page).toHaveURL(/signup\.html/);
		await expect.poll(() => page.evaluate(() => localStorage.getItem('allegro_token'))).toBeNull();

		// signup.js maps any 409 to the same banner copy ("username or email is already in use")
		// and must never fall through to the generic "Sign-up failed" copy.
		const banner = page.locator('#auth-error');
		await expect(banner).toBeVisible();
		await expect(banner).toContainText(/already in use/i);
		await expect(banner).not.toContainText(/Sign-up failed/i);
		await expect(banner).not.toContainText(/\b409\b/);
	});
});

test.describe('Auth gating', () => {
	test('unauthenticated visit to teams.html redirects to login with ?redirect=', async ({ page }) => {
		await configureApiPage(page);
		await page.goto('/html/teams.html');
		await expect(page).toHaveURL(/login\.html\?redirect=/);
	});

	test('unauthenticated visit to tracker.html redirects to login with ?redirect=', async ({ page }) => {
		await configureApiPage(page);
		await page.goto('/html/tracker.html?team_id=1');
		await expect(page).toHaveURL(/login\.html\?redirect=.*tracker\.html/);
	});

	test('sign-out from the user menu clears storage and returns to login', async ({ page }) => {
		const session = await registerUser(makeUniqueUser('signout'));
		await setBrowserSession(page, session);

		await page.goto('/html/teams.html');

		await page.locator('#user-avatar').click();
		const signOut = page.locator('#sign-out-btn');
		await expect(signOut).toBeVisible();
		await signOut.click();

		await expect(page).toHaveURL(/login\.html$/);
		await page.waitForLoadState('domcontentloaded');
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

		const token = await page.evaluate(() => localStorage.getItem('allegro_token'));
		const storedUser = await page.evaluate(() => localStorage.getItem('allegro_user'));
		expect(token).toBeNull();
		expect(storedUser).toBeNull();
	});
});
