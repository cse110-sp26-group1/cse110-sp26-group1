# Playwright E2E Tests

End-to-end test suite for the Allegro issue tracker **frontend**, with two
modes: a fast mocked suite for dense UI coverage, and a real-backend suite that
drives the same UI against the live Cloudflare Worker + D1.

| Suite | Files | What it does |
| --- | --- | --- |
| **Mock** (default) | `tests/mock/*.spec.js` | Intercepts every Worker request via `page.route()` and answers from `tests/helpers/mock-api.js`. Fast, deterministic, browser-matrix-friendly. |
| **Real** (opt-in) | `tests/real/*.real.spec.js` | No mocks. Calls the real `/auth`, `/teams`, `/invites`, `/issues` routes. Default origin `http://127.0.0.1:8787` (local Wrangler + D1). |

The two suites do not overlap in a single run. `npm run test:e2e` runs only
the mocked specs; `npm run test:e2e:real` sets `E2E_REAL_API=1` and runs only
the real specs.

## Running

```sh
npm run test:e2e                                # mocked suite, all projects (incl. mobile)
npm run test:e2e -- --project=chromium          # one desktop browser
npm run test:e2e -- --project=mobile-chrome     # mobile-only

npm run test:e2e:real                           # real-backend suite (chromium-real + mobile-chrome-real)
E2E_API_BASE=http://127.0.0.1:8787 npm run test:e2e:real     # explicit origin

npm run test:e2e:all                            # mocked, then real
npm run test:e2e:ui                             # Playwright UI runner
npm run test:e2e:headed                         # see the browser
```

Before `test:e2e:real`, start a local Wrangler + D1 backend:

```sh
cd issue-tracker-api
wrangler d1 execute issue-tracker-db --local --file=./schema.sql
npm run dev    # serves http://127.0.0.1:8787
```

> ⚠️ **Do not point `E2E_API_BASE` at the deployed Worker for routine runs.**
> Each real-mode test creates persistent users, teams, and issues; only teams
> and issues get cleaned up via DELETE routes. Users accumulate forever because
> the backend has no user-delete route. Use a local D1 unless you know what
> you're doing.

## Mock-suite files (`tests/`)

| File | What it covers |
| --- | --- |
| `auth.spec.js` | Login/signup forms, validation, 401 / 409 error UI, `?redirect=` param, password toggle, `requireAuth` / `requireNoAuth` gating, sign-out clearing storage. Duplicate-signup test asserts the friendly error banner appears without leaking "Sign-up failed" or raw HTTP status text. |
| `navigation.spec.js` | Signed-out root visit MUST land on `login.html` (strict assertion — fails if a regression lets `teams.html` render for anon users); signed-in root visit goes to `teams.html`. Dark-mode persistence across pages, topbar logo → teams. |
| `teams.spec.js` | Team-card list from API, navigation to tracker, tracker-menu leave-team flow for members, admin leave restriction, create-team modal validation + happy path, pending-invites section count/listing. |
| `invites.spec.js` | Accept/decline, pending-invite row decrement, `join.html` empty / list / preview / invalid-code views, tracker invite modal happy path + duplicate / 404 / email-format errors. |
| `issues.spec.js` | Priority-grouped list, click → detail, 404 state for bad team_id, status/tag/category filters, search filter + clear, sort toggle, create modal validation + happy path, edit save + validation, `j` keyboard nav. |
| `notifications.spec.js` | Creating an issue produces a `new_issue` notification in localStorage. |
| `mobile.spec.js` | **Mobile-chrome project only.** Tracker filter-sidebar drawer, relocated search input, mobile master/detail with back button, teams new-team action and pending-invites section on a narrow viewport. |

## Real-suite files (`tests/real/`)

Each file is the real-backend counterpart to the mocked spec of the same name.
They follow the same UI assertions but seed data through real HTTP API calls,
use unique generated users/teams/issues, and delete created teams (which
cascade to issues) in `finally` blocks.

| File | What it covers |
| --- | --- |
| `auth.real.spec.js` | Real `/auth/register`, `/auth/login`, `/auth/logout` flows, `?redirect=` preservation, duplicate-signup 409 friendly banner, password toggle. |
| `teams.real.spec.js` | Listing teams via `/teams`, admin vs member role rendering (via an accepted invite from a second user), tracker-menu leave-team flow for members, admin leave restriction with backend membership checks, create-team modal and POST payload, pending-invites section, navigation to tracker. |
| `invites.real.spec.js` | Two-user invite flow end-to-end: send through tracker, fetch as invitee, accept removes the row + adds the team card; decline; `join.html` empty / list / preview / invalid-code / accept / code-entry validation; tracker invite modal happy path + duplicate + 404 + email-format error. |
| `issues.real.spec.js` | Real `/issues` seed with `test_mode=true` (predictable LLM bypass), priority grouping, filter/search/sort, create modal validation + happy path, assignee persistence, text/log attachment persistence, edit save + validation, delete via UI, `j` keyboard nav. |
| `navigation.real.spec.js` | Signed-out root → `login.html`, signed-in root → `teams.html`, dark-mode persistence, tracker logo → teams. |
| `notifications.real.spec.js` | Creating an issue through the real API produces a `new_issue` notification under the per-user localStorage key. |
| `mobile.real.spec.js` | **`mobile-chrome-real` project only.** Sidebar drawer, search relocation, mobile master/detail, mobile teams hero actions. |

