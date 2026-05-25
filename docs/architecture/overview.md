# Product Overview

**Allegro** is a team-based issue tracker for developers who want AI assistance without handing the whole workflow to an autonomous agent (unlike tools such as Beads that drive engineering end-to-end). 

Humans stay in charge: they create and manage issues in a familiar UI, while the backend uses an **LLM layer** only to turn rough input into structured issue fields at creation time. 

Separately, a developer can connect **their own** coding agent (e.g. Claude) to Allegro through our **CLI tool** that talks to our backend and uses it while working in their local codebase, being able to use our CLI tool to make any necessary issue updates.

One Cloudflare Worker and one D1 database remain the shared source of truth for the UI, the API, and the CLI tool.

---

## How the product works

### People and teams

- Users register and log in; the Worker issues session tokens stored in D1.
- **Teams** are isolated workspaces (similar to a GitHub repository or Slack workspace). Membership and roles (`admin` / `member`) are stored in `team_members`.
- **Invites** manage collaboration: admins invite existing users; invitees accept or decline. Access stays permission-controlled rather than open join.

### Issues (human side)

- **Humans create issues** inside a team they belong to (title, description, priority, status, tags, and richer debugging fields over time).
- Raw form input is passed through an **LLM layer** on the backend so unstructured text becomes consistent, structured fields before storage—less friction for humans, cleaner context for agents. See [ADR](../../ADR/adr.md).
- **Issues belong to exactly one team**; listing, filtering, and permissions are scoped by `team_id`.

### Agents (machine side)

- **Agents process issues** by reading and updating structured issue data via a CLI tool that accesses our backend, a critical part of our dual-interface decision.
- The issue row holds human-facing summaries plus agent-oriented fields (for example stack trace, hypothesis, affected files, resolution notes, and token usage).

---

### Request flow (frontend ↔ worker ↔ D1)

1. The **frontend** calls the Worker over HTTPS (`/auth`, `/teams`, `/invites`, `/issues`, and related routes) with CORS. Protected routes send `Authorization: Bearer <token>`.
2. The **Cloudflare Worker** validates the session, enforces team membership and admin rules, runs route handlers, and invokes the LLM when creating or updating issues.
3. **D1** (SQLite) persists users, teams, memberships, invites, issues, and sessions. Deleting a team cascades to that team’s members, issues, and invites.

The Worker is deployed from GitHub Actions on pushes to `main`. Database schema changes are applied separately with `wrangler d1 execute` when `schema.sql` changes.

For a visual event-flow diagram, see the team Miro board (link TBD).

---

## Design principles (note: this table could use some work)


| Piece                        | What it does                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Two faces, one backend**   | Browser UI for humans; CLI tool for external agents; same Worker and D1.                                        |
| **LLM layer**                | Structures issue text when humans create issues (not a separate autonomous agent).                              |
| **Cloudflare (Worker + D1)** | API runs on Workers; data lives in D1 (SQLite). Schema updates are applied with Wrangler, separate from deploy. |


## Related documentation

- [Database architecture](./database.md) — tables, relationships, and cascade behavior
- [ADR](../../ADR/adr.md) — dual-interface API, LLM structuring, and Cloudflare stack
- [API routes](../../issue-tracker-api/ROUTES.md) — endpoint surface
- [Frontend overview](../../frontend/doc_overview.md) — static UI prototype and local run instructions (note: update later once we update where the docs are located)

