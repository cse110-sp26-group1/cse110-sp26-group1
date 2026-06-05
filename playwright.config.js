// @ts-check
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT) || 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'html',

	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
	},

	projects: [
		// Desktop projects skip mobile.spec.js — those tests assume a narrow viewport.
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			testIgnore: /mobile\.spec\.js$/,
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
			testIgnore: /mobile\.spec\.js$/,
		},
		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
			testIgnore: /mobile\.spec\.js$/,
		},
		// One mobile project — runs ONLY tests/mobile.spec.js so we don't duplicate
		// the desktop suite at the Pixel 5 viewport.
		{
			name: 'mobile-chrome',
			use: { ...devices['Pixel 5'] },
			testMatch: /mobile\.spec\.js$/,
		},
	],

	/* Serve the static frontend (vanilla HTML/CSS/JS) with python3's built-in
	 * http.server. The API itself is mocked via Playwright route handlers, so we
	 * never hit the production Cloudflare Worker during tests. */
	webServer: {
		command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory frontend`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		// stderr is piped (not ignored) so server startup failures are visible
		// locally and in CI instead of being silently swallowed.
		stdout: 'ignore',
		stderr: 'pipe',
		timeout: 30_000,
	},
});
