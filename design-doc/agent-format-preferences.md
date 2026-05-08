# AI Agent Format Preferences for Issue Tracker

A reference guide for how each major AI agent prefers to receive structured issue data, and what format to use universally.

---

## Claude (Anthropic)

**API format:** Anthropic Messages API

**Preferred JSON structure:** Nested, wrapped in XML tags

**What Claude receives from your API:**

```json
{
  "issue_id": 3,
  "entry_point": "exportRenderer.ts:42",
  "error_type": "NullReferenceException",
  "error_message": "Cannot read properties of null",
  "stack_trace": ["exportRenderer.ts:42", "pdfService.ts:18"],
  "affected_files": ["src/export/exportRenderer.ts"],
  "can_modify_code": true,
  "can_deploy": false
}
```

**How Claude processes it internally:**
Claude is trained to treat XML-tagged sections as distinct context blocks. Internally it separates context from instructions — this is handled by Claude's own reasoning, not your backend.

**Key characteristics:**
- Handles nested JSON well
- Stack trace as an array of strings, not a single concatenated string
- Constraint fields like `can_deploy` are read and respected automatically

---

## GPT / Codex (OpenAI)

**API format:** OpenAI Messages API

**Preferred JSON structure:** Nested, clean

**What GPT receives from your API:**

```json
{
  "issue_id": 3,
  "entry_point": "exportRenderer.ts:42",
  "error_type": "NullReferenceException",
  "error_message": "Cannot read properties of null",
  "stack_trace": ["exportRenderer.ts:42", "pdfService.ts:18"],
  "affected_files": ["src/export/exportRenderer.ts"],
  "can_modify_code": true,
  "can_deploy": false
}
```

**Key characteristics:**
- Handles nested JSON reliably
- Reads constraint booleans directly without needing explanation
- Codex specifically is optimised for code navigation — `entry_point` and `affected_files` are the fields it prioritises first

---

## DeepSeek

**API format:** OpenAI-compatible API

**Preferred JSON structure:** Nested, but field ordering matters

**What DeepSeek receives from your API:**

```json
{
  "issue_id": 3,
  "entry_point": "exportRenderer.ts:42",
  "error_type": "NullReferenceException",
  "error_message": "Cannot read properties of null",
  "stack_trace": ["exportRenderer.ts:42", "pdfService.ts:18"],
  "affected_files": ["src/export/exportRenderer.ts"],
  "can_modify_code": true,
  "can_deploy": false
}
```

**Key characteristics:**
- More instruction-literal than Claude or GPT — it processes fields in the order they appear
- Put the most important fields first in your JSON (`entry_point`, `error_type`, `stack_trace`) so DeepSeek encounters them early
- Uses OpenAI-compatible API so integration is straightforward

---

## Qwen (Alibaba)

**API format:** OpenAI-compatible API

**Preferred JSON structure:** Flat — minimal nesting, simple arrays of strings

**What Qwen receives from your API:**

```json
{
  "issue_id": 3,
  "entry_point": "exportRenderer.ts:42",
  "error_type": "NullReferenceException",
  "error_message": "Cannot read properties of null",
  "stack_trace": ["exportRenderer.ts:42", "pdfService.ts:18"],
  "affected_files": ["src/export/exportRenderer.ts", "src/services/pdfService.ts"],
  "can_modify_code": true,
  "can_deploy": false
}
```

**Key characteristics:**
- Handles flat key-value structures more reliably than deeply nested objects
- `affected_files` as a plain array of strings is easier for Qwen to iterate than an array of objects with `path` and `line` properties
- Avoid nesting beyond one level where possible

---

## Side-by-Side Comparison

| | Claude | GPT / Codex | DeepSeek | Qwen |
|---|---|---|---|---|
| **API format** | Anthropic API | OpenAI API | OpenAI-compatible | OpenAI-compatible |
| **JSON structure** | Nested | Nested | Nested, order matters | Flat |
| **Stack trace** | Array | Array | Array | Array |
| **Affected files** | Array of strings | Array of strings | Array of strings | Array of strings |
| **Field ordering** | Flexible | Flexible | Important | Flexible |
| **Nesting tolerance** | High | High | Medium | Low |

