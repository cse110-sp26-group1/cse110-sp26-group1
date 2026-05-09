# Invite System MVP Update

## First: Motivation

Why do we need an invite system? Well since we completely forgot till recently about users being in teams
and workspaces, we also forgot the invite system. We need a system for users to create a team and its workspace and
invite people to that team and workspace.

## Current Plan

There are a couple of approaches to the invite system:

-   direct add, which adds a user instantly
-   an invite system

There’s also:

-   inviting existing users only
-   inviting by email

Inviting by email is far more complicated since it becomes a real auth/onboarding system involving:

-   email infrastructure
-   verification
-   token handling
-   account creation flow
-   onboarding edge cases

That could be considered a stretch goal later, so ignore invites by email for now.

---

## UI / UX Team Considerations

The current prototype/UI assumptions were mostly built around already being inside a workspace/team automatically. Since we are now introducing explicit teams/workspaces and invites, the UI team will likely need to reconsider overall workspace navigation and onboarding flow.

Some things to consider:

-   workspace/team switching
-   creating teams/workspaces
-   inviting users to teams
-   viewing pending invites
-   accepting/declining invites
-   displaying current workspace context clearly

This will likely move the application structure closer to systems like:

-   Jira
-   Linear
-   GitHub organizations/workspaces

where users are not just dropped directly into issues, but instead:

-   belong to one or more workspaces
-   navigate between workspaces
-   manage team membership
-   access workspace-specific issue views

This probably means the UI may eventually need:

-   a workspace/team sidebar
-   workspace switcher dropdown
-   team settings/invite pages
-   invite notification or pending invite UI

## The original prototype can still work as a base, but now needs to account for multi-workspace/team navigation and invite flows rather than assuming the user is already inside a single workspace context.

## Backend Considerations

Some backend considerations include:

-   lifecycle of an invite:

    -   `pending`
    -   `accepted`
    -   `declined`
    -   potentially later:
        -   `expired`
        -   `revoked`

-   preventing duplicate pending invites
-   preventing invites for users already in a team
-   keeping invites as pending relationships rather than actual `team_members` relationships yet, to keep the backend model clean

---

## MVP Decision

For our current MVP/prototype deadline, we’re thinking of using:

-   an invite system for existing users only
-   invite acceptance handled in-app rather than through email

This lets us avoid implementing:

-   email delivery infrastructure
-   external invite links/tokens
-   email verification flows
-   onboarding edge cases for users without accounts

while still keeping the architecture extensible enough to support email invites later if desired.

---

## Rough MVP Flow

```
→ A user sends invite to existing user
→ invite stored in invites table with pending status
→ invited user sees pending invite in-app
→ user accepts or declines
→ if accepted, create team_members relationship (update a lot of the necessary tables), else the invite is rejected (handled by DELETE in an endpoint)
→ update invite status
```

---

## Backend/API Notes

Additions for backend:

-   an `invites` table
-   invite-related endpoints
-   authentication/authorization checks for invite actions

Current proposed invite endpoints:

```
GET    /invites
→ get pending invites for authenticated user

POST   /invites
→ create/send invite

DELETE /invites/:id
→ reject/cancel invite
```

Separate accept endpoint:

```text
POST /invites/:id/accept
```

The first three are standard CRUD-style operations, while accepting an invite is treated separately since it:

-   updates invite state
-   creates a `team_members` relationship and updates other relevant tables
-   modifies team membership state
