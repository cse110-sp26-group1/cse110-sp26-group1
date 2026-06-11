# Issues API Endpoints Reference

This is the comprehensive request and response reference documentation for the `/issues` route prefix. All routes require bearer token validation via an `Authorization: Bearer <token>` header, implement strict multi-tenant tenancy guarantees, and automatically format storage parameters back into proper JavaScript arrays and objects.

---

## Allowed Field Specifications

Before calling data-writing or modifying operations, ensure that field parameters remain strictly bounded within the established application configuration matrices:

- **Statuses (`status`):** `Open`, `In Progress`, `Resolved`, `Closed`
- **Priorities (`priority`):** `Low`, `Medium`, `High`, `Critical`
- **Categories (`category`):** `Bug`, `Feature`, `Task`
- **Difficulties (`difficulty`):** `Easy`, `Medium`, `Hard`, `Unknown`
- **Permitted Tags (`tags`):** `ui`, `backend`, `database`, `authentication`, `performance`, `security`, `testing`, `documentation`, `integration`, `enhancement`, `research`

---

## 1. List Team Issues Endpoint

### Endpoint Description
This is the List Team Issues endpoint. It fetches a filtered and ordered collection of all tracked issue records linked to an explicit team workspace identifier.

### Method and URL Path
`GET /issues`

### Parameter Matrix
- `team_id` *(Query Param, Required, Positive Integer)*: Targets the specific team workspace. Missing or invalid formats short-circuit early with a `400 Bad Request`.
- `status` *(Query Param, Optional, Enum String)*: Filters rows to matching issue statuses.
- `priority` *(Query Param, Optional, Enum String)*: Filters rows to matching priority levels.
- `category` *(Query Param, Optional, Enum String)*: Filters rows by category.
- `difficulty` *(Query Param, Optional, Enum String)*: Filters rows by technical difficulty.
- `assigned_to` *(Query Param, Optional, Positive Integer)*: Filters rows assigned to an explicit user ID.
- `sort_by` *(Query Param, Optional, String)*: Sorts delivery dynamically on valid columns (`id`, `title`, `status`, `priority`, `category`, `difficulty`, `created_at`, `updated_at`, `assigned_to`).
- `order` *(Query Param, Optional, String)*: Sorting direction; accepts `asc` or `desc` (case-insensitive). Defaults to `asc`.

### Example Request Line
```http
GET /issues?team_id=1&status=In+Progress&priority=High&sort_by=title&order=desc HTTP/1.1
Host: localhost
Authorization: Bearer perfect-session-token
```

### Example Response (200 OK)
```json
[
  {
    "id": 12,
    "team_id": 1,
    "created_by": 4,
    "title": "Database Connection Timeout",
    "description": "The connection pool is exhausted under heavy load.",
    "summary": "AI-generated or manual summary context.",
    "status": "In Progress",
    "priority": "High",
    "category": "Bug",
    "tags": ["database", "performance"],
    "difficulty": "Hard",
    "entry_point": "src/db/pool.js",
    "error_type": "TimeoutError",
    "error_message": "Pool connections exhausted",
    "stack_trace": ["TimeoutError: pool exhausted at Connection.acquire..."],
    "affected_files": ["src/db/pool.js"],
    "expected_behavior": "Connections should be released properly back to the pool.",
    "actual_behavior": "Connections leak and exceed maximum limit under concurrency.",
    "missing_information": null,
    "steps_to_reproduce": ["1. Fire 100 concurrent requests", "2. Monitor pool usage"],
    "hypothesis": "Leaking connection handles in async route blocks.",
    "assigned_to": 5,
    "created_at": "2026-06-10T12:00:00.000Z",
    "updated_at": "2026-06-10T14:30:00.000Z"
  }
]
```

### Purpose / Why We Need This Path
Populates active task lists, sprint boards, and logging summaries inside client user interfaces. Dynamic parameter checking appends placeholder criteria safely on a baseline query, providing expansive filtering combinations without exposing the router to text manipulation injection hazards.

## 2. Get a Single Issue Endpoint
### Endpoint Description
This is the Get a Single Issue endpoint. It targets and returns detailed column contents for an individual tracking row based on its unique integer key.

### Method and URL Path
`GET /issues/:id`

### Parameter Matrix
id (Path Param, Required, Positive Integer): Primary auto-incrementing key of the targeted tracking row. Non-integer, zero, or negative formats immediately short-circuit with a 400 Bad Request validation error.

### Example Request Line
```http
GET /issues/12 HTTP/1.1
Host: localhost
Authorization: Bearer perfect-session-token
```