---

## The Universal Format (Recommended)

Since agents pull issues directly from your API, they use their own built-in reasoning to interpret the data — your backend just serves clean JSON. No system prompts, no wrapping, no agent-specific packaging needed.

**The universal format is: flat, clean JSON. No XML. No inline comments. No deep nesting.**

```json
{
  "issue_id": 3,
  "status": "investigating",
  "priority": "high",
  "category": "export_failure",
  "entry_point": "src/export/exportRenderer.ts:42",
  "error_type": "NullReferenceException",
  "error_message": "Cannot read properties of null (reading 'applyFilters')",
  "stack_trace": [
    "exportRenderer.ts:42",
    "pdfService.ts:18",
    "dashboard.ts:301"
  ],
  "reproduction_steps": [
    "Open dashboard at /dashboard",
    "Apply any filter",
    "Click Export → PDF"
  ],
  "expected": "PDF downloads successfully",
  "actual": "Dashboard crashes — white screen",
  "affected_files": [
    "src/export/exportRenderer.ts",
    "src/services/pdfService.ts"
  ],
  "hypothesis": "filterState is null at export time after filter refactor in commit a3f9c21",
  "can_modify_code": true,
  "can_run_tests": true,
  "can_deploy": false,
  "previous_attempts": [
    {
      "attempt": 1,
      "result": "failed",
      "notes": "Could not reproduce — possible race condition"
    }
  ]
}
```

### Why each field matters

**`entry_point`** — The single most important field for a code-fixing agent. Instead of asking the agent to figure out where to start from a wall of logs, you hand it the exact file and line number. This cuts out an entire exploration phase and means the agent goes straight to the source of the problem.

**`error_type` and `error_message`** — These two together tell the agent what kind of failure occurred and what the runtime was complaining about. A `NullReferenceException` with the message `Cannot read properties of null` immediately signals a missing null guard — the agent knows the class of fix before it even opens a file.

**`stack_trace` as an array** — Storing the stack trace as an array of strings rather than a single concatenated string means the agent can iterate over each frame directly. It can open `exportRenderer.ts:42`, check it, then move to `pdfService.ts:18` — without having to parse a string first.

**`reproduction_steps`** — Agents like Claude Code and Codex can actually run your app in a sandbox. Having discrete, ordered steps means the agent can execute them programmatically to reproduce the crash before attempting a fix. Without this, the agent is fixing blind.

**`expected` and `actual`** — These define the success condition. The agent knows it has fixed the issue when `actual` matches `expected`. Without both fields, the agent has no clear definition of done.

**`affected_files` as an array of strings** — Scopes the agent's work to only the files relevant to the issue. Without this, an agent might wander into unrelated parts of the codebase. It also acts as a soft permission boundary — files not listed here should not be touched.

**`hypothesis`** — Optional but valuable. If a previous agent or a human has a strong theory about the root cause, putting it here saves the next agent from rediscovering it. The agent can validate or disprove the hypothesis rather than starting from scratch.

**`can_modify_code`, `can_run_tests`, `can_deploy`** — Flat booleans that act as hard guardrails. The agent reads these before doing anything. `can_deploy: false` is unambiguous — no agent should deploy regardless of what it finds. Keeping these as top-level booleans rather than nested inside a `constraints` object means they are impossible to miss.

**`previous_attempts`** — Prevents the agent from repeating work that has already failed. If attempt 1 could not reproduce the issue, the next agent knows to try a different approach — perhaps a different filter combination, or checking for a race condition — rather than following the same steps and hitting the same dead end.

---

### Summary

Store canonical JSON in your DB. Serve the universal flat format from your API. Since agents pull issues directly and use their own built-in reasoning, your backend's only responsibilities are:

- Serve clean flat JSON from `GET /agent/issues`
- Accept status updates back from the agent via `PATCH /agent/issues/:id`

The agent handles everything in between. No system prompts, no serializers per agent, no schema changes needed.
