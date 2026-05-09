# Database Tables Example (Revised: Team Workspace Model)

---

## users

-   id
-   username
-   email
-   password_hash
-   created_at

### Purpose

Stores account/login information for each user.

### Example

| id  | username |
| --- | -------- |
| 1   | amormio  |
| 2   | james    |
| 3   | anchita  |

### Example Query

```sql
SELECT *
FROM users
WHERE id = 1;
```

---

## teams

-   id
-   team_name
-   created_at

### Purpose

Represents a workspace (like a GitHub repo).  
Each team is a completely isolated issue space.

### Example

| id  | team_name |
| --- | --------- |
| 10  | Backend   |
| 11  | Design    |

### Example Query

```sql
SELECT *
FROM teams;
```

---

## team_members

-   user_id
-   team_id
-   role

### Purpose

Defines which users belong to which workspace (team).

-   A user can be in multiple teams
-   A team can have multiple users
-   Defines workspace access control (not just filtering)

### Example

| user_id | team_id | role  |
| ------- | ------- | ----- |
| 1       | 10      | admin |
| 2       | 10      | dev   |
| 3       | 11      | dev   |
| 1       | 11      | dev   |

### Meaning

-   amormio → Backend + Design workspaces
-   james → Backend workspace
-   anchita → Design workspace

### Example Queries

**Get all teams for a user:**

```sql
SELECT teams.*
FROM teams
JOIN team_members
ON teams.id = team_members.team_id
WHERE team_members.user_id = 1;
```

**Get all users in a team:**

```sql
SELECT users.*
FROM users
JOIN team_members
ON users.id = team_members.user_id
WHERE team_members.team_id = 10;
```

---

## issues

-   id
-   team_id
-   created_by
-   assigned_to
-   title
-   description
-   summary
-   status
-   priority
-   category
-   tags
-   entry_point
-   error_type
-   error_message
-   stack_trace
-   affected_files
-   expected_behavior
-   actual_behavior
-   missing_information
-   steps_to_reproduce
-   hypothesis
-   token_usage
-   resolution_notes
-   created_at
-   updated_at

### Purpose

Core issue data for a specific team workspace.

### Key Idea

-   Each issue belongs to exactly one team workspace
-   Users only see issues for teams they belong to
-   No cross-team visibility

### Example

| id  | team_id | title              |
| --- | ------- | ------------------ |
| 1   | 10      | Fix login bug      |
| 2   | 11      | Improve UI spacing |

### Example Queries

**Get all issues for a team:**

```sql
SELECT *
FROM issues
WHERE team_id = 10;
```

**Get all issues accessible to a user:**

```sql
SELECT issues.*
FROM issues
JOIN team_members
ON issues.team_id = team_members.team_id
WHERE team_members.user_id = 1;
```

---

## agent_attempts

-   id
-   issue_id
-   agent_attempted_at
-   total_token_usage
-   attempt_number
-   result
-   notes
-   token_usage

### Purpose

Tracks AI agent execution history per issue.

### Example

| id  | issue_id | result  |
| --- | -------- | ------- |
| 1   | 2        | failed  |
| 2   | 2        | success |

### Example Query

```sql
SELECT *
FROM agent_attempts
WHERE issue_id = 2;
```

---

## Key Relationship Model

users → team_members → teams → issues → agent_attempts

---

## Core Concept Summary

-   Team = isolated workspace
-   Users belong to teams via `team_members`
-   Issues are scoped to one team only
-   All access is controlled through team membership
-   Agent attempts store AI execution history per issue
