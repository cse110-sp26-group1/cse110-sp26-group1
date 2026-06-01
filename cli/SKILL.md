---
name: allegro-fix-issue
description: >-
  Use the `allegro` CLI to fetch an Allegro issue by title and team name, fix
  it locally in the repo, and update its status. Use when the user writes a
  prompt in the form "fix issue: <Issue title or summary> in <Team name>" or
  otherwise asks the agent to resolve, work on, or close a specific Allegro
  issue by name.
---

# Allegro: Fix Issue Workflow

This skill teaches the agent how to take a natural-language request like

> fix issue: Button not working in Test Group

and drive the `allegro` command-line tool (already installed globally as
`allegro`, see `cli/CLT-user-guide.md`) to:

1. Use the existing `allegro` session token at `~/.allegro/config.json`.
2. Resolve the named team to a `team_id`.
3. Find the issue whose title/summary matches the user's description.
4. Mark it `In Progress`, fix it locally, write the findings back to the
   issue's fields (e.g. `resolution_notes`, `affected_files`,
   `hypothesis`), then mark it `Resolved`.

The agent must NEVER ask the user for the team_id or issue id directly — it
must derive them from the team name and issue text in the prompt. The agent
must also NEVER ask for, store, or write the user's email or password
anywhere; authentication is owned entirely by the `allegro` CLI.

---

## Trigger Patterns

Treat any of these user messages as an invocation of this skill:

- `fix issue: <issue text> in <team name>`
- `resolve issue: <issue text> in <team name>`
- `work on issue: <issue text> in <team name>`
- `close issue: <issue text> in <team name>` (use `update_issue --status="Closed"` instead of `resolve_issue`)

Parse the prompt by splitting on the last ` in ` to separate `<issue text>`
from `<team name>`. The issue text is matched against issue `title` and
`summary`; the team name is matched against the `team_name` field
returned by `allegro list_teams`.

---

## Workflow

Follow these steps in order. Stop and report to the user on any failure.

### 1. Verify the session token

The `allegro` CLI stores a bearer token at `~/.allegro/config.json` in
the form `{"token": "...", "expires_at": "..."}`. The agent uses that
token via the normal `allegro ...` commands — it does not need (and
must not ask for) the user's email or password.

Before doing anything else, confirm a usable token exists:

1. If `~/.allegro/config.json` is missing or its `expires_at` is in
   the past, stop and tell the user:

   > Not logged in. Please run `allegro login --email=<your-email>` in
   > your terminal, type your password at the prompt, then re-send your
   > request.

2. If the file is present and not expired, proceed to step 2. If a
   later `allegro` command fails with `Not logged in.` or any auth
   error, stop and show the same message above instead of retrying.

The agent does not run `allegro login` itself: the CLI's password
prompt is TTY-only (see `promptForPassword` in `cli/index.js`) and the
agent's shell is not a TTY. Logging in is a one-time action the user
performs in their own terminal.

### 2. Resolve the team name to `team_id`

```bash
allegro list_teams
```

The output is a JSON array of teams in the form:

```json
[
  { "id": 17, "team_name": "Test group", "bio": null, "role": "admin", "created_at": "..." }
]
```

Find the entry whose `team_name` field matches `<team name>` from the
prompt (case-insensitive, trimmed — `"Test Group"` in the prompt should
match `"Test group"` in the API response). Record its `id` as
`<team_id>`. If multiple match, ask the user to disambiguate. If none
match, list the available `team_name` values back to the user and stop.

### 3. Find the issue

```bash
allegro list_issues --team_id=<team_id>
```

By default this returns only `Open` / `In Progress` issues. Find the issue
whose `title` or `summary` best matches `<issue text>`:

1. Prefer exact case-insensitive matches on `title`.
2. Otherwise pick the issue whose `title` contains all the user's keywords.
3. If still ambiguous, fall back to substring matching on `summary`.
4. If multiple plausible matches remain, show the candidates (id, title,
   status) to the user and ask which one to fix.
5. If none match, also try with `--status="Resolved"` and `--status="Closed"`
   in case the user is asking about an already-closed item; report the
   finding and ask whether to reopen.

Record the chosen issue's `id` as `<issue_id>`.

### 4. Pull full details

```bash
allegro get_issue <issue_id>
```

Use the full issue body, reproduction steps, tags, and any linked file
paths to guide the local fix.

### 5. Mark the issue as in progress

```bash
allegro update_issue <issue_id> --status="In Progress"
```

Do this BEFORE editing code, so collaborators see the issue is being
worked on.

### 6. Fix the issue locally

Apply code edits in the repo using the agent's normal editing tools. Run
the project's tests / linters where appropriate. Reference the issue
details from step 4 — do not invent requirements.

As you investigate and fix, keep track of information you can write back
to the issue in step 7: the files you touched, the root cause, and what
you changed.

### 7. Enrich the issue's fields

`update_issue` can set many fields beyond `status`. Before (or alongside)
marking the issue resolved, update the fields you now have real
information for. Only set fields you can fill accurately from your own
investigation — never guess or invent values, and leave fields you have
no basis for untouched.

Fields the agent should populate when it has the information:

- `--resolution_notes` — a concise summary of the root cause and the fix
  you applied. Set this whenever you resolve or close an issue.
- `--affected_files` — JSON array of the repo files you actually changed
  or that were central to the bug, e.g.
  `--affected_files='["src/app.js","src/utils/date.js"]'`.
