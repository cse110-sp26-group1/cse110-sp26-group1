# API routing

High-level overview of how the Worker routes HTTP requests. Per-endpoint details live in `[docs/api/](../api/)`.

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
| `/auth`    | `routes/auth.js`    | Register, login, logout, validate   |
| `/teams`   | `routes/teams.js`   | Teams, members, leave               |
| `/invites` | `routes/invites.js` | Invites list, accept/reject, cancel |
| `/issues`  | `routes/issues.js`  | Issue CRUD, filters, LLM on create  |
| `/agents`  | `routes/agent.js`   | Issue CRUD for agent interactions   |


Unmatched paths → `404`. There is no global auth middleware so each protected route calls `requireAuth` itself.

`src/index.js` also aliases `env.issue_tracker_db` (the binding name in `wrangler.jsonc`) to `env.DB` before passing `env` to any handler — which is why every route file uses `env.DB` even though that name doesn't appear in the Cloudflare config.

---

## Authorization flow

1. **Public:** `POST /auth/register`, `POST /auth/login` (no token).
2. **Login** creates a row in `sessions` and returns a `token`.
3. **Protected routes** call `requireAuth` from `[src/lib/auth.js](../../issue-tracker-api/src/lib/auth.js)`, which reads `Authorization: Bearer <token>`, looks up `sessions`, and returns `{ userId }` or a `401` response.
4. **Logout** deletes the session row.

Handlers should use `auth.userId` for “who is acting,” not IDs from the request body. Team-scoped actions also check `team_members` (admin vs member). See [auth.md](./auth.md).

---

## Adding a new route

### Step 1 — Create your route handler

Create `routes/<resource>.js`:

```js
import { requireAuth } from '../src/lib/auth.js';

export async function handleThings(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'GET') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const { results } = await env.DB.prepare('SELECT * FROM things').all();
        return Response.json(results);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
}
```

### Step 2 — Register it in src/index.js

Add two lines — the import at the top and the route in the fetch handler:

```js
// 1. Import at the top
import { handleThings } from '../routes/things.js';

// 2. Add the route inside fetch(), alongside the existing ones
if (path.startsWith('/things')) {
    return withCors(await handleThings(request, envWithDb), request);
}
```

Add your route before the final `Not Found` return or it will never be reached.

### What index.js handles for you — don't touch these

- CORS headers on every response
- `OPTIONS` preflight requests
- Mapping `env.issue_tracker_db` to `env.DB`

---

## Design reasoning

- **Single router file** — keeps CORS and mount points in one place; resource logic stays in `routes/` and is easier to review in PRs.
- **Prefix routing** — simple and enough for REST, helps us organize all required functionality for our UI and agent interactions.

---

## Related documentation

- [Backend setup](./setup.md) — local dev and deployment setup
- [Auth middleware](./auth.md) — how to protect a route
- [Auth endpoints](../api/auth.md) — auth API request/response reference

