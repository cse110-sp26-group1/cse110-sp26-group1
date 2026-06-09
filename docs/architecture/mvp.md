# Allegro (AIT) — MVP Scope Document

Team-based issue tracker for developers who want AI-assisted issue creation *without* giving up complete control of the workflow to agents. Humans manage issues in the web UI and can use their agents to work on and update those issues through our CLI tool.

---

## 1. Primary user

**Primary:** Student dev teams and small beginner groups doing organized project work—people who want help from AI but **reject complete dependence** on it for issue tracking.

We looked at agent-first tools like **Beads** and **Trekker**. We passed on those models because they give the AI too much autonomy over planning and don't fit teams who need to understand and defend their own issues like ours. Allegro stays in the middle: more help than GitHub Issues, less agent reliance than Beads.

**Agent Involvement:** A **developer on the team** runs their own coding agent (e.g. Claude) and connects it via the **CLI** Tool to read/update issues after possibly making changes to the user's codebase.

---

## 2. MVP scope

Deployable team issue tracker with auth, teams, invites, issue CRUD, AI-assisted issue creation (one-pass), and a minimal CLI so a developer’s agent can read/update issues. 


| Item                                                    | MVP | Notes                                               |
| ------------------------------------------------------- | --- | --------------------------------------------------- |
| Issue tracker CRUD                                      | ✅   | Core                                                |
| Team workspaces (create, join, roles; similar to Slack) | ✅   |                                                     |
| Invites (pending / accept / decline)                    | ✅   |                                                     |
| Auth (register, login, sessions)                        | ✅   |                                                     |
| AI-assisted issue creation                              | ✅   | One-pass at create; rough input → structured fields |
| Dual interface (web UI + CLI Tool accessible to agents) | ✅   |                                                     |
| Agent-readable issue schema                             | ✅   | Store + API (stack trace, hypothesis, etc.)         |
| Deploy + CI/CD + lint                                   | ✅   | Course requirement                                  |
| Token tracking                                          | ❌   | Stretch                                             |
| LLM output review / confirmation before save            | ❌   | Stretch; ship one-pass first                        |
| Iterative AI refine with user                           | ❌   | Stretch                                             |
| Polished human-facing CLI UX                            | ❌   | Stretch; minimal CLI for agents only                |
| Agent approval gates before code changes                | ❌   | Out of scope — not a coding agent                   |
| GitHub / Slack / external integrations                  | ❌   | Stretch                                             |
| Token/budget dashboards                                 | ❌   | Stretch                                             |


## 3. Core workflow 

**Human path**

1. User registers / logs in.
2. User creates or joins a team (create team or accept invite).
3. User opens “New Issue” and enters rough description (and title).
4. Frontend sends data to backend; **LLM runs once on create** and returns structured fields based on specific prompt.
5. Backend stores structured issue in D1.
6. User views, filters, edits, and updates issues in the web UI.

**Agent path**

1. Developer installs/links CLI and authenticates.
2. Developer (or their coding agent via CLI) lists and reads issues for a team.
3. Agent works in local codebase; CLI updates issue status and agent-oriented fields.
4. Teammates see updates in the web UI (same Cloudflare D1 database source of truth).

---

## 4. Acceptance criteria for MVP

### Human / UI

- User can register and log in
- User can create a team and see it on the teams dashboard
- User can invite an existing user; invitee can accept or decline
- User can create an issue with rough input; structured fields are stored
- User can list, view, edit, and delete issues within their team
- Team metadata (e.g. bio) displays correctly on team cards

### Agent 

- Authenticated CLI tool can read team issue list and issue detail
- CLI tool can update at least issue status and one agent-oriented field
- Changes from CLI tool appear in the web UI without a separate database

### Quality / course process

- Unit and E2E tests cover most functionality
- App deployed (GitHub Pages + Worker)
- Comprehensive wiki for future project maintainers
- Sprint artifacts in repo (planning, standups, retros)

---

