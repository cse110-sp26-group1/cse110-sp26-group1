# API routing

High-level overview of how the Worker routes HTTP requests. Per-endpoint details live in `[docs/api/](../api/)`. Step-by-step guide for adding routes: `[issue-tracker-api/ROUTES.md](../../issue-tracker-api/ROUTES.md)`.

---

## Overview

All traffic goes through `[issue-tracker-api/src/index.js](../../issue-tracker-api/src/index.js)`. It handles CORS/`OPTIONS`, matches the URL prefix, and delegates to a handler in `issue-tracker-api/routes/`. Handlers return JSON via `Response.json()`.

---

## Routing pattern

1. **Prefix mount** in `index.js`, e.g. `path.startsWith('/teams')` → `handleTeams(request, env)`.
2. **Handler file**:  one file per resource (`auth.js`, `teams.js`, `issues.js`, `invites.js`, `agent.js`).
3. **Inside the handler**: branch on `request.method`, `url.pathname`, and sometimes path segments or query params (e.g. `/teams/:id/members`).
4. **Response**: always returned through `withCors(...)` from `index.js` so the frontend can call the API from allowed origins.


| Prefix     | Handler             | Role                                |
| ---------- | ------------------- | ----------------------------------- |
| `/auth`    | `routes/auth.js`    | Register, login, logout             |
| `/teams`   | `routes/teams.js`   | Teams, members, leave               |
| `/invites` | `routes/invites.js` | Invites list, accept/reject, cancel |
| `/issues`  | `routes/issues.js`  | Issue CRUD, filters, LLM on create  |
| `/agents`  | `routes/agent.js`   | Issue CRUD for agent interactions   |


Unmatched paths → `404`. There is no global auth middleware so each protected route calls `requireAuth` itself.

---

## Authorization flow

1. **Public:** `POST /auth/register`, `POST /auth/login` (no token).
2. **Login** creates a row in `sessions` and returns a `token`.
3. **Protected routes** call `requireAuth` from `[src/lib/auth.js](../../issue-tracker-api/src/lib/auth.js)`, which reads `Authorization: Bearer <token>`, looks up `sessions`, and returns `{ userId }` or a `401` response.
4. **Logout** deletes the session row.

Handlers should use `auth.userId` for “who is acting,” not IDs from the request body. Team-scoped actions also check `team_members` (admin vs member). See [AUTH.md](../../issue-tracker-api/AUTH.md) and [auth.md](./auth.md).

---

## Design reasoning

- **Single router file** — keeps CORS and mount points in one place; resource logic stays in `routes/` and is easier to review in PRs.
- **Prefix routing** — simple and enough for REST, helps us organize all required functionality for our UI and agent interactions.

---

## Related docs (update this later on)

- [Backend setup](./setup.md)
- [ROUTES.md](../../issue-tracker-api/ROUTES.md) — add a new route
- [AUTH.md](../../issue-tracker-api/AUTH.md) — protect a route

