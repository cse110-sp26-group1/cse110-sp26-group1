# LLM Layer

This document explains the LLM (Large Language Model) layer of our issue tracker — the part of the backend that turns a user's raw issue description into structured, well-organized issue fields.

**Related files:**

- [`issue-tracker-api/src/llm.js`](https://github.com/cse110-sp26-group1/cse110-sp26-group1/blob/main/issue-tracker-api/src/llm.js) — the LLM layer itself
- [`issue-tracker-api/routes/issues.js`](https://github.com/cse110-sp26-group1/cse110-sp26-group1/blob/main/issue-tracker-api/routes/issues.js) — where the LLM layer is called during issue creation

**Purpose:**

When a user files an issue, they often give a short or vague description. Instead of forcing them to manually fill in tags, steps to reproduce, and summary, we send their raw input to an LLM and ask it to infer those fields for us. This makes filing an issue fast for the user while still producing a richly structured issue in the tracker.

We use [DeepSeek](https://www.deepseek.com/) as our model provider, specifically the **DeepSeek V4 Flash** model. The API key is stored as the `DEEPSEEK_API` secret and injected into the Cloudflare Worker at deploy time.

---

## How It Works

The whole flow lives in `src/llm.js` and runs in three steps:

1. **Build a prompt** — the user's raw issue text is inserted into a fixed instruction prompt that tells the model exactly how to respond.
2. **Call DeepSeek** — the prompt is sent to the DeepSeek chat completions API.
3. **Parse the response** — the model's reply is parsed from plain-text key-value pairs into a structured JSON object that the rest of the backend can use.

### Step 1 — The Prompt

The module defines a constant `PROMPT` that frames the model as an *"issue agent for a software team."* The prompt is strict on purpose, so the output is predictable and easy to parse. Among other things it tells the model to:

- Return **only** plain-text `key: value` pairs — no JSON, no markdown, one field per line.
- Never omit a field; use `null` when something is unknown.
- Rewrite vague input into clear, actionable engineering language.

### Step 2 — Calling DeepSeek (`processIssue`)

`processIssue(rawUserInput, apiKey)` is the public function of the module. It:

1. Throws if no API key is provided.
2. Sends a `POST` request to `https://api.deepseek.com/chat/completions` with the prompt (the user's input substituted in) as a single user message, using the `deepseek-v4-flash` model.
3. Throws if the request fails or the model returns an empty response.
4. Passes the model's text reply to `parseKeyValueResponse` and returns the parsed object.

### Step 3 — Parsing the Response (`parseKeyValueResponse`)

`parseKeyValueResponse(text)` converts the model's plain-text reply into a structured object:

- It splits the text into lines and ignores blank lines.
- For each line, it splits on the first `:` into a key and a value.
- A value of `null` (any casing) becomes an actual `null`.
- Values for array fields are split on commas into an array.
- Keys containing a `.` (e.g. `details.stack_trace`) are expanded into nested objects.

---

## Where It Fits In

The LLM layer is called from the issue-creation route in `routes/issues.js`. When a new issue is created:

- If the request includes `test_mode`, the LLM is bypassed entirely and a **predictable mock payload** is returned instead. This keeps tests fast and deterministic, with no network calls.
- Otherwise, if the `DEEPSEEK_API` key is configured, the route calls `processIssue` with the user's title and description.
- The route then **merges** the LLM's inferred fields with whatever the user supplied. User-provided values take precedence, and sensible defaults fill any remaining gaps.

Crucially, **LLM enrichment is non-fatal**. If the key is missing, the network call fails, or the response can't be parsed, the error is caught and logged, and issue creation falls back to the user-supplied values plus defaults. A flaky model never blocks a user from filing an issue.
