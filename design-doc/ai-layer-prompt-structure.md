# AI Layer — Prompt Structure & LLM Output Preferences

This document covers what the backend sends to the LLM, what each LLM returns, and how the backend parses it into JSON for storage.

---

## The Human Workflow

```
User types plain text
        │
        ▼
Backend calls LLM API (AI Layer)
        │
        ▼
LLM returns key=value pairs
        │
        ▼
Backend parses into JSON
        │
        ▼
Stored in DB
        │
        ▼
Backend returns JSON to frontend
        │
        ▼
Frontend renders human readable UI
```

---

## Prompt Structure (what the backend sends to the LLM)

Following the context-first principle — give the LLM the full context before the instruction, so it builds a complete understanding of the problem before it starts extracting.

```
You are an issue tracking assistant.

A user has submitted the following issue report:
"{raw user input}"

Extract the information and return it in exactly this format:
priority=
summary=
category=
expected=
actual=
reproduction_steps=

Rules:
- Return key=value pairs only. No explanation, no extra text.
- If a field cannot be determined, leave the value empty.
- reproduction_steps should be comma separated.
- priority must be one of: Low, Medium, High, Critical.
- category must be one of: Bug, Feature, Task.
```

**Why context first?**
LLMs weight earlier content more heavily. By giving the raw report before the instruction, the model builds a full understanding of the issue first — then extracts fields with that full context already loaded. Asking the question first and giving context after produces weaker, less accurate extraction.

---

## What Each LLM Returns & What to Watch Out For

### Claude (Anthropic)

**Preferred output:** Clean key=value, follows instructions closely.

**What it returns:**
```
priority=High
summary=Dashboard crashes when exporting PDF after applying filters
category=Bug
expected=PDF downloads successfully
actual=Dashboard crashes with white screen
reproduction_steps=Open dashboard, Apply filters, Click Export PDF
```

**Characteristics:**
- Most reliable at following the exact format specified
- Rarely adds extra commentary or explanation
- Respects the field list strictly — won't add fields you didn't ask for
- Safe to parse directly with no pre-processing needed

**Parser pre-processing needed:** None

---

### GPT / Codex (OpenAI)

**Preferred output:** key=value but sometimes wraps in markdown code fences.

**What it returns:**
````
```
priority=High
summary=Dashboard crashes when exporting PDF after applying filters
category=Bug
expected=PDF downloads successfully
actual=Dashboard crashes with white screen
reproduction_steps=Open dashboard, Apply filters, Click Export PDF
```
````

**Characteristics:**
- Generally follows the format well
- Has a tendency to wrap output in triple backticks even when told not to
- Occasionally adds a one-line preamble like "Here is the extracted information:"
- Codex specifically is strong at inferring technical fields like `category` and `affected_files`

**Parser pre-processing needed:** Strip backticks and any preamble line before parsing

```typescript
function normalizeGPT(raw: string): string {
  return raw.replace(/```[a-z]*|```/g, "").trim();
}
```

---

### DeepSeek

**Preferred output:** key=value but adds explanation before and after.

**What it returns:**
```
Here is the extracted issue information:

priority=High
summary=Dashboard crashes when exporting PDF after applying filters
category=Bug
expected=PDF downloads successfully
actual=Dashboard crashes with white screen
reproduction_steps=Open dashboard, Apply filters, Click Export PDF

Let me know if you need anything adjusted.
```

**Characteristics:**
- More verbose than Claude or GPT — adds commentary even when told not to
- The key=value block itself is accurate and well structured
- Processes fields in the order you list them in the prompt — so put the most important fields first (`priority`, `summary`) to get the best extraction
- Benefits from explicit numbered rules in the prompt

**Parser pre-processing needed:** Extract only the key=value lines, ignore everything else

```typescript
function normalizeDeepSeek(raw: string): string {
  return raw
    .split("\n")
    .filter(line => line.includes("="))
    .join("\n")
    .trim();
}
```

---

### Qwen (Alibaba)

**Preferred output:** Plain key=value, but sometimes switches to plain prose or drops fields.

**What it returns (best case):**
```
priority=High
summary=Dashboard crashes when exporting PDF after applying filters
category=Bug
expected=PDF downloads successfully
actual=Dashboard crashes with white screen
reproduction_steps=Open dashboard, Apply filters, Click Export PDF
```

**What it returns (worst case):**
```
The issue priority is High. The user reported that the dashboard crashes
when exporting a PDF after applying filters. The expected behavior is
that the PDF downloads successfully.
```

**Characteristics:**
- Least consistent of the four at following a strict output format
- Needs a more explicit prompt — show it an example of the exact output you want
- Flat, simple formats work better than structured ones
- If it drops into prose, your parser needs a fallback

