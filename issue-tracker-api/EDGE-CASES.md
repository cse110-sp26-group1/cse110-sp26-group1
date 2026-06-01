# Auth Edge Cases

## Handled (no action needed)

| Case | Behavior |
|---|---|
| Computer sleeps / user away | Token persists in localStorage, session still valid on return. If session expiry passed, user gets 401 and must log in again. |
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

**~~2. No password complexity rules~~** ✓ Fixed
Minimum 8 character length is enforced in the register handler. Whitespace-only passwords are also rejected.

**3. No token refresh**
When the session expires the user gets a 401 with no warning. No silent refresh flow exists yet.
- Fix: add a `POST /auth/refresh` endpoint that extends `expires_at` on the existing session. Frontend calls it once per calendar day on page load.

**~~4. Expired session rows accumulate~~** ✓ Fixed
On each login, all expired sessions for that user are deleted before the new session is inserted.

---

## Acceptable to ignore (low risk for this project)

| Case | Why it's fine |
|---|---|
| Concurrent login race condition | Two simultaneous logins from same user could insert two sessions. Extremely unlikely at this scale. |
| Multiple active sessions per user | A user logged in on two devices has two session rows. Harmless — both expire naturally. |


---

Testing TODO:

2. Login — login token is separate from register token — when a user registers and then logs in, there should be 2 sessions in the DB. Currently we don't verify that login creates a new session rather than reusing the existing one.
3. Logout — only deletes the correct session — if a user has multiple sessions and logs out of one, the others should remain. Not tested.