### Example Response (200 OK)
```json
{
  "id": 12,
  "team_id": 1,
  "created_by": 4,
  "title": "Database Connection Timeout",
  "description": "The connection pool is exhausted under heavy load.",
  "summary": "AI-generated or manual summary context.",
  "status": "In Progress",
  "priority": "High",
  "category": "Bug",
  "tags": ["database", "performance"],
  "difficulty": "Hard",
  "entry_point": "src/db/pool.js",
  "error_type": "TimeoutError",
  "error_message": "Pool connections exhausted",
  "stack_trace": ["TimeoutError: pool exhausted at Connection.acquire..."],
  "affected_files": ["src/db/pool.js"],
  "expected_behavior": "Connections should be released properly back to the pool.",
  "actual_behavior": "Connections leak and exceed maximum limit under concurrency.",
  "missing_information": null,
  "steps_to_reproduce": ["1. Fire 100 concurrent requests", "2. Monitor pool usage"],
  "hypothesis": "Leaking connection handles in async route blocks.",
  "assigned_to": 5,
  "created_at": "2026-06-10T12:00:00.000Z",
  "updated_at": "2026-06-10T14:30:00.000Z"
}
```

### Purpose / Why We Need This Path
Provides focused problem context information whenever a user opens an inspector card panel. It enforces strict multi-tenant context barriers, cross-referencing team rosters to reject requests with a 403 Forbidden if an outside authenticated user tries to peek at records belonging to another team workspace context.

## 3. Create a New Issue Endpoint
### Endpoint Description
This is the Create a New Issue endpoint. It ingests task information parameters, hooks into a mid-flight DeepSeek LLM enrichment pass, and inserts the generated task record into database tables.

### Method and URL Path
`POST /issues`

### Parameter Matrix
Accepts either standard JSON payloads (application/json) or multipart form files (multipart/form-data) to facilitate automated system logging alongside manual dashboard creation.

- title (Body/Field, Required, Non-Empty String): High-level issue summary headline.

- description (Body/Field, Required, Non-Empty String): Main core descriptive context or conversational dump.

- team_id (Body/Field, Required, Positive Integer): Hosting team workspace index key.

- status (Body/Field, Optional, Enum String): Defaults to Open if omitted.

- priority (Body/Field, Optional, Enum String): Defaults to Medium if omitted.

- category (Body/Field, Optional, Enum String): Defaults to Bug if omitted.

- difficulty (Body/Field, Optional, Enum String): Auto-inferred by the LLM layer if left empty.

- tags (Body/Field, Optional, Array of Strings / Comma Separated String for Multipart): Keyword links matching permitted lists.

- assigned_to (Body/Field, Optional, Positive Integer): Target assignee engineer identifier. Evaluated mid-flight to guarantee that the assignee holds active membership on the target team context.

- test_mode (Body/Field, Optional, Boolean/String "true"): Disables external DeepSeek AI network clusters to seamlessly output a predictable mock structure for test suite execution.

- attachments (Multipart Field, Optional, Files): Supporting logs or .txt tracking text files. Ingestion processes extract text content from files and append them directly to the user description field before structural parsing occurs.

### Example Request Line
```http
POST /issues HTTP/1.1
Host: localhost
Authorization: Bearer perfect-session-token
Content-Type: application/json

{
  "title": "UI Navbar Overlap",
  "description": "Navigation overlay breaks on narrow mobile dimensions.",
  "team_id": 1,
  "category": "Bug",
  "tags": ["ui"]
}
```
### Example Response (201 Created)
```json
{
  "success": true,
  "id": 42,
  "enriched": {
    "summary": "UI elements rendering out-of-bounds on mobile viewports.",
    "status": "Open",
    "priority": "Medium",
    "category": "Bug",
    "difficulty": "Easy",
    "tags": ["ui"],
    "entry_point": null,
    "error_type": null,
    "error_message": null,
    "stack_trace": [],
    "affected_files": [],
    "expected_behavior": "Navbar collapses responsively.",
    "actual_behavior": "Navbar elements break rendering container grids.",
    "missing_information": null,
    "steps_to_reproduce": ["1. Emulate mobile screen size", "2. Open header layout menu"],
    "hypothesis": "Missing viewport element media bounds in standard stylesheet layers."
  }
}
```
### Purpose / Why We Need This Path
Acts as the central ingestion pipeline for documenting bugs or stories. Passing raw titles, descriptions, and uploaded logs through the AI inference layer automatically extracts fine-grained engineering parameters (such as reproduction workflows, stack structures, hypotheses, and files), saving manual triage overhead.

