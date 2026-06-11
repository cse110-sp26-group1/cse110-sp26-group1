# Software Quality Characteristics

Examples of the ISO 25010 quality characteristics as they appear in this codebase.

---

## Functional Suitability

The software does what it is supposed to do — features are correct and complete.

**Full issue CRUD with filtering** (`issue-tracker-api/routes/issues.js` lines 120–223)
The GET `/issues` endpoint fetches issues by team and accepts optional query parameters for status, priority, category, difficulty, assigned_to, and sort order. Each filter is validated against an enum before being appended to the query, so callers get back exactly what they ask for without any silent truncation or wrong results.

**User registration flow** (`issue-tracker-api/routes/auth.js` lines 28–101)
POST `/auth/register` validates inputs, hashes the password, inserts the user row, immediately creates a session, and returns a token in a single atomic flow — all in the correct order with the correct status codes (201 on success, 400/409 on client errors).

**Centralized enum definitions** (`frontend/js/constants.js` lines 1–66)
`PRI_ORDER`, `STATUS_NAME`, `CATEGORIES`, `TAGS`, and `DEFAULT_VIEWS` are all exported from one file. The frontend derives every label, sort order, and filter value from these — no magic strings scattered across pages.

---

## Performance Efficiency

The software makes good use of resources — fast responses, no unnecessary work.

**Dynamic query building instead of full-table reads** (`issue-tracker-api/routes/issues.js` lines 145–213)
The base query is `SELECT * FROM issues WHERE team_id = ?` and filters are conditionally appended. No filter means no extra WHERE clause — the DB does the minimum work needed. The ORDER BY column is chosen from a whitelist rather than computed in application code.

**Session table cleanup on login** (`issue-tracker-api/routes/auth.js` lines 127–136)
Before inserting a new session on login, expired sessions for that user are deleted with `DELETE FROM sessions WHERE user_id = ? AND expires_at < datetime('now')`. This keeps the sessions table from growing unbounded without a separate background job.

**In-place notification read without re-render** (`frontend/js/notifications.js` lines 154–162)
Clicking a notification row marks it as read by toggling a CSS class and updating localStorage directly, rather than destroying and rebuilding the list. The badge count is updated separately, so nothing flickers.

---

## Compatibility / Interoperability

The software works with other systems — clean APIs, standard formats, no integration surprises.

**REST API with consistent JSON responses** (`frontend/js/api.js` lines 52–100)
All backend communication goes through a single `request()` function that sets `Authorization: Bearer <token>`, handles `Content-Type` automatically (skips the JSON header for `FormData` so the browser can set the multipart boundary), and normalizes error shapes from any endpoint into a thrown `Error` with a `.status` field.

**CORS origin allowlist** (`issue-tracker-api/src/index.js` lines 40–53)
All responses are wrapped with CORS headers, and the `Origin` is checked against `ALLOWED_ORIGINS` before being reflected. Preflight `OPTIONS` requests return 204 without hitting any route handler.

**Multipart + JSON on the same endpoint** (`issue-tracker-api/routes/issues.js` lines 258–318)
POST `/issues` accepts both `application/json` and `multipart/form-data`. When a `.log` or `.txt` file is attached, the backend reads its text content and appends it to the description automatically — the frontend does not need a separate upload endpoint.

**Open-redirect prevention** (`frontend/js/api.js` lines 34–44)
`getPostAuthRedirect()` reads the `?redirect=` param set by `requireAuth()`, then validates the URL has the same origin before following it. Invalid URLs or cross-origin destinations silently fall through to `teams.html`.

---

## Usability

The software is intuitive and gives users clear feedback.

**Show/hide password toggle with ARIA state** (`frontend/html/login.html`, `frontend/js/view-password.js`)
The eye icon button carries `aria-label="Show password"` and `aria-pressed` — screen readers announce the current state. The toggle swaps the input type between `password` and `text` so the control is keyboard-accessible.

**Form validation with auto-focus** (`frontend/js/login.js` lines 22–46)
Before making an API call, the form checks whether required fields are filled. If a field is empty the cursor moves to it automatically and a custom validation message appears on the input element — users do not have to search for what went wrong.

**Toast feedback with button lockout** (`frontend/js/teams.js` lines 44–49, 66–83)
When a team action is in flight, the triggering button is disabled and its label changes (e.g. "Creating..."). On completion the original label is restored. Success/error toasts are shown for 1.8 s so the user gets confirmation without a page reload.

**Relative timestamps on notifications** (`frontend/js/notifications.js` lines 89–98)
`relativeTime()` converts ISO timestamps to strings like "5m ago" or "2d ago". Notifications with no time context feel stale; this keeps the inbox scannable without showing raw UTC strings.

