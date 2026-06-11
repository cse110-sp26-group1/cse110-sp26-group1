# Frontend testing

There are two ways to test the frontend:

- **Manual local testing** — run the backend and frontend locally and click through the app (below)
- **Automated end-to-end tests** — the Playwright suite in `e2e-test/` (see [E2E tests](#e2e-tests))

## Manual local testing

Run the stack locally like this.

### Terminal 1: backend

From your repo root:

```bash
cd issue-tracker-api
npm install
npx wrangler d1 execute issue-tracker-db --local --file=./schema.sql
npm run dev
```

That should start the API at:

**http://localhost:8787**

Temporarily change `API_BASE` in `frontend/js/constants.js`:

```javascript
export const API_BASE = 'http://localhost:8787';
```

Or, without editing the file, set an override in the browser console before loading the app:

```javascript
localStorage.setItem('allegro_api_base', 'http://localhost:8787');
```

Revert the constant change or clear `allegro_api_base` when done testing locally.

### Terminal 2: frontend

Use port **3000**, because the backend CORS config allows that origin.

From your repo root:

```bash
python3 -m http.server 3000 --directory frontend
```

Then open:

**http://localhost:3000/html/login.html**

## E2E tests

The Playwright suite in [`e2e-test/`](../../e2e-test/README.md) drives the UI in a real browser against a live local Wrangler + D1 backend. It covers auth, teams, invites, issues, navigation, and mobile layouts (58 tests).

These tests are **not part of CI**. Run them locally before opening or merging a PR that touches `frontend/`, `issue-tracker-api/`, `e2e-test/`, or `playwright.config.js`.

With a local backend running (Terminal 1 above):

```bash
npm ci                              # first time only
npx playwright install --with-deps  # first time only

npm run test:e2e                    # full suite (chromium + mobile-chrome)
npm run test:e2e:ui                 # Playwright UI runner
npm run test:e2e:headed             # watch the browser
```

The Playwright config serves the frontend itself (port 4173), so Terminal 2 is not needed.

> Do not point the tests at the deployed Worker — each run creates users that are never deleted. Use a local D1.

See [`e2e-test/README.md`](../../e2e-test/README.md) for the full spec breakdown, helpers, configuration, and known gaps.
