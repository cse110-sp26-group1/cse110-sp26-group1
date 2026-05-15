# Auth Reference Sheet

## How it works

1. User registers → password is hashed and stored in `users` table
2. User logs in → worker verifies password, creates a session token in `sessions` table, returns the token
3. Frontend stores the token in `localStorage`
4. Every protected request sends the token in the `Authorization` header
5. Worker verifies the token and extracts the `user_id` from it
6. User logs out → session token is deleted from `sessions` table

---

## Protecting a route

Import `requireAuth` and call it at the top of any method block that needs a logged-in user.

```js
import { requireAuth } from '../src/lib/auth.js';

export async function handleSomething(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'POST') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error; // automatically returns 401 if not logged in

        // auth.userId is the verified logged-in user's ID
        // use it instead of anything the client sends as their identity
    }
}
```

---

## Rules

| Do | Don't |
|---|---|
| Use `auth.userId` for `created_by`, `user_id`, etc. | Trust `body.created_by` or any user ID from the request body |
| Call `requireAuth` at the top of each method block | Call it once at the top of the whole handler (different methods may have different auth requirements) |
| Return `auth.error` immediately if it exists | Ignore the error check |

---

## Auth endpoints (already built — do not duplicate)

| Method | Endpoint | Body | Description |
|---|---|---|---|
| POST | `/auth/register` | `{ username, email, password }` | Create a new user |
| POST | `/auth/login` | `{ email, password }` | Returns `{ token, expires_at }` |
| POST | `/auth/logout` | none (token in header) | Deletes the session |

---

## What the frontend sends

Every protected request must include this header:
```
Authorization: Bearer <token>
```

The token comes from `localStorage` after login:
```js
// after login
localStorage.setItem('token', data.token);

// on every protected request
const token = localStorage.getItem('token');
fetch('http://localhost:8787/...', {
    headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Common use cases

**Using the logged-in user's ID:**
```js
const auth = await requireAuth(request, env);
if (auth.error) return auth.error;

await env.DB.prepare('INSERT INTO issues (created_by, ...) VALUES (?, ...)')
    .bind(auth.userId, ...)
    .run();
```

**Checking if a user belongs to a team before allowing access:**
```js
const auth = await requireAuth(request, env);
if (auth.error) return auth.error;

const member = await env.DB.prepare(
    'SELECT * FROM team_members WHERE user_id = ? AND team_id = ?'
).bind(auth.userId, teamId).first();

if (!member) return Response.json({ error: 'Forbidden' }, { status: 403 });
```

---

## Files

| File | Purpose |
|---|---|
| `src/lib/auth.js` | Shared utilities — import `requireAuth` from here |
| `routes/auth.js` | Login, logout, register endpoint handlers |
| `src/index.js` | Router — `/auth/*` traffic goes to `routes/auth.js` |