- `--hypothesis` — your diagnosis of the root cause (useful even if the
  issue had no prior hypothesis).
- `--category` — `Bug`, `Feature`, or `Task`, if it is clearly
  mis-categorized or unset.
- `--difficulty`, `--tags`, `--priority` — adjust only if your work
  revealed the existing value is wrong.
- `--steps_to_reproduce`, `--expected_behavior`, `--actual_behavior`,
  `--error_type`, `--error_message`, `--stack_trace`, `--entry_point` —
  fill or correct these if you confirmed them while reproducing the bug.
- `--missing_information` — if you could NOT fix the issue because details
  were absent, record what is still needed here instead of resolving.

You can set several fields in one call. Example:

```bash
allegro update_issue <issue_id> \
  --resolution_notes="Date parser assumed local time; switched to UTC and added guard for empty input." \
  --affected_files='["src/utils/date.js","src/app.js"]' \
  --hypothesis="parseDate() used new Date(str) which is timezone-dependent."
```

Wrap any value containing spaces in quotes, and pass array-valued flags
(`--tags`, `--stack_trace`, `--affected_files`) as a JSON array string.

### 8. Resolve the issue

After the fix is complete, verified, and the relevant fields are filled:

```bash
allegro resolve_issue <issue_id>
```

If the user said "close" instead of "fix" or "resolve", use:

```bash
allegro update_issue <issue_id> --status="Closed"
```

You may also combine the status change with the field updates from step 7
in a single `update_issue` call instead of using `resolve_issue`, e.g.
`allegro update_issue <issue_id> --status="Resolved" --resolution_notes="..."`.

### 9. Report back

Summarize to the user:

- The matched team (`team_name`, `id`) and issue (`id`, `title`).
- A short description of the local changes that were made.
- Which issue fields you updated (e.g. `resolution_notes`,
  `affected_files`, `hypothesis`).
- The new issue status (`Resolved` or `Closed`).

---

## Worked Example

User prompt:

> fix issue: Button not working in Test Group

Agent actions (real output observed against the live API):

```bash
# Step 1: confirm ~/.allegro/config.json exists and is unexpired.
#         If not, ask the user to run `allegro login --email=<email>`
#         in their terminal and stop here.

allegro list_teams
# -> finds { "id": 17, "team_name": "Test group", ... }

allegro list_issues --team_id=17
# -> finds { "id": 18, "title": "Button not working", "status": "Open", ... }

allegro get_issue 18
# -> read full description, repro steps, affected files

allegro update_issue 18 --status="In Progress"

# ... edit code, run tests ...

# Write back what the fix revealed, then resolve.
allegro update_issue 18 \
  --resolution_notes="Click handler was never bound; attached listener on mount." \
  --affected_files='["src/components/Button.js"]' \
  --hypothesis="Event listener registered before the element existed in the DOM."

allegro resolve_issue 18
```

Then reply to the user with a summary of the matched issue, the fix, and
the resulting status change.

---

## Command Reference (quick)

Full reference lives in [CLT-user-guide.md](CLT-user-guide.md). Most-used
commands for this skill:

| Goal | Command |
|------|---------|
| Login | `allegro login --email=<email>` |
| List teams | `allegro list_teams` |
| List active issues for a team | `allegro list_issues --team_id=<team_id>` |
| Filter by status | `allegro list_issues --team_id=<id> --status="In Progress"` |
| Get full issue | `allegro get_issue <issue_id>` |
| Mark in progress | `allegro update_issue <issue_id> --status="In Progress"` |
| Record the fix | `allegro update_issue <issue_id> --resolution_notes="..." --affected_files='["..."]' --hypothesis="..."` |
| Mark resolved | `allegro resolve_issue <issue_id>` |
| Mark closed | `allegro update_issue <issue_id> --status="Closed"` |
| Logout | `allegro logout` |

`update_issue` accepts these flags (set only the ones you can fill
accurately): `--title`, `--summary`, `--priority`, `--status`,
`--category`, `--difficulty`, `--tags`, `--entry_point`, `--error_type`,
`--error_message`, `--stack_trace`, `--affected_files`,
`--expected_behavior`, `--actual_behavior`, `--missing_information`,
`--steps_to_reproduce`, `--hypothesis`, `--resolution_notes`.

Notes:

- Wrap any value containing spaces in quotes: `--status="In Progress"`.
- Pass `--tags`, `--stack_trace`, and `--affected_files` as JSON array
  strings: `--tags='["ui","regression"]'`.
- Valid statuses: `Open`, `In Progress`, `Resolved`, `Closed`.
- Valid priorities: `Low`, `Medium`, `High`, `Critical`.
- Valid categories: `Bug`, `Feature`, `Task`.

---

## Failure Handling

- `Not logged in. Run: allegro login --email=xxx` (or expired token) →
  ask the user to run `allegro login --email=<their-email>` in their
  own terminal and stop. Never prompt the user for, or try to store,
  their email or password yourself.
- No team matches `<team name>` → print all `team_name` values from
  `allegro list_teams` and ask the user to pick one.
- No issue matches `<issue text>` → print id+title of all open issues in
  that team and ask the user to pick one.
- API/network errors → report the raw error from `allegro` to the user
  and stop; do not invent a fix or mark an unrelated issue as resolved.
