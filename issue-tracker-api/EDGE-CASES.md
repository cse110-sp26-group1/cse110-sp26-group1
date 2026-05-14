# Auth Edge Cases

## Handled (no action needed)

| Case | Behavior |
|---|---|
| Computer sleeps / user away | Token persists in localStorage, session still valid on return. If 24hr expiry passed, user gets 401 and must log in again. |
| User deletes localStorage | Frontend loses token, effectively logged out client-side. Session row expires naturally in DB after 24hrs. No security risk. |
| User opens a second tab | Both tabs share the same localStorage and token. No duplicate session created. |
| User logs in on a different device | Each device gets its own session row. Both valid simultaneously. Logout on one device does not affect the other. |
| Invalid token on logout | Returns 401 instead of false success — `meta.changes === 0` check handles this. |
| Duplicate email on register | Returns 409 — existing user check prevents duplicate accounts. |

---

## Needs to be fixed

**1. Brute force login attempts**
Nothing stops repeated password guesses against `POST /auth/login`. No rate limiting or account lockout after failed attempts.
- Fix: set up Cloudflare rate limiting, or track failed attempts per email in the DB and lock after N failures.

**2. No password complexity rules**
Any string is accepted as a password — no minimum length, no character requirements enforced server-side.
- Fix: add a minimum length check (e.g. 8 characters) in the register handler in `routes/auth.js`.

**3. No token refresh**
When the 24hr token expires the user gets a 401 with no warning. No silent refresh flow exists.
- Fix: add a refresh token system, or extend the session expiry on each successful `requireAuth` call.

**4. Expired session rows accumulate**
Sessions that expire while the token is lost (deleted localStorage, different device) are never cleaned up unless that token is used in a request. They sit in the DB indefinitely.
- Fix: on each login, delete all expired sessions for that user before inserting the new one:
  `DELETE FROM sessions WHERE user_id = ? AND expires_at < datetime('now')`

---

## Acceptable to ignore (low risk for this project)

| Case | Why it's fine |
|---|---|
| Concurrent login race condition | Two simultaneous logins from same user could insert two sessions. Extremely unlikely at this scale. |
| Multiple active sessions per user | A user logged in on two devices has two session rows. Harmless — both expire naturally. |
