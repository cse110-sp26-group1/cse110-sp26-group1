// @ts-check
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT) || 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const projects = [
	{
		name: 'chromium',
		use: { ...devices['Desktop Chrome'] },
		testIgnore: /mobile\.spec\.js$/,
	},
	{
		name: 'mobile-chrome',
		use: { ...devices['Pixel 5'] },
		testMatch: /mobile\.spec\.js$/,
	},
];

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: './E2E_test/tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'html',

	use: {
		baseURL: BASE_URL,
		trace: 'on-first-retry',
	},

	projects,

	/* Serve the static frontend (vanilla HTML/CSS/JS) with python3's built-in
	 * http.server. The frontend is pointed at a local API origin via
	 * window.__ALLEGRO_API_BASE__ (see E2E_test/helpers/api.js). */
	webServer: {
		command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory frontend`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		stdout: 'ignore',
		stderr: 'pipe',
		timeout: 30_000,
	},
});
