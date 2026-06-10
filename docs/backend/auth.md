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

## Edge cases

### Handled

| Case | Behavior |
|---|---|
| Computer sleeps / user away | Token persists in localStorage, session still valid on return. If session expiry passed, user gets 401 and must log in again. |
| User deletes localStorage | Frontend loses token, effectively logged out client-side. Session row expires naturally in DB. No security risk. |
| User opens a second tab | Both tabs share the same localStorage and token. No duplicate session created. |
| User logs in on a different device | Each device gets its own session row. Both valid simultaneously. Logout on one device does not affect the other. |
| Invalid token on logout | Returns 401 instead of false success — `meta.changes === 0` check handles this. |
| Duplicate email on register | Returns 409 — existing user check prevents duplicate accounts. |
| Password complexity | Minimum 8 characters enforced. Whitespace-only passwords rejected. |
| Expired session accumulation | On each login, all expired sessions for that user are deleted before the new session is inserted. |
| Concurrent login race condition | Two simultaneous logins from the same user could insert two sessions. Acceptable at this scale — both expire naturally. |
| Multiple active sessions per user | A user logged in on two devices has two session rows. Harmless — both expire naturally. |

### Not handled

**1. Brute force login attempts**
Nothing stops repeated password guesses against `POST /auth/login`. No rate limiting or account lockout after failed attempts.
- Fix: set up Cloudflare rate limiting, or track failed attempts per email in the DB and lock after N failures.

**2. No account deletion**
There is no endpoint for a user to delete their own account. User rows persist in the DB indefinitely.
- Fix: add a `DELETE /users/me` endpoint that removes the user row and cascades to their sessions and team memberships.

**3. No token refresh**
When the session expires the user gets a 401 with no warning. No silent refresh flow exists.
- Fix: add a `POST /auth/refresh` endpoint that extends `expires_at` on the existing session. Frontend calls it once per calendar day on page load.

---

## Related documentation

- [Auth endpoints](../api/auth.md) — endpoint request/response reference
- [API routing](./routes.md) — how routing and CORS work