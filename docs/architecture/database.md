# Database Architecture

This document explains the database structure used by Allegro AIT and the relationships between entities.

## Overview

### References

- [schema file](../../issue-tracker-api/schema.sql)

---

## Tables

---

### users

```
- id
- username
- first_name
- last_name
- email
- password_hash
- created_at
```

#### Purpose

Stores account and authentication information for every user.

Users are the core identity entity in the system and are referenced throughout issue tracking, team membership, invites, and agent activity.

#### Notes

- usernames and emails are globally unique
- password hashes are stored instead of plaintext passwords (follows from our authentication handling)
- users may belong to multiple teams through the `team_members` join table
- users can create issues, receive invites (or assign if user is a team admin), and be assigned issues

#### Design Reasoning

We wanted the onboarding for creating an account and logging in to be as familiar to users as possible, with stricter enforcements on usernames to make it easier to work with on our part. 

---

### teams

```
- id
- team_name
- bio
- created_at
```

#### Purpose

Teams represent an isolated workspace seen across most collaborative platforms, like a Slack Workspace or a GitHub Repository. This ensures that teams are fully separate and have no access to another's workspace info. 

### Notes

- team names aren't unique as it's possible people come up with the same names
- the `bio` field allows us to have some sort of short description/motto relevant to the team meant to be viewable from the main teams page

#### Design Reasoning

We initially forgot to account for users, workspaces, and other features critical for a seamless working environment. We made sure to account for the basic functional requirements in a collaborative issue tracking software. 

---

### team_members

```
- team_id
- user_id
- role
```

#### Purpose

Acts as the join table between users and teams.

This table is responsible for defining which users belong to which workspace, as well as what permissions they have within that workspace.

#### Notes

- uses a composite primary key (`team_id`, `user_id`) to prevent duplicate memberships
- currently supports two roles:
  - `admin`
  - `member`
- team admins are allowed to:
  - invite users
  - remove members
  - rename/delete teams
  - leave team only if they are the only team member (note to self: need to handle them leaving as only member if there are pending invites to the team)
- standard members have restricted permissions

#### Design Reasoning

We separated memberships into their own table instead of storing users directly inside teams because users may belong to multiple workspaces simultaneously.

This structure also gives us flexibility for future role expansion and cleaner authorization checks throughout backend routes.

---

### issues

```
- id
- team_id
- created_by
- assigned_to
- title
- description
- summary
- status
- priority
- difficulty
- category
- tags
- entry_point
- error_type
- error_message
- stack_trace
- affected_files
- expected_behavior
- actual_behavior
- missing_information
- steps_to_reproduce
- hypothesis
- token_usage
- resolution_notes
- created_at
- updated_at
```

#### Purpose

Represents the core work item within the issue tracking system.

Issues store information based on organized input from the LLM layer (have LLM team possibly revise this), and updates from agent interactions with issues.

#### Notes

- every issue belongs to exactly one team
- issues may optionally be assigned to a user
- issue filtering and sorting are heavily dependent on fields like:
  - status
  - priority
  - category
  - assigned_to
  - difficulty
- many fields are specifically designed to support agent workflows and debugging analysis

#### Design Reasoning

We intentionally designed the issue schema to be more verbose than a traditional task tracker because our platform is centered around AI-assisted debugging and issue analysis rather than only lightweight task management.

Fields like `stack_trace`, `hypothesis`, `affected_files`, and `missing_information` allow integrations with LLMs and autonomous agents to reason about issues more effectively.

This allows us to choose when to display data for readability to humans in the UI vs when to include more verbose fields for agents.

---

### invites

```
- id
- team_id
- inviter_user_id
- invited_user_id
- status
- created_at
```

#### Purpose

Handles invitations between users and teams.

This table allows teams to safely onboard new members while ensuring workspace access remains permission-controlled.

#### Notes

- invite statuses currently include:
  - `pending`
  - `accepted`
  - `declined`
- only admins can create or cancel invites
- only the invited user can accept or reject an invite
- prevents duplicate pending invites for the same user/team combination

#### Design Reasoning

We chose an invite-based system rather than open team joining because issue workspaces may contain sensitive information. Separating invites into their own table also preserves invitation history and allows future support for notifications, expiration windows, or invite links.

We currently only support invites to existing users, with invite-by-email as a stretch goal.

---

### sessions

```
- id
- user_id
- token
- expires_at
- created_at
```

#### Purpose

Stores authenticated login sessions for users.

Sessions are used to verify identity across protected backend routes without requiring users to repeatedly log in.

#### Notes

- tokens are unique per session stored on the user's browser via localStorage
- sessions are tied directly to a user account
- expired sessions are rejected during authentication checks
- authentication middleware validates sessions before protected endpoints execute

#### Design Reasoning

We chose session-based authentication because it is reliable, secure, and appropriate for our current application scale.

Using persistent sessions also simplifies communication between the frontend, backend, and future CLI tooling where authenticated agents may act on behalf of users through authorized session tokens.