---

## Reliability

The software stays correct over time and handles unexpected situations gracefully.

**Layered input validation on registration** (`issue-tracker-api/routes/auth.js` lines 34–68)
Validation runs in order: required-field presence → type checks → password length → whitespace-only password → re-check after trim. Each step has its own error message, so callers get a specific, actionable response rather than a generic 400.

**API error handling with status propagation** (`frontend/js/api.js` lines 73–100)
The `request()` wrapper catches non-2xx responses, tries to parse the server's JSON error body, falls back to `statusText`, and attaches the HTTP status code to the thrown `Error` object. Callers can branch on `err.status` (e.g. 401 → redirect to login, 403 → show "access denied") without re-parsing the response themselves.

**localStorage graceful degradation** (`frontend/js/notifications.js` lines 12–22, 28–34)
Both `notifStorageKey()` and `getNotifications()` wrap their `localStorage` and `JSON.parse` calls in `try/catch`. If storage is unavailable or the data is corrupt, the functions return a safe default (`'allegro_notifications_anon'` and `[]` respectively) rather than throwing and breaking the page.

**Session expiry enforced server-side** (`issue-tracker-api/src/lib/auth.js` lines 52–74)
`requireAuth` middleware checks the session expiry date on every request. An expired token is deleted from the DB immediately and a 401 is returned — the client cannot extend a session by replaying an old token.

---

## Security

The software protects user data and prevents unauthorized access.

**PBKDF2 password hashing** (`issue-tracker-api/src/lib/auth.js` lines 13–23)
Passwords are hashed with PBKDF2-SHA256, 100,000 iterations, and a random 16-byte salt using the Web Crypto API (no external dependencies). Only the `<saltHex>:<hashHex>` string is ever stored — plaintext is never written to the database.

**Parameterized queries prevent SQL injection** (`issue-tracker-api/routes/auth.js` line 71, `issue-tracker-api/routes/issues.js` lines 145–213)
Every database query uses `.prepare(...).bind(...)` — user-supplied values are always passed as bound parameters, never interpolated into the query string. For example: `'SELECT id FROM users WHERE email = ? OR username = ?'.bind(email, username)`.

**ORDER BY column whitelist prevents column injection** (`issue-tracker-api/routes/issues.js` lines 200–208)
The `sort_by` parameter is checked against an explicit `allowedSortColumns` array before being placed into the ORDER BY clause. Unknown column names are silently ignored rather than appended to the SQL string.

**Bearer token validation on every protected route** (`issue-tracker-api/src/lib/auth.js` lines 52–74)
`requireAuth` rejects requests with a missing or wrong-scheme `Authorization` header (401), tokens that don't match any session row (401 "Invalid session"), and tokens that have passed their expiry date (401 "Session expired") — three distinct failure paths with distinct messages.

**Team membership enforced before data access** (`issue-tracker-api/src/lib/teams.js`, `issue-tracker-api/routes/issues.js` lines 135–136)
`requireTeamMember()` is called at the top of every team-scoped endpoint. Users who are not members of a team receive a 403 before any data is fetched or modified. Issue assignment additionally validates that the target user is a member of the same team (lines 166–174).

---

## Maintainability

The codebase is easy to understand, modify, and extend.

**Single source of truth for enums** (`frontend/js/constants.js`)
All priority labels, status names, tag lists, and default filter views live in one exported module. Adding a new priority level or tag means editing one file; every page that imports it picks up the change automatically.

**Modular auth and team utilities** (`issue-tracker-api/src/lib/auth.js`, `issue-tracker-api/src/lib/teams.js`)
`hashPassword`, `verifyPassword`, `requireAuth`, and `sessionExpiresAt` are pure functions exported from `auth.js`. `requireTeamMember` and `requireTeamAdmin` are in `teams.js`. Route handlers import only what they need — no auth logic is duplicated across files.

**ESLint with JSDoc enforcement** (`eslint.config.js`)
The linter requires JSDoc on all exported functions, warns on unused variables (with a `^_` prefix escape hatch for intentional ones), enforces strict equality (`===`), and bans `var`. This keeps a consistent style without relying on convention.

**Test helper composition** (`issue-tracker-api/test/issues.spec.js` lines 18–82)
`createTestUser`, `createTestTeam`, `createTestSession`, and `createTeamMembership` are small seeding helpers that compose to set up any scenario in a few lines. Individual test cases describe behavior, not setup boilerplate.

**Centralized routing entry point** (`issue-tracker-api/src/index.js`)
All requests pass through `src/index.js`, which resolves the DB alias, dispatches to the correct handler, and wraps the response with CORS headers. Adding a new route means writing one handler file and one line in the router — nothing else needs to change.
