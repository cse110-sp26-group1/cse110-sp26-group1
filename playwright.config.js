// @ts-check
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT) || 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// When E2E_REAL_API=1, Playwright runs ONLY the real-backend specs under
// tests/real/ against a live Cloudflare Worker (default http://127.0.0.1:8787).
// Otherwise it runs the mocked suite at the repo root and ignores tests/real/.
const REAL_API_MODE = process.env.E2E_REAL_API === '1';

// Mock mode runs the full browser matrix; real mode runs Chromium-only for
// desktop specs to keep wall-clock runtime down (mocked suite already covers
// browser permutations) and the mobile-chrome project for mobile specs.
const mockProjects = [
	{
		name: 'chromium',
		use: { ...devices['Desktop Chrome'] },
		testIgnore: [/mobile\.spec\.js$/, /real[\\/]/],
	},
	{
		name: 'firefox',
		use: { ...devices['Desktop Firefox'] },
		testIgnore: [/mobile\.spec\.js$/, /real[\\/]/],
	},
	{
		name: 'webkit',
		use: { ...devices['Desktop Safari'] },
		testIgnore: [/mobile\.spec\.js$/, /real[\\/]/],
	},
	{
		name: 'mobile-chrome',
		use: { ...devices['Pixel 5'] },
		testMatch: /mobile\.spec\.js$/,
	},
];

const realProjects = [
	{
		name: 'chromium-real',
		use: { ...devices['Desktop Chrome'] },
		testDir: './tests/real',
		testIgnore: /mobile\.real\.spec\.js$/,
	},
	{
		name: 'mobile-chrome-real',
		use: { ...devices['Pixel 5'] },
		testDir: './tests/real',
		testMatch: /mobile\.real\.spec\.js$/,
	},
];

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

	projects: REAL_API_MODE ? realProjects : mockProjects,

	/* Serve the static frontend (vanilla HTML/CSS/JS) with python3's built-in
	 * http.server. In real-API mode the same static server is used; the frontend
	 * is just pointed at a different API origin via window.__ALLEGRO_API_BASE__. */
	webServer: {
		command: `python3 -m http.server ${PORT} --bind 127.0.0.1 --directory frontend`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		stdout: 'ignore',
		stderr: 'pipe',
		timeout: 30_000,
	},
});
