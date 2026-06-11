# Agent Endpoint 

Provides AI agents with direct, authenticated access to the issues table which allows them to read issues for context, create new issues and update issues as they work through a fix. All routes require authentication via a Bearer session token and team membership verification.

---

## GET /agents/:id

Fetches a single issue by its ID, returning all fields so the agent has full context before starting work (stack trace, steps to reproduce, affected files, etc.). Array fields (`tags`, `stack_trace`, `affected_files`) are parsed from their stored JSON strings back into proper arrays.

### Parameters

| Parameter | Type    | Location | Required | Description                        |
|-----------|---------|----------|----------|------------------------------------|
| `id`      | integer | path     | Yes      | The ID of the issue to retrieve. Must be a positive integer. |

### Example Request

```
GET /agents/42 HTTP/1.1
Authorization: Bearer <session_token>
```

### Example Response

```json
{
  "id": 42,
  "team_id": 3,
  "created_by": 7,
  "assigned_to": null,
  "title": "Null pointer on login",
  "description": "App crashes when user submits login form with empty fields.",
  "summary": "Login handler throws null pointer when fields are empty.",
  "status": "Open",
  "priority": "High",
  "category": "Bug",
  "difficulty": "medium",
  "tags": ["authentication", "backend"],
  "entry_point": "src/auth.js",
  "error_type": "NullPointerException",
  "error_message": "Cannot read property of undefined",
  "stack_trace": ["at auth.js:42", "at index.js:10"],
  "affected_files": ["src/auth.js", "src/index.js"],
  "expected_behavior": "User sees a validation error.",
  "actual_behavior": "App crashes entirely.",
  "missing_information": null,
  "steps_to_reproduce": "1. Go to login 2. Submit empty form",
  "hypothesis": "Null check missing in auth handler",
  "token_usage": null,
  "resolution_notes": null,
  "created_at": "2026-05-01T10:00:00.000Z",
  "updated_at": "2026-05-01T10:00:00.000Z"
}
```

**Status codes:** `200` success, `400` invalid ID format, `401` missing/invalid session, `403` not a team member, `404` issue not found.

### Purpose

The agent needs to read the full issue before it can begin working on a fix. This route gives it everything in one call — the description, stack trace, affected files, and any prior hypothesis — so it has complete context without needing multiple requests.

---

## POST /agents

Creates a new issue directly from the agent CLI into the issues table. Unlike the human-facing `POST /issues` endpoint where an LLM enriches a raw description, the agent populates all structured fields itself with full context. The issue appears on the frontend like any human-created issue.

### Parameters

| Parameter            | Type     | Location | Required | Description                                                                 |
|----------------------|----------|----------|----------|-----------------------------------------------------------------------------|
| `team_id`            | integer  | body     | Yes      | The team the issue belongs to. Must be a positive integer.                  |
| `title`              | string   | body     | Yes      | A non-empty title for the issue.                                            |
| `summary`            | string   | body     | No       | A short summary of the issue.                                               |
| `status`             | string   | body     | No       | One of: `Open`, `In Progress`, `Resolved`, `Closed`. Defaults to `Open`.   |
| `priority`           | string   | body     | No       | One of: `Low`, `Medium`, `High`, `Critical`. Defaults to `Medium`.         |
| `category`           | string   | body     | No       | One of: `Bug`, `Feature`, `Task`. Defaults to `Bug`.                       |
| `difficulty`         | string   | body     | No       | Freeform difficulty label (e.g. `easy`, `medium`, `hard`).                 |
| `tags`               | string[] | body     | No       | Array of strings from the allowed tags list.                                |
| `entry_point`        | string   | body     | No       | File or function where the issue originates.                                |
| `error_type`         | string   | body     | No       | The class or type of the error (e.g. `TypeError`).                         |
| `error_message`      | string   | body     | No       | The raw error message string.                                               |
| `stack_trace`        | string[] | body     | No       | Array of stack trace lines.                                                 |
| `affected_files`     | string[] | body     | No       | Array of file paths involved in the issue.                                  |
| `expected_behavior`  | string   | body     | No       | What should have happened.                                                  |
| `actual_behavior`    | string   | body     | No       | What actually happened.                                                     |
| `missing_information`| string   | body     | No       | Any information the agent couldn't determine.                               |
| `steps_to_reproduce` | string   | body     | No       | Steps to reproduce the issue.                                               |
| `hypothesis`         | string   | body     | No       | The agent's hypothesis about the root cause.                                |
| `token_usage`        | integer  | body     | No       | Number of tokens used by the agent for this issue.                          |
| `resolution_notes`   | string   | body     | No       | Notes on how the issue was resolved.                                        |

