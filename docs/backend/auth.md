# Authentication and Authorization

How the auth middleware works and how to use it. Source: `issue-tracker-api/src/lib/auth.js` — the middleware layer that exposes `requireAuth`, which every protected route calls to verify the session before doing anything else. For endpoint details see [`docs/api/auth.md`](../api/auth.md).

---

## How it works

1. User registers → password is hashed and stored in `users`, a session is created immediately, token + user object returned
2. User logs in → worker verifies password, cleans up expired sessions, creates a new session token, returns token + user object
3. Frontend stores the token and user info in `localStorage`
4. On every page load, frontend calls `GET /auth/validate` to confirm the session is still active
5. Every protected request sends the token in the `Authorization: Bearer <token>` header
6. Worker verifies the token via `requireAuth` and extracts `user_id` from the session row
7. User logs out → session token is deleted from the `sessions` table

---

## Session model

- A session is a row in the `sessions` table with a `token` (UUID), `user_id`, and `expires_at` timestamp.
- Sessions expire after **168 hours (7 days)** of inactivity, defined by `SESSION_TTL_HOURS` in `src/lib/auth.js`.
- There is no automatic refresh. The frontend should call `GET /auth/validate` on page load and redirect to login on a 401.
- Expired sessions are cleaned up lazily: on each login, all expired sessions for that user are deleted.

---

## Protecting a route

Import `requireAuth` and call it at the top of your handler block:

```js
import { requireAuth } from '../src/lib/auth.js';

if (url.pathname === '/your-route' && method === 'GET') {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.error; // returns a 401 Response automatically

  // auth.userId is now available — use it to scope DB queries
  const data = await env.DB.prepare('SELECT * FROM things WHERE user_id = ?')
    .bind(auth.userId)
    .all();

  return Response.json(data.results);
}
```

`requireAuth` reads the `Authorization: Bearer <token>` header, looks up the session in D1, and returns either `{ userId }` on success or `{ error: Response }` on failure. Always use `auth.userId` to identify the acting user — never trust an ID from the request body.

---

## Rules

| Do | Don't |
|---|---|
| Use `auth.userId` for `created_by`, `user_id`, etc. | Trust `body.created_by` or any user ID from the request body |
| Call `requireAuth` at the top of each method block | Call it once at the top of the whole handler — different methods may have different auth requirements |
| Return `auth.error` immediately if it exists | Ignore the error check |

---

## Password hashing

Passwords are hashed with **PBKDF2-SHA256** using the Web Crypto API (no external dependencies). The stored value is a colon-separated hex string: `<saltHex>:<hashHex>`.

| Function | Purpose |
|---|---|
| `hashPassword(password)` | Hashes a plaintext password, returns `"<saltHex>:<hashHex>"` |
| `verifyPassword(password, stored)` | Returns `true` if plaintext matches the stored hash |

These are only called inside `routes/auth.js` (register and login). You should not need to call them directly in other routes.

---

## Utility reference

| Export | Signature | Returns |
|---|---|---|
| `requireAuth` | `(request, env)` | `Promise<{ userId } \| { error: Response }>` |
| `hashPassword` | `(password: string)` | `Promise<string>` — `"<saltHex>:<hashHex>"` |
| `verifyPassword` | `(password: string, stored: string)` | `Promise<boolean>` |
| `sessionExpiresAt` | `()` | `string` — ISO 8601 timestamp 168 hours from now |

---

## Frontend token storage and usage

After a successful login or register, store the token and user fields from the response:

```js
localStorage.setItem('token', data.token);
localStorage.setItem('username', data.user.username);
localStorage.setItem('email', data.user.email);
localStorage.setItem('first_name', data.user.first_name);
localStorage.setItem('last_name', data.user.last_name);
```

On every protected request, attach the token as a Bearer header:

```js
const token = localStorage.getItem('token');
fetch('http://localhost:8787/...', {
    headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Related documentation

- [Auth endpoints](../api/auth.md) — endpoint request/response reference
- [API routing](./routes.md) — how routing and CORS work