**Parser pre-processing needed:** Check if output contains `=` signs — if not, fall back to a prose extraction strategy or re-prompt

```typescript
function normalizeQwen(raw: string): string {
  const hasKV = raw.includes("=");
  if (hasKV) {
    return raw
      .split("\n")
      .filter(line => line.includes("="))
      .join("\n")
      .trim();
  }
  // fallback — re-prompt or flag for manual review
  throw new Error("Qwen returned prose instead of key=value");
}
```

**Tip:** For Qwen, add an example output block to the prompt:

```
Return exactly this format:
priority=High
summary=...
category=Bug
```

Showing the example with a filled-in value (not just `priority=`) significantly improves consistency.

---

## Side-by-Side Comparison

| | Claude | GPT / Codex | DeepSeek | Qwen |
|---|---|---|---|---|
| **Output format** | Clean key=value | key=value + possible backticks | key=value + commentary | key=value or prose |
| **Extra text** | None | Occasionally | Almost always | Sometimes |
| **Field consistency** | High | High | Medium | Low |
| **Pre-processing needed** | None | Strip backticks | Extract KV lines | Check format, fallback |
| **Prompt sensitivity** | Low | Low | Medium | High |
| **Needs example in prompt** | No | No | No | Yes |

---

## The Backend Parser (universal)

Once each LLM's output is normalized, the same parser handles all of them:

```typescript
function parseKV(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw.split("\n")
       .filter(line => line.includes("="))
       .map(line => line.split(/=(.+)/).map(s => s.trim()).slice(0, 2))
  );
}
```

Produces the same JSON regardless of which LLM ran:

```json
{
  "priority": "High",
  "summary": "Dashboard crashes when exporting PDF after applying filters",
  "category": "Bug",
  "expected": "PDF downloads successfully",
  "actual": "Dashboard crashes with white screen",
  "reproduction_steps": "Open dashboard, Apply filters, Click Export PDF"
}
```

---

## What Gets Stored in the DB (Canonical Record)

The canonical record is the single source of truth in the DB. It serves two audiences — the frontend (human) and the agent endpoint — so it contains fields for both.

```json
{
  "issue_id": 3,
  "status": "open",
  "created_at": "2026-05-07T10:00:00Z",
  "updated_at": "2026-05-07T10:00:00Z",

  "priority": "High",
  "category": "Bug",
  "summary": "Dashboard crashes when exporting PDF after applying filters",
  "expected": "PDF downloads successfully",
  "actual": "Dashboard crashes with white screen",
  "reproduction_steps": ["Open dashboard", "Apply filters", "Click Export PDF"],

  "error_type": "NullReferenceException",
  "error_message": "Cannot read properties of null",
  "stack_trace": ["exportRenderer.ts:42", "pdfService.ts:18"],
  "entry_point": "src/export/exportRenderer.ts:42",
  "affected_files": ["src/export/exportRenderer.ts", "src/services/pdfService.ts"],
  "hypothesis": null,

  "can_modify_code": true,
  "can_run_tests": true,
  "can_deploy": false,

  "agent_history": []
}
```

The top half is populated by the AI layer when a human submits an issue. The bottom half is populated as more technical context becomes available — either from the user, from logs, or from agent activity.

---

## What the Frontend Displays

The frontend receives the JSON and renders it as human readable text:

```
Issue #3
─────────────────────────────────
Priority:    High
Category:    Bug
Status:      Open

Summary:
Dashboard crashes when exporting PDF after applying filters

Steps to Reproduce:
  1. Open dashboard
  2. Apply filters
  3. Click Export PDF

Expected:    PDF downloads successfully
Actual:      Dashboard crashes with white screen
```

---

## Helpful Links
[Claude_Guide] (https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/increase-consistency?utm_source=chatgpt.com)
[Deepseek_Guide] (https://api-docs.deepseek.com/guides/json_mode)
[Qwen_Guide] (https://qwen.readthedocs.io/en/latest/framework/function_call.html)
[OpenAI_Guide] (https://developers.openai.com/api/docs/guides/structured-outputs)

## Summary

- The prompt always puts context first (raw user report), instruction after
- The LLM returns key=value pairs — simple enough for every model to produce reliably
- Each LLM needs a small normalization step before the universal parser runs
- Claude needs none, GPT needs backtick stripping, DeepSeek needs commentary stripped, Qwen needs a format check with fallback
- The parser always produces the same JSON shape regardless of which LLM ran underneath
- The DB stores one canonical record that serves both the frontend and the CLI
- The frontend renders it as human readable text, the agent uses the CLI (`ait get_issue 1`) which calls the API and returns the same flat JSON
