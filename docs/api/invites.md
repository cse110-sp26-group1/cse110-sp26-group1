ex pattern to document the sections:
1. the endpoint (this is x endpoint )
2. method and url path and what it does
3. params (e.g. team_id required)
4. example request line like GET /invites HTTP/1.1
5. example response
6. explain purpose/why we need this path
7. repeat for all

## 1. GET /invites
- **This is the list pending invites endpoint**
- **Method and URL Path:** GET /invites - returns all pending invites for the authenticated user
- **Params:** None (uses auth token from header)
- **Example Request:**
```
GET /invites HTTP/1.1
Authorization: Bearer <token>
```
- **Example Response (200 OK):**
```json
[
  {
    "id": 1,
    "team_id": 5,
    "team_name": "Backend Team",
    "inviter_user_id": 10,
    "inviter_username": "alex",
    "invited_user_id": 12,
    "status": "pending",
    "created_at": "2026-01-15T10:30:00Z"
  }
]
```
- **Purpose:** Displays notification badges and pending invite lists in the UI. Only shows 'pending' status invites.

## 2. GET /invites/:id
- **This is the get single invite endpoint**
- **Method and URL Path:** GET /invites/{id} - returns a specific invite by ID
- **Params:** id (path, required) - the invite ID
- **Example Request:**
```
GET /invites/1 HTTP/1.1
Authorization: Bearer <token>
```
- **Example Response (200 OK):**
```json
{
  "id": 1,
  "team_id": 5,
  "team_name": "Backend Team",
  "inviter_user_id": 10,
  "inviter_username": "alex",
  "invited_user_id": 12,
  "status": "pending",
  "created_at": "2026-01-15T10:30:00Z"
}
```
- **Purpose:** Used when a user clicks an invite notification to see full details before accepting/declining. Accessible by inviter, invitee, or team admin.

## 3. POST /invites
- **This is the create invite endpoint**
- **Method and URL Path:** POST /invites - creates a new pending invite
- **Params:** team_id (required), and one of: invited_user_id, username, or email
- **Example Request:**
```
POST /invites HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "team_id": 5,
  "username": "jamie"
}
```
- **Example Response (201 Created):**
```json
{
  "success": true,
  "invite_id": 1
}
```
- **Purpose:** Allows team admins to invite new members. Supports inviting by user ID, username, or email.

## 4. PATCH /invites/:id/accept
- **This is the accept invite endpoint**
- **Method and URL Path:** PATCH /invites/{id}/accept - accepts a pending invite and adds user to team
- **Params:** id (path, required) - the invite ID
- **Example Request:**
```
PATCH /invites/1/accept HTTP/1.1
Authorization: Bearer <token>
```
- **Example Response (200 OK):**
```json
{
  "success": true,
  "message": "Invite accepted"
}
```
- **Purpose:** Allows invited users to join a team. Only the invited user can accept.

## 5. PATCH /invites/:id/reject
- **This is the reject invite endpoint**
- **Method and URL Path:** PATCH /invites/{id}/reject - declines a pending invite
- **Params:** id (path, required) - the invite ID
- **Example Request:**
```
PATCH /invites/1/reject HTTP/1.1
Authorization: Bearer <token>
```
- **Example Response (200 OK):**
```json
{
  "success": true,
  "message": "Invite declined"
}
```
- **Purpose:** Allows users to decline team invitations.

## 6. DELETE /invites/:id
- **This is the cancel invite endpoint**
- **Method and URL Path:** DELETE /invites/{id} - cancels/deletes a pending invite
- **Params:** id (path, required) - the invite ID
- **Example Request:**
```
DELETE /invites/1 HTTP/1.1
Authorization: Bearer <token>
```
- **Example Response (200 OK):**
```json
{
  "success": true
}
```
- **Purpose:** Allows invite senders or team admins to cancel pending invites.

## 7. POST /teams/:teamId/invite
- **This is the team invite endpoint (alternative)**
- **Method and URL Path:** POST /teams/{teamId}/invite - creates an invite from within a team workspace
- **Params:** teamId (path, required), and one of: invited_user_id, username, or email
- **Example Request:**
```
POST /teams/5/invite HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "jamie"
}
```
- **Example Response (201 Created):**
```json
{
  "success": true,
  "invite_id": 1
}
```
- **Purpose:** Convenience endpoint for admins already viewing the team page.