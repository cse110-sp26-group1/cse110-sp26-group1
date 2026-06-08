ex pattern to document the sections:
1. the endpoint (this is x endpoint )
2. method and url path and what it does
3. params (e.g. team_id required)
4. example request line like GET /issues/team_id=1?sort_by.... HTTP/1.1
5. example response
6. explain purpose/why we need this path
7. repeat for all

## 1. POST /teams
- **This is the create team endpoint**
- **Method and URL Path:** POST /teams - creates a new team workspace
- **Params:** team_name (required, string), bio (optional, string)
- **Example Request:** 
POST /teams HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
"team_name": "Backend Team",
"bio": "Building the core API"
}

text
- **Example Response (201 Created):**
```json
{
  "success": true,
  "team_id": 1
}
Purpose: Allows authenticated users to create new team workspaces.

2. GET /teams
This is the list user teams endpoint

Method and URL Path: GET /teams - returns all teams the user belongs to

Params: None

Example Request:

text
GET /teams HTTP/1.1
Authorization: Bearer <token>
Example Response (200 OK):

json
[
  {
    "id": 1,
    "team_name": "Backend Team",
    "bio": "Building the core API",
    "role": "admin",
    "created_at": "2026-01-15T10:30:00Z"
  }
]
Purpose: Populates the team list in the UI.

3. GET /teams/:teamId
This is the get single team endpoint

Method and URL Path: GET /teams/{teamId} - returns details for a specific team

Params: teamId (path, required)

Example Request:

text
GET /teams/1 HTTP/1.1
Authorization: Bearer <token>
Example Response (200 OK):

json
{
  "id": 1,
  "team_name": "Backend Team",
  "bio": "Building the core API",
  "role": "admin",
  "created_at": "2026-01-15T10:30:00Z"
}
Purpose: Used when opening a team workspace.

4. PATCH /teams/:teamId
This is the update team endpoint

Method and URL Path: PATCH /teams/{teamId} - updates team information

Params: teamId (path, required), team_name (body, required)

Example Request:

text
PATCH /teams/1 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "team_name": "New Team Name"
}
Example Response (200 OK):

json
{
  "success": true,
  "message": "Team renamed"
}
Purpose: Allows team admins to rename their team.

5. DELETE /teams/:teamId
This is the delete team endpoint

Method and URL Path: DELETE /teams/{teamId} - permanently deletes a team

Params: teamId (path, required)

Example Request:

text
DELETE /teams/1 HTTP/1.1
Authorization: Bearer <token>
Example Response (200 OK):

json
{
  "success": true,
  "message": "Team deleted"
}
Purpose: Allows team admins to remove a team.

6. GET /teams/:teamId/members
This is the list team members endpoint

Method and URL Path: GET /teams/{teamId}/members - returns all members of a team

Params: teamId (path, required)

Example Request:

text
GET /teams/1/members HTTP/1.1
Authorization: Bearer <token>
Example Response (200 OK):

json
[
  {
    "id": 1,
    "username": "alex",
    "email": "alex@example.com",
    "first_name": "Alex",
    "last_name": "Smith",
    "role": "admin"
  }
]
Purpose: Displays team roster in the UI.

7. DELETE /teams/:teamId/members/:userId
This is the remove team member endpoint

Method and URL Path: DELETE /teams/{teamId}/members/{userId} - removes a member from a team

Params: teamId (path, required), userId (path, required)

Example Request:

text
DELETE /teams/1/members/12 HTTP/1.1
Authorization: Bearer <token>
Example Response (200 OK):

json
{
  "success": true,
  "message": "Member removed"
}
Purpose: Allows team admins to remove members.

8. DELETE /teams/:teamId/leave
This is the leave team endpoint

Method and URL Path: DELETE /teams/{teamId}/leave - lets a user leave a team

Params: teamId (path, required)

Example Request:

text
DELETE /teams/1/leave HTTP/1.1
Authorization: Bearer <token>
Example Response (200 OK):

json
{
  "success": true,
  "message": "Left team"
}
Purpose: Allows users to leave teams.

9. POST /teams/:teamId/invite
This is the team invite endpoint

Method and URL Path: POST /teams/{teamId}/invite - creates an invite for a user

Params: teamId (path, required), and one of: invited_user_id, username, or email

Example Request:

text
POST /teams/1/invite HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "jamie"
}

Example Response (201 Created):

json
{
  "success": true,
  "invite_id": 1
}