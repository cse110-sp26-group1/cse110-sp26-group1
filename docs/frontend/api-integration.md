# Frontend API integration

How the frontend talks to the backend API. Backend API helpers live in `frontend/js/api.js`; pages import the helpers they need instead of calling backend endpoints with `fetch` directly.

## API base URL

The production origin is defined in `frontend/js/constants.js`:

```javascript
export const API_BASE = 'https://issue-tracker-api.amorbuks25.workers.dev';
```

At runtime, `resolveApiBase()` picks the origin in this order:

1. `globalThis.__ALLEGRO_API_BASE__` — set by Playwright real-backend tests before module scripts run
2. `localStorage.getItem('allegro_api_base')` — handy for local manual testing
3. `API_BASE` from `constants.js` (production default)

Trailing slashes are stripped. For running a local backend, see [testing.md](./testing.md).

## Authentication

Auth is token-based. After login/registration the backend returns a token, which the frontend stores in `localStorage` under the key **`allegro_token`**.

- **`requireAuth()`** — call on every protected page. Validates the token against `GET /auth/validate`. If the token is missing or invalid, it clears the token and redirects to `login.html?redirect=<current URL>` so the user returns to where they were after signing in.
- **`requireNoAuth()`** — call on auth pages (login/signup). If a token already exists, redirects away.
- **`getPostAuthRedirect()`** — returns the destination after a successful sign-in. It honors the `?redirect=` query param but only if it is same-origin (prevents open redirects); otherwise falls back to `teams.html`.

## The `request()` wrapper

Every endpoint helper goes through `request(endpoint, options)`, which:

- Prepends the resolved API base to the endpoint
- Attaches `Authorization: Bearer <token>` if a token exists
- Sets `Content-Type: application/json` — **unless** the body is `FormData`, in which case the browser sets the multipart boundary itself
- Throws an `Error` on non-2xx responses, using the server's `message`/`error` JSON field when available (falls back to `API Error: <status> <statusText>`). The error also carries a `.status` property so callers can branch on status codes
- Returns `null` for `204 No Content`, otherwise the parsed JSON body

Usage in page scripts:

```javascript
import { fetchIssues, createIssue } from './api.js';

try {
	const issues = await fetchIssues(teamId, { status: 'Open' });
} catch (err) {
	if (err.status === 403) {
		// not a team member
	}
}
```

## Endpoint helpers

### Auth

| Function | Endpoint | Notes |
| --- | --- | --- |
| `login(email, password)` | `POST /auth/login` | Returns `{ token, expires_at, user }` |
| `createAccount(data)` | `POST /auth/register` | Returns `{ token, expires_at, user }` on 201 |

### Teams

| Function | Endpoint | Notes |
| --- | --- | --- |
| `fetchTeams()` | `GET /teams` | All teams the user belongs to, with role |
| `fetchTeam(teamId)` | `GET /teams/:teamId` | |
| `createTeam(data)` | `POST /teams` | Caller becomes first admin |
| `updateTeam(teamId, data)` | `PATCH /teams/:teamId` | Admin only; `team_name` and/or `bio` |
| `deleteTeam(teamId)` | `DELETE /teams/:teamId` | Admin only |
| `leaveTeam(teamId)` | `DELETE /teams/:teamId/leave` | Admins can't leave while other members exist (409); last member leaving deletes the team |

### Team members

| Function | Endpoint | Notes |
| --- | --- | --- |
| `fetchTeamMembers(teamId)` | `GET /teams/:teamId/members` | Requires membership |
| `updateTeamMemberRole(teamId, userId, role)` | `PATCH /teams/:teamId/members/:userId` | Admin only; role is `'admin'` or `'member'` |
| `removeTeamMember(teamId, userId)` | `DELETE /teams/:teamId/members/:userId` | Admin only; use `leaveTeam()` to remove yourself |

### Invites

| Function | Endpoint | Notes |
| --- | --- | --- |
| `fetchInvites()` | `GET /invites` | Pending invites for the current user |
| `fetchInvite(inviteId)` | `GET /invites/:id` | Visible to invitee, inviter, or team admin |
| `createInvite(data)` | `POST /invites` | Admin only; target by `invited_user_id`, `username`, or `email` |
| `inviteToTeam(teamId, data)` | `POST /teams/:teamId/invite` | Alternate route used from team settings |
| `acceptInvite(inviteId)` | `PATCH /invites/:id/accept` | Invitee only; joins the team |
| `rejectInvite(inviteId)` | `PATCH /invites/:id/reject` | Invitee only |
| `deleteInvite(inviteId)` | `DELETE /invites/:id` | Invitee, inviter, or team admin |

### Issues

| Function | Endpoint | Notes |
| --- | --- | --- |
| `fetchIssues(teamId, filters)` | `GET /issues?team_id=X` | Optional filters: `status`, `priority`, `assigned_to`, `category`, `difficulty`, `sort_by`, `order` |
| `fetchIssue(id)` | `GET /issues/:id` | |
| `createIssue(data, testMode)` | `POST /issues` | See below |
| `updateIssue(id, updates)` | `PATCH /issues/:id` | Any subset of patchable fields (title, description, status, priority, tags, assigned_to, etc.) |
| `deleteIssue(id)` | `DELETE /issues/:id` | |

#### Creating issues

`createIssue()` accepts either a plain object (sent as JSON) or `FormData` (multipart). Use `FormData` when attaching `.log`, `.txt`, or `.json` files — the backend reads their text content and appends it to the description automatically. Required fields: `title`, `team_id`, `description`.

The second argument, `testMode`, sets `test_mode` on the payload. When true, the backend skips the LLM enrichment step so tests get predictable output.

## Adding a new endpoint helper

1. Add an exported async function in `frontend/js/api.js` that calls `request()` with the route and method
2. Document it with a JSDoc block: the HTTP route, required role/permissions, and the return shape (see existing helpers for the pattern)
3. If it returns a new object shape, add or extend a `@typedef` at the top of `api.js` (`ApiUser`, `Issue`, `InviteDetail`)
4. Never call backend API endpoints with `fetch` directly from page scripts — always go through `api.js` so auth headers and error handling stay consistent. Direct `fetch` is fine for static assets such as templates or downloadable files.
