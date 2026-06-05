// @ts-check
import { test, expect } from '@playwright/test';
import { createState, installApiMocks, seed, setAuthStorage, setupApp } from './helpers/mock-api.js';

test.describe('Auth — login page', () => {
	test('redirects to teams when already signed in', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/login.html');
		await expect(page).toHaveURL(/teams\.html$/);
	});

	test('shows the welcome heading when signed out', async ({ page }) => {
		await setupApp(page, { noAuth: true });
		await page.goto('/html/login.html');
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
	});

	test('rejects invalid credentials and stays on login.html', async ({ page }) => {
		const state = createState();
		state.users.push({
			id: 1,
			username: 'ada_lovelace',
			email: 'ada@example.com',
			first_name: 'Ada',
			last_name: 'Lovelace',
			password: 'correct-password',
		});
		await installApiMocks(page, state);

		await page.goto('/html/login.html');
		await page.getByLabel('Email').fill('ada@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('WRONG-password');
		await page.getByRole('button', { name: 'Sign in' }).click();

		// On 401, login.js surfaces the API error via setCustomValidity on the email field.
		await expect(page).toHaveURL(/login\.html/);
		const emailMessage = await page.getByLabel('Email').evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage);
		expect(emailMessage).toContain('Invalid email or password');
		await expect.poll(() => page.evaluate(() => localStorage.getItem('allegro_token'))).toBeNull();
	});

	test('successful login stores token and lands on teams.html', async ({ page }) => {
		const state = createState();
		state.users.push({
			id: 1,
			username: 'ada_lovelace',
			email: 'ada@example.com',
			first_name: 'Ada',
			last_name: 'Lovelace',
			password: 'correct-password',
		});
		await installApiMocks(page, state);

		await page.goto('/html/login.html');
		await page.getByLabel('Email').fill('ada@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('correct-password');
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect(page).toHaveURL(/teams\.html$/);
		const token = await page.evaluate(() => localStorage.getItem('allegro_token'));
		expect(token).toBeTruthy();
		const storedUser = JSON.parse((await page.evaluate(() => localStorage.getItem('allegro_user'))) ?? '{}');
		expect(storedUser.username).toBe('ada_lovelace');
	});

	test('after login, returns user to the ?redirect= page they came from', async ({ page }) => {
		const state = createState();
		state.users.push({
			id: 1,
			username: 'ada_lovelace',
			email: 'ada@example.com',
			first_name: 'Ada',
			last_name: 'Lovelace',
			password: 'pw1234567',
		});
		await installApiMocks(page, state);

		// Navigate first so page.url() resolves to a real same-origin URL — getPostAuthRedirect
		// validates that ?redirect= is same-origin and falls back to teams.html otherwise.
		await page.goto('/html/login.html');
		const redirectTarget = `${new URL(page.url()).origin}/html/tracker.html?team_id=99`;
		await page.goto(`/html/login.html?redirect=${encodeURIComponent(redirectTarget)}`);

		await page.getByLabel('Email').fill('ada@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('pw1234567');
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect(page).toHaveURL(/tracker\.html\?team_id=99/);
	});

	test('password toggle reveals the password text', async ({ page }) => {
		await setupApp(page, { noAuth: true });
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
		await setupApp(page, { noAuth: true });

		await page.goto('/html/signup.html');
		await page.getByLabel('First name').fill('Grace');
		await page.getByLabel('Last name').fill('Hopper');
		await page.getByLabel('Username').fill('ghopper');
		await page.getByLabel('Email').fill('grace@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('cobol-1959');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page).toHaveURL(/teams\.html$/);
		const token = await page.evaluate(() => localStorage.getItem('allegro_token'));
		expect(token).toBeTruthy();
	});

	test('duplicate account (HTTP 409) surfaces identity-field error, never a password-field or generic error', async ({ page }) => {
		// Regression: signup.js used to detect duplicates by scanning err.message for "409",
		// which broke when the backend changed wording and produced a misleading
		// password-field error. The fix uses err.status === 409. This test enforces
		// the user-facing contract so the bug cannot silently come back.
		const state = createState();
		state.users.push({
			id: 1,
			username: 'existing',
			email: 'taken@example.com',
			first_name: 'T',
			last_name: 'A',
			password: 'pw1234567',
		});
		await installApiMocks(page, state);

		await page.goto('/html/signup.html');
		await page.getByLabel('First name').fill('Grace');
		await page.getByLabel('Last name').fill('Hopper');
		await page.getByLabel('Username').fill('ghopper');
		await page.getByLabel('Email').fill('taken@example.com');
		await page.getByRole('textbox', { name: 'Password' }).fill('cobol-1959');
		await page.getByRole('button', { name: 'Create account' }).click();

		// 1. User stays on signup.html and is NOT signed in.
		await expect(page).toHaveURL(/signup\.html/);
		await expect.poll(() => page.evaluate(() => localStorage.getItem('allegro_token'))).toBeNull();

		const usernameEl = page.getByLabel('Username');
		const passwordEl = page.getByRole('textbox', { name: 'Password' });
		const emailEl = page.getByLabel('Email');

		// 2. The exact message lands on the username identity field.
		await expect
			.poll(async () => usernameEl.evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage))
			.toBe('Username or email is already in use');

		// 3. It must NOT land on the password field (the original bug) — empty string only.
		const passwordMessage = await passwordEl.evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage);
		expect(passwordMessage).toBe('');

		// 4. And nowhere in the form may the generic fallback "Sign-up failed" appear,
		//    nor an HTTP-status leak like "409", nor the back-end's raw error string.
		const fields = [page.getByLabel('First name'), page.getByLabel('Last name'), usernameEl, emailEl, passwordEl];
		for (const field of fields) {
			const msg = await field.evaluate((el) => /** @type {HTMLInputElement} */ (el).validationMessage);
			expect(msg).not.toMatch(/Sign-up failed/i);
			expect(msg).not.toMatch(/\b409\b/);
			expect(msg).not.toMatch(/Email or username is already in use/); // raw backend wording
		}
	});
});

test.describe('Auth gating', () => {
	test('unauthenticated visit to teams.html redirects to login with ?redirect=', async ({ page }) => {
		// No setupApp() — keep storage empty so requireAuth fires.
		await page.goto('/html/teams.html');
		await expect(page).toHaveURL(/login\.html\?redirect=/);
	});

	test('unauthenticated visit to tracker.html redirects to login with ?redirect=', async ({ page }) => {
		await page.goto('/html/tracker.html?team_id=1');
		await expect(page).toHaveURL(/login\.html\?redirect=.*tracker\.html/);
	});

	test('sign-out from the user menu clears storage and returns to login', async ({ page }) => {
		await setupApp(page);
		await page.goto('/html/teams.html');

		await page.locator('#user-avatar').click();
		const signOut = page.locator('#sign-out-btn');
		await expect(signOut).toBeVisible();
		await signOut.click();

		await expect(page).toHaveURL(/login\.html$/);
		// Wait for login.html's scripts to finish so page.evaluate doesn't race the navigation.
		await page.waitForLoadState('domcontentloaded');
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

		const token = await page.evaluate(() => localStorage.getItem('allegro_token'));
		const storedUser = await page.evaluate(() => localStorage.getItem('allegro_user'));
		expect(token).toBeNull();
		expect(storedUser).toBeNull();
	});
});
