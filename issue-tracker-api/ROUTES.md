# Adding a New Route

## Overview

`src/index.js` is the router — it receives every request and directs it to the right handler. If you're adding a new resource (e.g. teams, invites), you need to:

1. Create your handler in `routes/your-route.js`
2. Register it in `src/index.js`

You do not need to touch CORS, the DB binding, or anything else in `index.js`.

---

## Step 1 — Create your route handler

Create `routes/teams.js` (or whatever your resource is):

```js
import { requireAuth } from '../src/lib/auth.js';

export async function handleTeams(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'GET') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const { results } = await env.DB.prepare('SELECT * FROM teams').all();
        return Response.json(results);
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
}
```

---

## Step 2 — Register it in src/index.js

Add two lines — the import at the top and the route in the fetch handler:

```js
// 1. Import at the top
import { handleTeams } from '../routes/teams.js';

// 2. Add the route inside fetch(), alongside the existing ones
if (path.startsWith('/teams')) {
    return withCors(await handleTeams(request, envWithDb), request);
}
```

That's it. `withCors` and `envWithDb` are already set up — just follow the same pattern as `/auth` and `/issues`.

---

## Rules

| Do | Don't |
|---|---|
| Follow the `withCors(await handleX(request, envWithDb), request)` pattern | Return a response directly without `withCors` — the browser will block it |
| Add your route before the final `Not Found` return | Add it after — it will never be reached |
| Use `env.DB` for database access | Create your own DB connection |
| Import `requireAuth` from `src/lib/auth.js` for protected routes | Re-implement auth logic yourself |

---

## What index.js handles for you (don't touch these)

- CORS headers on every response
- `OPTIONS` preflight requests
- Mapping `env.issue_tracker_db` to `env.DB`

---

## Files

| File | Purpose |
|---|---|
| `src/index.js` | Router — register new routes here |
| `routes/` | One file per resource (issues, auth, teams, etc.) |
| `src/lib/auth.js` | Auth middleware — see `AUTH.md` |
| `DB.md` | How to query the database |
| `AUTH.md` | How to protect routes |
