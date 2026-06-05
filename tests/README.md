# Playwright E2E Tests

End-to-end test suite for the Allegro issue tracker **frontend**.

> **What this is:** a mocked frontend E2E suite. Every request to the
> Cloudflare Worker API is intercepted by `tests/helpers/mock-api.js` and
> served from in-memory state. These tests verify that the UI behaves
> correctly against a *well-defined API contract* — they do not exercise
> any real backend code.

Three desktop browsers (chromium, firefox, webkit) plus one mobile project
(Pixel 5, runs only `mobile.spec.js`).

## Test files (`tests/`)

| File | What it covers |
| --- | --- |
| `auth.spec.js` | Login/signup forms, validation, 401 / 409 error UI, `?redirect=` param, password toggle, `requireAuth` / `requireNoAuth` gating, sign-out clearing storage. Duplicate-signup test asserts the error lands on the username field (not password) and never appears as a generic "Sign-up failed". |
| `navigation.spec.js` | Signed-out root visit MUST land on `login.html` (strict assertion — fails if a regression lets `teams.html` render for anon users); signed-in root visit goes to `teams.html`. Dark-mode persistence across pages, topbar logo → teams. |
| `teams.spec.js` | Team-card list from API, navigation to tracker, create-team modal validation + happy path (asserts toast, redirect, and outgoing POST payload), pending-invites badge count, invites section listing. |
| `invites.spec.js` | Accept removes the row, **decrements the visible badge count**, and the newly-joined team appears as a card. Decline path; `join.html` empty / list / preview / invalid-code views; preview "Join workspace" → accept + redirect; code-entry validation; tracker invite modal happy path + 404 / email-format errors; invite link generation. |
| `issues.spec.js` | Priority-grouped list, click → detail rendered, 404 state for bad team_id, status/tag/category filters, search filter + clear, sort toggle changes grouping, create modal validation + happy path, edit save + validation, `j` keyboard nav. |
| `notifications.spec.js` | Creating an issue produces a `new_issue` notification in localStorage under the per-user key. (The notification dropdown UI is currently commented out in `tracker.html`, so only the storage layer is tested.) |
| `mobile.spec.js` | **Mobile-chrome project only.** Tracker filter-sidebar drawer (open/close/backdrop), search input relocates to the sidebar drawer at narrow widths and still filters the list, mobile master/detail flow (full-screen issue detail + back button), teams hero actions remain hittable on a narrow viewport. |

## Helper (`tests/helpers/mock-api.js`)

In-memory mock that intercepts the hardcoded production URL via `page.route()`.
Implements `/auth/*`, `/teams/*`, `/invites/*`, `/issues/*` against a shared
state object. Tests can mutate `state` between requests, and the mock returns
realistic responses (correct status codes, JSON shapes). A sessionStorage marker
makes the auth-init script idempotent so sign-out flows aren't immediately
re-authed.

## Config

- `playwright.config.js`: serves `frontend/` with `python3 -m http.server` on
  `127.0.0.1:4173`; runs chromium/firefox/webkit on every file and a
  `mobile-chrome` project (Pixel 5) on `mobile.spec.js` only. WebServer `stderr`
  is piped (not ignored) so startup failures are visible in local runs and CI.
  Retries 2× on CI.
- `package.json`: `test:e2e`, `test:e2e:ui`, `test:e2e:headed` scripts.
- The existing `.github/workflows/playwright.yml` does `npx playwright test`,
  so it picks all of this up.

## Decisions

- **No app changes.** The hardcoded `API_BASE` in `frontend/js/api.js` is
  intercepted by Playwright, so production code is untouched.
- **API mocked, not local wrangler.** Spinning up wrangler + a local D1 for E2E
  would be more infra than the frontend suite needs. The backend has its own
  vitest suite that hits a real D1 (see `issue-tracker-api/test/*.spec.js`).
- **User-visible assertions come first.** Each important flow asserts on
  visible UI (text on screen, badge count, URL, toast). Mock-state checks are
  kept as a secondary cross-check — they catch a UI that lies (e.g. removes
  a row without calling the API), but they never stand alone as the primary
  proof. Request-payload assertions are used where it matters that the UI
  sent the *correct* data (e.g. create-team).

## Run

```sh
npm run test:e2e                                # headless, all projects (incl. mobile)
npm run test:e2e -- --project=chromium          # one desktop browser
npm run test:e2e -- --project=mobile-chrome     # mobile-only
npm run test:e2e:ui                             # Playwright UI runner
npm run test:e2e:headed                         # see the browser
```

## What this suite still misses

Because every API call is mocked, the following classes of bug **cannot** be
caught here. They need separate coverage:

- **API contract drift** — the mock can lag behind the real Worker. If the
  Worker changes a response shape or status code, these tests will keep
  passing against the stale mock while production breaks.
- **CORS** — the real Worker's CORS headers and preflight behavior are
  bypassed entirely. The mock just answers `OPTIONS` with `access-control-allow-origin: *`.
- **Worker behavior** — auth token expiry, rate limiting, request validation,
  any business logic that lives in the Worker itself.
- **D1 / database behavior** — schema migrations, cascade deletes, unique
  constraints, transaction semantics, JOIN correctness.
- **Real auth / session integration** — token expiry, refresh flow, the
  `/auth/validate` round-trip, cookie/CORS interplay.
- **LLM enrichment on issue create** — backend-only, requires the live Worker.
- **Drag-to-resize divider**, **file attachment upload on new issue**.
- **Notification dropdown UI on tracker** — the dropdown markup is commented
  out in `tracker.html`, so `notifications.spec.js` only exercises the
  per-user localStorage layer.
- **Theme FOUC script** — runs before module scripts; covered indirectly
  via the dark-mode persistence test.

## Future integration coverage

The single biggest gap above is **contract drift between the mock and the
real Worker**. The recommended next step is a tiny local Worker/D1 smoke
suite (a few tests, not a full second copy of the E2E suite) that boots
`wrangler dev` against an in-memory D1 and exercises:

1. `POST /auth/register` → `POST /auth/login` → `GET /auth/validate` happy path
2. `POST /teams` → `GET /teams` → `GET /teams/:id` happy path
3. `POST /teams/:id/invite` → `GET /invites` → `PATCH /invites/:id/accept` happy path
4. `POST /issues` → `GET /issues?team_id=…` → `PATCH /issues/:id` happy path
5. A handful of error cases (401 on missing token, 409 on duplicate signup,
   404 on bad ids)

If those pass against the real Worker, the Playwright mock's contract is
validated. If they fail, the mock is out of date and these E2E tests are
giving false confidence.

This was deliberately deferred — adding `wrangler dev` + D1 to the test
runner is a non-trivial setup and is best done as its own task. The backend
already has a vitest suite under `issue-tracker-api/test/` that hits a real
D1; the missing piece is the wiring that keeps the mock's response shapes
in sync with what the live Worker actually returns.

## Regressions covered

- **Duplicate-account signup error placement** (`auth.spec.js`):
  signup.js once used `err.message.includes('409')` to detect duplicates,
  which broke when the backend changed wording and surfaced a misleading
  password-field error. The fix uses `err.status === 409`. The test asserts
  the exact message lands on the username field, the password field is
  untouched, and the generic "Sign-up failed" fallback never appears for a
  409 response.
- **Signed-out users reaching `teams.html`** (`navigation.spec.js`):
  the root-redirect test now requires the URL to end on `login.html` with
  the redirect param preserved. It will fail if `requireAuth()` regresses
  and lets `teams.html` render for an unauthenticated visitor.