### Example Request

```
POST /agents HTTP/1.1
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "team_id": 3,
  "title": "Null pointer on login",
  "summary": "Login handler crashes on empty form submission.",
  "status": "Open",
  "priority": "High",
  "category": "Bug",
  "tags": ["authentication", "backend"],
  "entry_point": "src/auth.js",
  "error_type": "TypeError",
  "error_message": "Cannot read property of undefined",
  "stack_trace": ["at auth.js:42", "at index.js:10"],
  "affected_files": ["src/auth.js"],
  "hypothesis": "Null check missing in auth handler",
  "token_usage": 512
}
```

### Example Response

```json
{
  "success": true
}
```

**Status codes:** `201` created, `400` missing/invalid fields, `401` missing/invalid session, `403` not a team member.

### Purpose

Agents running from the CLI need to be able to log issues they discover or are assigned to work on directly into the system, with full structured detail, without going through the human-facing form flow. This ensures agent-created issues appear in the same issues table as human-created ones and are visible to the whole team on the frontend.

---

## PATCH /agents/:id

Updates one or more fields of an existing issue as the agent works through a fix. The agent can update any field **except** immutable record metadata (`id`, `team_id`, `created_by`, `created_at`, `updated_at`) and fields reserved for human input only (`description`, `assigned_to`). `updated_at` is always refreshed automatically on every successful patch.

### Parameters

| Parameter            | Type     | Location | Required | Description                                                                 |
|----------------------|----------|----------|----------|-----------------------------------------------------------------------------|
| `id`                 | integer  | path     | Yes      | The ID of the issue to update. Must be a positive integer.                  |
| `title`              | string   | body     | No       | Updated title. Must be a non-empty string.                                  |
| `summary`            | string   | body     | No       | Updated summary.                                                            |
| `status`             | string   | body     | No       | One of: `Open`, `In Progress`, `Resolved`, `Closed`.                       |
| `priority`           | string   | body     | No       | One of: `Low`, `Medium`, `High`, `Critical`.                               |
| `category`           | string   | body     | No       | One of: `Bug`, `Feature`, `Task`.                                          |
| `difficulty`         | string   | body     | No       | Updated difficulty label.                                                   |
| `tags`               | string[] | body     | No       | Updated array of tag strings from the allowed tags list.                    |
| `entry_point`        | string   | body     | No       | Updated entry point.                                                        |
| `error_type`         | string   | body     | No       | Updated error type.                                                         |
| `error_message`      | string   | body     | No       | Updated error message.                                                      |
| `stack_trace`        | string[] | body     | No       | Updated stack trace lines.                                                  |
| `affected_files`     | string[] | body     | No       | Updated affected file paths.                                                |
| `expected_behavior`  | string   | body     | No       | Updated expected behavior.                                                  |
| `actual_behavior`    | string   | body     | No       | Updated actual behavior.                                                    |
| `missing_information`| string   | body     | No       | Updated missing information.                                                |
| `steps_to_reproduce` | string   | body     | No       | Updated steps to reproduce.                                                 |
| `hypothesis`         | string   | body     | No       | Updated hypothesis.                                                         |
| `token_usage`        | integer  | body     | No       | Updated token count. Must be an integer.                                    |
| `resolution_notes`   | string   | body     | No       | Notes on how the issue was resolved.                                        |

### Blocked Fields

The following fields cannot be updated by the agent and will return a `400` error if included:

`id`, `team_id`, `created_by`, `created_at`, `updated_at`, `description`, `assigned_to`

### Example Request

```
PATCH /agents/42 HTTP/1.1
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "status": "Resolved",
  "hypothesis": "Confirmed: null check was missing at line 42 in auth.js",
  "resolution_notes": "Added null guard before accessing user object.",
  "token_usage": 820
}
```

### Example Response

```json
{
  "success": true
}
```

**Status codes:** `200` success, `400` invalid ID / blocked fields / invalid field values / empty body, `401` missing/invalid session, `403` not a team member, `404` issue not found.

### Purpose

As the agent investigates and works through a fix, it needs to progressively update the issue with what it finds — refining the hypothesis, logging which files are affected, updating the status as it moves from investigation to resolution, and recording how many tokens it consumed. This route allows those incremental updates without letting the agent overwrite human-controlled fields like the original description or who the issue is assigned to.