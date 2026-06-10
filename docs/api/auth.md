# Auth Endpoints

Handles user registration, login, logout, and session validation. All endpoints are under the `/auth` prefix, routed through `routes/auth.js`.

---

## POST /auth/register

Creates a new user account and returns a session token and user object.

**Request body** (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | string | yes | Trimmed; must be non-empty after trim |
| `email` | string | yes | Trimmed; must be non-empty after trim |
| `password` | string | yes | Min 8 chars; cannot be only whitespace |
| `first_name` | string | yes | Trimmed; must be non-empty after trim |
| `last_name` | string | yes | Trimmed; must be non-empty after trim |

**Example request:**
```
POST /auth/register HTTP/1.1
Content-Type: application/json

{
  "username": "jsmith",
  "email": "jsmith@example.com",
  "password": "hunter42!",
  "first_name": "John",
  "last_name": "Smith"
}
```

**Example response — 201 Created:**
```json
{
  "success": true,
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2026-06-11T18:00:00.000Z",
  "user": {
    "username": "jsmith",
    "email": "jsmith@example.com",
    "first_name": "John",
    "last_name": "Smith"
  }
}
```

**Error responses:**

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "username, email, password, first_name, and last_name are required" }` | Missing field |
| 400 | `{ "error": "Password must be at least 8 characters" }` | Password too short |
| 400 | `{ "error": "Password cannot be only whitespace" }` | Whitespace-only password |
| 400 | `{ "error": "Fields cannot be empty" }` | Field blank after trimming |
| 400 | `{ "error": "Invalid field types" }` | Non-string field value |
| 409 | `{ "error": "Email or username is already in use" }` | Duplicate account |

**Purpose:** Registers a new user and immediately logs them in by returning a session token. The frontend stores this token and sends it as `Authorization: Bearer <token>` on subsequent requests.

---

## POST /auth/login

Authenticates an existing user and returns a new session token and user object.

**Request body** (JSON):

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | Trimmed before lookup |
| `password` | string | yes | Compared against stored PBKDF2 hash |

**Example request:**
```
POST /auth/login HTTP/1.1
Content-Type: application/json

{
  "email": "jsmith@example.com",
  "password": "hunter42!"
}
```

**Example response — 200 OK:**
```json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "expires_at": "2026-06-11T18:00:00.000Z",
  "user": {
    "username": "jsmith",
    "email": "jsmith@example.com",
    "first_name": "John",
    "last_name": "Smith"
  }
}
```

**Error responses:**

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "email and password are required" }` | Missing field |
| 400 | `{ "error": "Invalid field types" }` | Non-string field value |
| 400 | `{ "error": "Email cannot be only whitespace" }` | Whitespace-only email |
| 401 | `{ "error": "Invalid email or password" }` | Wrong credentials or no account |

**Purpose:** Starts a new authenticated session. On login, any expired sessions for the user are automatically deleted. The returned token must be stored by the frontend (e.g. `localStorage`) and sent with every protected request.

---

## POST /auth/logout

Invalidates the current session token.

**Headers:**

| Header | Value | Required |
|---|---|---|
| `Authorization` | `Bearer <token>` | yes |

**Example request:**
```
POST /auth/logout HTTP/1.1
Authorization: Bearer 550e8400-e29b-41d4-a716-446655440000
```

**Example response — 200 OK:**
```json
{ "success": true }
```

**Error responses:**

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "No session provided" }` | Missing or malformed `Authorization` header |
| 401 | `{ "error": "Invalid or already expired session" }` | Token not found in DB |

**Purpose:** Deletes the session row from the database so the token can no longer be used. The frontend should clear its stored token on a successful response.

---

## GET /auth/validate

Checks whether the current session token is still valid.

**Headers:**

| Header | Value | Required |
|---|---|---|
| `Authorization` | `Bearer <token>` | yes |

**Example request:**
```
GET /auth/validate HTTP/1.1
Authorization: Bearer 550e8400-e29b-41d4-a716-446655440000
```

**Example response — 200 OK:**
```json
{ "valid": true }
```

**Error responses:**

| Status | Body | Cause |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | Missing or malformed `Authorization` header |
| 401 | `{ "error": "Invalid session" }` | Token not found in DB |
| 401 | `{ "error": "Session expired" }` | Token found but past its `expires_at` |

**Purpose:** Call this on page load to check whether the stored token is still active before making other API requests. If a 401 is returned, redirect the user to the login page.

---

## Related documentation

- [Auth middleware](../backend/auth.md) — how the auth system works, session model, and protecting routes
- [API routing](../backend/routes.md) — how requests are routed to handlers