## Helpers

- `tests/helpers/mock-api.js` — in-memory fixtures + `page.route()` interceptor that emulates the Worker. Used only by mock specs.
- `tests/helpers/real-api.js` — HTTP client for the real backend (`registerRealUser`, `loginRealUser`, `createRealTeam`, `inviteRealUser`, `acceptRealInvite`, `createRealIssue`, `updateRealIssue`, `deleteRealIssue`, `fetchRealTeams`, `fetchRealIssues`, …) plus browser-side bootstrap: `configureRealApiPage` and `setBrowserSession` flip `window.__ALLEGRO_API_BASE__` before module scripts run, and the frontend's `resolveApiBase()` reads that override. Used only by real specs.

## Config

- `playwright.config.js`:
  - Static frontend served by `python3 -m http.server` on `127.0.0.1:4173`.
  - Default mode: `chromium`, `firefox`, `webkit` for desktop specs (excluding `tests/real/`); `mobile-chrome` for `mobile.spec.js`.
  - Real-API mode (`E2E_REAL_API=1`): `chromium-real` for `tests/real/*.real.spec.js` (excluding mobile); `mobile-chrome-real` for `mobile.real.spec.js`. Browser matrix is intentionally narrower — the mocked suite already covers cross-browser permutations.
  - WebServer `stderr` is piped so startup failures are visible in CI.
  - Retries 2× on CI.

- `package.json` scripts:
  - `test:e2e` — mocked suite
  - `test:e2e:real` — real-backend suite (`E2E_REAL_API=1`)
  - `test:e2e:all` — both
  - `test:e2e:ui` / `test:e2e:headed`

## Decisions

- **Default tests stay mocked.** The cross-browser matrix needs determinism and speed.
- **Real backend tests live in `tests/real/`** and are a strict superset of the mock specs' user-visible assertions. They never import `tests/helpers/mock-api.js` and never install `page.route()` for API mocking.
- **Real specs share the same `API_BASE` constant.** `frontend/js/api.js` keeps the production URL; `setBrowserSession()` / `configureRealApiPage()` set `window.__ALLEGRO_API_BASE__` and `localStorage.allegro_api_base` so `resolveApiBase()` routes calls to `E2E_API_BASE` instead.
- **Issue creation uses backend test mode.** Real specs flip `allegro_e2e_test_mode=1`, so UI issue creation sends `test_mode=true`. The backend returns predictable LLM-shaped fields without calling DeepSeek.
- **User-visible assertions come first.** UI text, badge counts, URLs, and toasts are the primary proofs. API-state cross-checks (`fetchRealInvites`, etc.) are kept as secondary verification — they catch a UI that lies (e.g. removes a row without calling the API), but never stand alone.
- **Persistent workflows get API-state assertions in real mode.** Issue create/edit/delete, assignment, attachment upload, invite duplicate handling, and team leave all verify backend state after the UI action.
- **Real-mode browser matrix is narrower than mock-mode.** Running every real test against Firefox + WebKit would multiply database churn without buying coverage the mock matrix doesn't already give us.
- **Cleanup runs in `finally`.** Teams (and the issues that cascade with them) are deleted after every real test. Users persist — there is no `/auth/delete` route — which is one more reason to use a local D1.

## Limitations and known gaps

- **No user delete.** Real-mode runs accumulate user rows. Wipe the local D1 periodically (`wrangler d1 execute issue-tracker-db --local --file=./schema.sql` re-runs the schema and drops nothing; to reset, delete `.wrangler/state/v3/d1/`).
- **LLM behavior is bypassed.** Real-mode issue creation forces `test_mode=true` for predictability. Live LLM enrichment is not covered by either suite.
- **Drag-to-resize divider** and **file attachment upload** are not covered in either mode.
- **Notification dropdown UI** is commented out in `tracker.html`. Only the localStorage layer is tested.
- **Theme FOUC script** runs before module scripts; covered indirectly via the dark-mode persistence test.

## Regressions covered

- **Duplicate-account signup error copy** (`auth.spec.js`, `auth.real.spec.js`): signup.js once used `err.message.includes('409')` to detect duplicates, which broke when the backend changed wording. The tests assert the friendly banner appears and the generic "Sign-up failed" fallback/raw status never appears for a 409 response.
- **Signed-out users reaching `teams.html`** (`navigation.spec.js`, `navigation.real.spec.js`): the root-redirect test now requires the URL to end on `login.html` with the redirect param preserved.
