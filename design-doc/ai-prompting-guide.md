# AI prompting guide — issue tracker

This document is the **design spec** for AIT prompting and agent integration. It covers (1) the **embedded website AI** that normalizes raw reports into backend JSON, and (2) the **external AI agent** flow over HTTP.

The **canonical** external-agent instructions live in **[Appendix: Issue tracker agent SKILL.md](#appendix-issue-tracker-agent-skillmd)** (Cursor-style skill: YAML frontmatter + markdown body). This repo keeps the spec in this document only; if you use Cursor project skills locally, copy the appendix block into `.cursor/skills/issue-tracker-agent/SKILL.md` on your machine (that path is not tracked here).

---

## Task 1: Embedded AI — raw report → structured issue

**Goal:** Turn a vague user message (e.g. “button not working”) into a strict JSON object the backend can parse without ambiguity.

### LLM API call layout


| Role       | Purpose                                                       |
| ---------- | ------------------------------------------------------------- |
| **System** | Enforce JSON-only output and the schema.                      |
| **User**   | The raw issue text plus a one-line instruction to convert it. |


---

### System prompt

Copy into API as the system message:

```
You are an issue-formatting assistant for a software issue tracker.

Your job is to convert a user's raw issue report into a strict JSON object that the backend can parse.

You must only output valid JSON.
Do not include markdown.
Do not include explanations.
Do not include extra text before or after the JSON.

The JSON must follow this exact schema:

{
  "title": string,
  "summary": string,
  "category": string,
  "priority": string,
  "status": string,
  "user_reported_issue": string,
  "steps_to_reproduce": string[],
  "expected_behavior": string,
  "actual_behavior": string,
  "missing_information": string[],
  "tags": string[]
}

Rules:
- "title" should be short and specific.
- "summary" should explain the issue in 1-2 sentences.
- "category" must be one of: "UI", "Backend", "Database", "Authentication", "Performance", "Integration", "Unknown".
- "priority" must be one of: "Low", "Medium", "High", "Critical".
- "status" must always be "Open".
- "user_reported_issue" must preserve the original user input.
- If the user does not provide enough detail, infer only the safest possible meaning.
- Do not invent technical details.
- Put unknown details in "missing_information".
- "steps_to_reproduce" should be an array. If not enough information is given, include likely generic steps but mark missing details in "missing_information".
- "tags" should be short lowercase keywords.
```

---

### User prompt (template)

Replace `{{RAW_ISSUE}}` with the user’s message (escape quotes in your integration if needed):

```
User reported issue:

"{{RAW_ISSUE}}"

Convert this into the required backend JSON format.
```

**Example — filled user message:**

```
User reported issue:

"button not working"

Convert this into the required backend JSON format.
```

---

### Expected LLM output (example)

For the input `"button not working"`, the model should return **only** this JSON (no surrounding prose):

```json
{
  "title": "Button Not Working",
  "summary": "The user reported that a button is not working, but did not specify which button, where it appears, or what happens when it is clicked.",
  "category": "UI",
  "priority": "Medium",
  "status": "Open",
  "user_reported_issue": "button not working",
  "steps_to_reproduce": [
    "Navigate to the page containing the affected button.",
    "Click the button.",
    "Observe whether the expected action occurs."
  ],
  "expected_behavior": "The button should perform its intended action when clicked.",
  "actual_behavior": "The button does not appear to work when clicked.",
  "missing_information": [
    "Which button is affected",
    "Which page or screen contains the button",
    "What the button is expected to do",
    "What happens when the button is clicked",
    "Browser, device, or environment details",
    "Whether there are any error messages"
  ],
  "tags": [
    "button",
    "ui",
    "click",
    "bug"
  ]
}
```

---

## Task 2: External AI agent (Codex, Cursor, Claude Code, …)

**Goal:** The developer’s own agent uses your **HTTP API** to pull issue context, work in their repo, then **write back** status and notes—similar to running a test command and reading the output.

### Skill specification for agents

**Full spec:** [Appendix: Issue tracker agent SKILL.md](#appendix-issue-tracker-agent-skillmd) (complete YAML + body, examples, and `curl`).

**What it defines:** `AIT_API_BASE` / `AIT_API_TOKEN`, headers, issue JSON fields, REST endpoints, PATCH bodies, recommended agent workflow, and `curl` examples.

### End-to-end flow (four steps)

1. **Human** files or selects work (e.g. “fix issue #4”) in the tracker UI; the issue row exists in your DB.
2. **Human** starts an external agent and gives a high-level instruction, e.g. “Fix open issues from our Agent Issue Tracker; use the API described in the issue-tracker-agent skill.”
3. **Agent** calls the backend (**read path**): list/filter issues, then `GET` by id for full detail. It uses that JSON plus the codebase to implement or narrow the fix.
4. **Agent** calls the backend (**write path**): `PATCH /api/issues/:id` with `status`, `resolution_notes`, and any other fields your API accepts—whether the attempt succeeded, failed, or is blocked.

### REST API summary (contract)

All calls use JSON where applicable and `Authorization: Bearer <AIT_API_TOKEN>`. Full request/response examples and `curl` snippets are in **[Appendix: Issue tracker agent SKILL.md](#appendix-issue-tracker-agent-skillmd)**.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `{AIT_API_BASE}/api/issues` | List issues (`status`, `category`, `tag`, `q`). |
| `GET` | `{AIT_API_BASE}/api/issues/:id` | One issue. |
| `PATCH` | `{AIT_API_BASE}/api/issues/:id` | Post-fix update (`status`, `resolution_notes`, …). |
| `POST` | `{AIT_API_BASE}/api/issues` | Optional create (Task 1 JSON shape, no `id`/timestamps). |

### LLM-facing prompt (what the human pastes to the external agent)

The human sends **one message** that combines the API context and the task. Replace the `{{TASK}}` line with what you actually want the agent to do:

```
You have access to our Agent Issue Tracker API.
- Open design_doc/ai_prompting_guide.md and follow the section titled "Appendix: Issue tracker agent SKILL.md" (anchor: #appendix-issue-tracker-agent-skillmd) for base URL, bearer token env vars, routes, and curl examples.
- List open issues, fetch details for the ones you are asked to fix, implement changes in this repo, run tests if present, then PATCH each issue with honest resolution_notes and the correct status.
- Do not fabricate API responses; use real HTTP results.

Task: {{TASK}}
```

In Markdown preview, use: [Appendix: Issue tracker agent SKILL.md](#appendix-issue-tracker-agent-skillmd) (⌘/Ctrl+click).

**Example (filled):**

```
You have access to our Agent Issue Tracker API.
- Open design_doc/ai_prompting_guide.md and follow the section titled "Appendix: Issue tracker agent SKILL.md" (anchor: #appendix-issue-tracker-agent-skillmd) for base URL, bearer token env vars, routes, and curl examples.
- List open issues, fetch details for the ones you are asked to fix, implement changes in this repo, run tests if present, then PATCH each issue with honest resolution_notes and the correct status.
- Do not fabricate API responses; use real HTTP results.

Task: Fix open UI issues from the tracker (priority High first). Report back on each issue id you touched.
```

### Expected agent behavior (not a single JSON “LLM output”)

Unlike Task 1, the external agent does **not** return one fixed JSON blob to your product LLM. Instead it produces:

- **HTTP GET** responses consumed as context, and
- **HTTP PATCH** bodies that your backend parses and persists.

Treat successful completion as: correct repository changes (if any) **and** tracker rows updated so humans see `resolution_notes` and `status`.

## Appendix: Issue tracker agent SKILL.md

VS Code, Cursor, and GitHub all assign this heading the id `appendix-issue-tracker-agent-skillmd`. Links use `#appendix-issue-tracker-agent-skillmd` (bare anchor) for reliable in-page navigation across all renderers.

The block below is the **full agent skill** (Cursor `SKILL.md` layout). It is authoritative in this design doc. **Optional:** To load it as a Cursor project skill, create `.cursor/skills/issue-tracker-agent/SKILL.md` locally and paste the fenced content (this repo does not commit that file).

**Jump to this section:** [Appendix: Issue tracker agent SKILL.md](#appendix-issue-tracker-agent-skillmd)

````markdown
---
name: issue-tracker-agent
description: >-
  Use when an AI agent must read, filter, or update issues in the Agent Issue
  Tracker (AIT) via its HTTP API — e.g. “fix issues from the tracker,” triage by
  category, or report resolution after a fix attempt.
---

# Agent Issue Tracker — API skill

External agents (Cursor, Codex, Claude Code, etc.) use this skill to call your team’s **issue tracker backend** the same way they might run tests: **HTTP requests** to list issues, load detail, and **push status / resolution** when done.

**Canonical design doc:** `design_doc/ai_prompting_guide.md` (Task 1 embedded schema + appendix `SKILL.md`).

## Configuration

| Variable | Meaning |
| -------- | ------- |
| `AIT_API_BASE` | Origin only, no trailing slash. Example: `https://ait.example.workers.dev` |
| `AIT_API_TOKEN` | Bearer token issued by the project (integrations / API settings). |

Every request:

```http
Authorization: Bearer <AIT_API_TOKEN>
Content-Type: application/json
```

If a call returns `401` or `403`, stop and ask the human to configure credentials.

## Issue shape (JSON)

Issues returned by the API align with the **embedded AI normalized form** (`design_doc/ai_prompting_guide.md`, Task 1), plus identity and timestamps:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | string | Stable id (UUID or string id). |
| `title` | string | |
| `summary` | string | |
| `category` | string | One of: `UI`, `Backend`, `Database`, `Authentication`, `Performance`, `Integration`, `Unknown`. |
| `priority` | string | `Low`, `Medium`, `High`, `Critical`. |
| `status` | string | e.g. `Open`, `In Progress`, `Resolved`, `Closed` (exact set is backend-defined). |
| `user_reported_issue` | string | Original user text. |
| `steps_to_reproduce` | string[] | |
| `expected_behavior` | string | |
| `actual_behavior` | string | |
| `missing_information` | string[] | |
| `tags` | string[] | Lowercase keywords. |
| `created_at` | string | ISO-8601. |
| `updated_at` | string | ISO-8601. |

Optional agent-oriented fields the backend may include or accept on update:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `resolution_notes` | string | What the agent changed or verified. |
| `agent_attempted_at` | string | ISO-8601. |

## Endpoints

Base path: `{AIT_API_BASE}/api/issues`

### List issues

`GET /api/issues`

Query parameters (all optional):

| Param | Example | Effect |
| ----- | ------- | ------ |
| `status` | `Open` | Filter by status. |
| `category` | `UI` | Filter by category. |
| `tag` | `bug` | Filter by tag (single tag). |
| `q` | `login` | Free-text search (backend-defined; title/summary/tags). |

**Response:** `200` with JSON body:

```json
{
  "issues": [ { "...": "issue object" } ],
  "count": 0
}
```

**Example list payload (one issue):**

```json
{
  "issues": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "title": "Submit button no-op on settings page",
      "summary": "Clicking Submit on /settings does not persist changes.",
      "category": "UI",
      "priority": "High",
      "status": "Open",
      "user_reported_issue": "submit doesn't work",
      "steps_to_reproduce": ["Open /settings", "Change theme", "Click Submit"],
      "expected_behavior": "Settings save and toast confirms.",
      "actual_behavior": "Nothing happens; network tab shows no request.",
      "missing_information": [],
      "tags": ["settings", "submit", "regression"],
      "created_at": "2026-05-04T18:00:00.000Z",
      "updated_at": "2026-05-04T18:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Get one issue

`GET /api/issues/:id`

**Response:** `200` with a single issue object, or `404` if missing.

### Update issue (agent or human)

`PATCH /api/issues/:id`

Use this after attempting a fix (success or failure): set `status`, add `resolution_notes`, or other fields your backend supports.

**Example body — fix succeeded:**

```json
{
  "status": "Resolved",
  "resolution_notes": "Bound onClick on SubmitButton in src/components/SubmitButton.tsx; added unit test in SubmitButton.test.tsx.",
  "resolution_type": "code_change"
}
```

**Example body — blocked or failed:**

```json
{
  "status": "Open",
  "resolution_notes": "Could not reproduce locally. Need repro steps for the settings screen; left missing_information unchanged.",
  "resolution_type": "blocked"
}
```

**Response:** `200` with the updated issue, or `4xx` with an error body.

### Create issue (optional; if backend exposes it)

`POST /api/issues`

Body is the same shape as Task 1 LLM output (without `id` / timestamps). Use when the agent files a new ticket from the codebase.

## Agent workflow (recommended)

1. **List** `GET /api/issues?status=Open` (or filter by `category` / `tag` / `q`).
2. **Read** `GET /api/issues/:id` for full context before editing code.
3. **Implement** fixes in the repo using normal tools (tests, linters).
4. **Report** `PATCH /api/issues/:id` with honest `resolution_notes` and appropriate `status`.

Do not invent API responses. If the server returns errors, surface them to the human.

## curl examples

Replace placeholders before running.

**List open UI issues:**

```bash
curl -sS \
  -H "Authorization: Bearer $AIT_API_TOKEN" \
  "$AIT_API_BASE/api/issues?status=Open&category=UI"
```

**Fetch issue by id (often a UUID in production):**

```bash
curl -sS \
  -H "Authorization: Bearer $AIT_API_TOKEN" \
  "$AIT_API_BASE/api/issues/550e8400-e29b-41d4-a716-446655440004"
```

**Report resolution:**

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $AIT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Resolved","resolution_notes":"Fixed null guard in useAuth redirect."}' \
  "$AIT_API_BASE/api/issues/550e8400-e29b-41d4-a716-446655440004"
```

## Reference

- Embedded-AI schema and prompts: `design_doc/ai_prompting_guide.md` (Task 1).
````