## 4. Partially Update an Issue Endpoint
### Endpoint Description
This is the Partially Update an Issue endpoint. It mutates specified data parameters on a targeted issue tracking row, while preserving all unmentioned variables intact via safe server-side queries.

### Method and URL Path
`PATCH /issues/:id`

### Parameter Matrix
Expects a JSON object containing at least one valid mutable field parameter to avoid empty resource updates:

- id (Path Param, Required, Positive Integer): Database primary identifier of the targeted row.

- title (Body, Optional, String): Length limit: 1 to 255 characters.

- description (Body, Optional, String): Length limit: 1 to 10,000 characters.

- summary (Body, Optional, String): Length limit: 1 to 5,000 characters.

- status / priority / category / difficulty (Body, Optional, Enum Strings): Securely modifies tracking parameters using verified enum option checks.

- tags (Body, Optional, String Array): Structural array of matching permitted tag elements.

- assigned_to (Body, Optional, Positive Integer): Changes task assignment; evaluated mid-flight to enforce workspace membership group boundaries.

- affected_files (Body, Optional, String Array): Structural files tracking array (Max 25 array file items, max 255 characters per string row path).

- hypothesis / steps_to_reproduce / expected_behavior / actual_behavior / missing_information / attempt_notes / resolution_notes (Body, Optional, Mixed Strings/Arrays): Additional execution variables exposed for user updates or autonomous AI multi-agent interaction loops.

Note: Server-side route handlers generate and enforce the updated_at server timestamp internally; body modifications sent inside client payloads are explicitly disregarded to preserve timeline auditing integrity.

### Example Request Line
```http
PATCH /issues/42 HTTP/1.1
Host: localhost
Authorization: Bearer perfect-session-token
Content-Type: application/json

{
  "status": "In Progress",
  "assigned_to": 5,
  "difficulty": "Easy"
}
```
### Example Response (200 OK)
```json
{
  "success": true
}
```
### Purpose / Why We Need This Path
Powers state changes on interactive user dashboards (such as drag-and-drop Kanban card transitions), collaborative assignment reallocation, and trial notes recorded during automated developer code execution runs. Utilizing SQL COALESCE update statements ensures that updating requests modify only explicit properties sent by the caller, keeping unmentioned elements safely isolated from accidental modification.

## 5. Delete an Issue Endpoint
### Endpoint Description
This is the Delete an Issue endpoint. It purges a specific tracking row entry entirely from database active memory tables.

### Method and URL Path
`DELETE /issues/:id`

### Parameter Matrix
- id (Path Param, Required, Positive Integer): Primary identifier index of the targeted issue row. Missing paths or invalid numeric string characters fail early with a validation 400 Bad Request.

### Example Request Line
```http
DELETE /issues/42 HTTP/1.1
Host: localhost
Authorization: Bearer perfect-session-token
```
### Example Response (200 OK)
```json
{
  "success": true
}
```
### Purpose / Why We Need This Path
Allows users and integration tools to purge duplicate logs, remove test artifacts, or clear out faulty entries securely while keeping tenancy isolation parameters fully verified. Subsequent lookups directed to this identifier return a standard 404 Not Found response.

---

## Standard Error Response Structure

When incoming client request parameters fail validation criteria or violate multi-tenant safety parameters, paths short-circuit operations to return explicit structured JSON error payloads:

| HTTP Status | Error JSON Payload | Trigger Context Case Examples |
| :--- | :--- | :--- |
| **400 Bad Request** | `{"error": "team_id query param required"}` | Omitted mandatory team identifier lookups from list request parameters. |
| **400 Bad Request** | `{"error": "Invalid issue ID format..."}` | Sent non-numeric strings, zeros, or negative numbers into identification path parameters. |
| **400 Bad Request** | `{"error": "Invalid title format. Must be a non-empty string under 256 characters."}` | Passed whitespace-only text strings or text elements breaking character length boundaries. |
| **400 Bad Request** | `{"error": "Invalid assignment. Assignee must be an established member..."}` | Requested initial or patch task distribution targeting a user ID that lacks membership inside that specific team workspace domain boundary. |
| **401 Unauthorized** | `{"error": "Unauthorized"}` / `{"error": "Session expired"}` | Submitted API entry calls with completely omitted session tokens, missing headers, or stale/expired authentication tokens. |
| **403 Forbidden** | `{"error": "Forbidden"}` | Attempted data mutations or resource retrieval inside team domains where the authenticated user does not belong. |
| **404 Not Found** | `{"error": "Issue not found"}` | Triggered lookup requests, deletion steps, or patch loops using an issue identification number missing from D1 tables. |
