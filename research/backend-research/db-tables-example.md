# Database Tables

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

---

## teams

-   id
-   team_name
-   created_at

### Purpose

Represents a shared workspace/team.

### Example

| id  | team_name |
| --- | --------- |
| 10  | Backend   |
| 11  | Design    |

---

## team_members

-   user_id
-   team_id
-   role

### Purpose

Maps users to teams.

Allows:

-   multiple users per team
-   users in multiple teams

### Example

| user_id | team_id |
| ------- | ------- |
| 1       | 10      |
| 2       | 10      |
| 3       | 11      |
| 1       | 11      |

### Meaning

-   amormio is in Backend
-   james is in Backend
-   anchita is in Design
-   amormio is ALSO in Design

### Example Query

Get all users in Backend team:

```sql
SELECT users.username
FROM users
JOIN team_members
ON users.id = team_members.user_id
WHERE team_members.team_id = 10;
```

### Result

```txt
amormio
james
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

-   resolution_notes

-   created_at
-   updated_at

### Purpose

Main issue table shared between human UI and agent workflows.

### Notes

-   each issue directly stores `team_id`
-   filtering issues by team becomes simple

### Example Query

```sql
SELECT * FROM issues
WHERE team_id = 10;
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

Stores logs/history for AI agent attempts separately from the main issue table.

Allows multiple attempts per issue.
