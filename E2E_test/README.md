# Playwright E2E Tests

End-to-end test suite for the Allegro issue tracker **frontend**. Specs drive the UI in a real browser against a live Cloudflare Worker + D1 backend (default `http://127.0.0.1:8787` via local Wrangler). No API mocking.

| Path | Purpose |
| --- | --- |
| `E2E_test/tests/*.spec.js` | Playwright specs (49 tests across 6 files) |
| `E2E_test/helpers/api.js` | HTTP client + browser session bootstrap |

## Running

> **These tests are not part of CI.** Run them locally before opening or merging a PR that touches `frontend/`, `issue-tracker-api/`, `E2E_test/`, or `playwright.config.js`.

First-time setup (or after a clean clone):

```sh
npm ci
npx playwright install --with-deps
```

Start a local Wrangler + D1 backend in a separate terminal:

```sh
cd issue-tracker-api
npm ci                                          # first time only
npx wrangler d1 execute issue-tracker-db --local --file=./schema.sql
npm run dev                                     # serves http://127.0.0.1:8787
```

Confirm it's up with `curl http://127.0.0.1:8787/health`, then run the suite:

```sh
npm run test:e2e                                # chromium + mobile-chrome
npm run test:e2e -- --project=chromium          # desktop only
npm run test:e2e -- --project=mobile-chrome     # mobile only

E2E_API_BASE=http://127.0.0.1:8787 npm run test:e2e   # explicit API origin

npm run test:e2e:ui                             # Playwright UI runner
npm run test:e2e:headed                         # see the browser
```

> ⚠️ **Do not point `E2E_API_BASE` at the deployed Worker for routine runs.**
> Each test creates persistent users, teams, and issues; only teams (and their
> cascaded issues) get cleaned up via DELETE routes. Users accumulate forever
> because the backend has no user-delete route. Use a local D1 unless you know
> what you're doing.

## Spec files (`E2E_test/tests/`)

Tests seed data through real HTTP API calls, use unique generated users/teams/issues, and delete created teams in `finally` blocks (issues cascade via FK).

| File | What it covers |
| --- | --- |
| `auth.spec.js` | `/auth/register`, `/auth/login`, `/auth/logout` flows, `?redirect=` preservation, duplicate-signup 409 friendly banner, password toggle, `requireAuth` / `requireNoAuth` gating, sign-out clearing storage. |
| `teams.spec.js` | Listing teams via `/teams`, admin vs member role rendering (via an accepted invite from a second user), settings-modal leave-team flow for members (member vs admin controls), admin leave restriction with backend membership checks, create-team modal and POST payload, pending-invites section, navigation to tracker. |
| `invites.spec.js` | Two-user invite flow: accept removes the row + adds the team card; decline; last-invite hides section; tracker settings modal invite happy path + duplicate + 404 + email-format error. |
| `issues.spec.js` | `/issues` seed with `test_mode=true` (predictable LLM bypass), priority grouping, filter/search/sort, create modal validation + happy path, assignee persistence, text/log attachment persistence, edit save + validation, delete via UI, `j` keyboard nav. |
| `navigation.spec.js` | Signed-out root → `login.html`, signed-in root → `teams.html`, dark-mode persistence, tracker logo → teams. |
| `mobile.spec.js` | **`mobile-chrome` project only.** Sidebar drawer, search relocation, mobile master/detail, teams new-team action and pending-invites section on a narrow viewport. |

## Helpers (`E2E_test/helpers/api.js`)

HTTP client for the backend (`registerUser`, `createTeam`, `inviteUser`, `acceptInvite`, `createIssue`, `fetchTeams`, `fetchIssues`, `fetchInvites`, `fetchTeamMembers`, `safeDeleteTeam`, …) plus browser-side bootstrap: `configureApiPage` and `setBrowserSession` set `window.__ALLEGRO_API_BASE__` before module scripts run, and the frontend's `resolveApiBase()` reads that override.

Issue creation through the helper sends `test_mode=true` so the backend returns predictable LLM-shaped fields without calling DeepSeek.

## Config

- `playwright.config.js`:
  - `testDir`: `./E2E_test/tests`
  - Static frontend served by `python3 -m http.server` on `127.0.0.1:4173`.
  - Projects: `chromium` for desktop specs (excluding `mobile.spec.js`); `mobile-chrome` (Pixel 5) for `mobile.spec.js` only.
  - WebServer `stderr` is piped so startup failures are visible in CI.
  - Retries 2× on CI.

- `package.json` scripts:
  - `test:e2e` — full suite (`E2E_REAL_API=1 playwright test`)
  - `test:e2e:ui` / `test:e2e:headed`

## Decisions

- **User-visible assertions come first.** UI text, badge counts, URLs, and toasts are the primary proofs. API-state cross-checks (`fetchInvites`, `fetchTeams`, etc.) are secondary — they catch a UI that lies without calling the API, but never stand alone.
- **Persistent workflows get API-state assertions.** Issue create/edit/delete, assignment, attachment upload, invite duplicate handling, and team leave all verify backend state after the UI action.
- **Cleanup runs in `finally`.** Teams (and cascaded issues) are deleted after every test. Users persist — there is no `/auth/delete` route — which is one more reason to use a local D1.
- **Issue creation uses backend test mode.** Specs set `allegro_e2e_test_mode=1`, so UI issue creation sends `test_mode=true`.

## Limitations and known gaps

- **No user delete.** Runs accumulate user rows. Wipe the local D1 periodically (re-running `schema.sql` does not drop data; to reset, delete `.wrangler/state/v3/d1/`).
- **LLM behavior is bypassed.** Issue creation forces `test_mode=true` for predictability. Live LLM enrichment is not covered.
- **Drag-to-resize divider** is not covered.
- **Notification dropdown UI** is commented out in `tracker.html` — not tested.
- **Theme FOUC script** runs before module scripts; covered indirectly via the dark-mode persistence test.

## Regressions covered

- **Duplicate-account signup error copy** (`auth.spec.js`): signup.js once used `err.message.includes('409')` to detect duplicates, which broke when the backend changed wording. The test asserts the friendly banner appears and the generic "Sign-up failed" fallback/raw status never appears for a 409 response.
- **Signed-out users reaching `teams.html`** (`navigation.spec.js`): the root-redirect test requires the URL to end on `login.html` with the redirect param preserved.
