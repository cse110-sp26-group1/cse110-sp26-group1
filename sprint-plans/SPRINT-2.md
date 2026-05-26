# Allegro Sprint 2 Plan

## 1. Meeting Plan

### Frontend/UI + User Stories (~10–15 min)

- Review frontend UI quickly and confirm everyone is aligned on the direction
- Brief review of user stories (high level only)

### Backend API + LLM Research (~10 min)

- Quick backend progress overview
- Discuss LLM integration direction/research
- No deep implementation details yet

### CI/CD Discussion (~5 min)

- Decide linting/testing requirements for PRs
- Discuss minimum pipeline setup needed
- Reminder: ask about dependencies like Vite

---

## Sprint 2 Goal

Goal: build a working integrated MVP prototype.

### Frontend

- Integrate backend API calls and outputs
- Improve web UI from meeting feedback
- Ensure all issue CRUD operations are accessible through UI

### Backend

- Implement backend functionality
- Add LLM integration layers
- Finalize agent-facing endpoints

### CLI

- Create a very simple usable CLI
- Could be vibecoded completely
- Need to determine:
  - Separate Claude/Codex style CLI screen?
  - Or script with call flags?
- Decide whether frontend or backend team owns the CLI
  - Technically frontend
  - Backend has more people and more control over agent API behavior

### Team Workflow Discussion

Each team (frontend/backend) should decide:

- How tasks are assigned/volunteered for
- Whether work is grouped or async
- Whether internal deadlines during the week would help
- How the Miro board will be used (required)
- How documentation should be handled

### MVP Prototype Review

- Verify MVP guidelines are not missing anything (if time allows)

---

# 2. Build MVP First Prototype

## Core MVP Functionality

### Tasks / Ownership


| Task                         | Owner           |
| ---------------------------- | --------------- |
| User login/auth/CORS         | Noah            |
| Create teams + invite system | Ben             |
| UI issue CRUD                | Michael         |
| Unit testing                 | Jonathan        |
| Documentation                | Amormio         |
| CLI + LLM integration        | Jerry + Anchita |


---

## Backend Tasks

### Noah

- User login/auth/CORS handling
- Type checking:
  - handlers
  - session auth token
- Improve documentation:
  - explain *why* certain patterns exist
  - include do/don’t style explanations

### Ben

- Fix invites endpoint
- Handle:
  - updating invite status
  - team member updates on accept/reject
- Create:
  - teams endpoint
  - team members endpoint

### Michael

- Finish agent endpoint
- Return:
  - issue fields
  - agent-specific fields
- Research how to target RAIL in testing

### Jonathan

- Unit testing setup

### Amormio

- Documentation

### Jerry + Anchita

- Agent CLI CRUD
- LLM layer integration
- Ensure all agent-facing API endpoints are available through CLI

---

# MVP Requirements

## Required

- All issue CRUD operations available through UI
- Improved web UI from meeting feedback
- Functional API
- Attempt to target RAIL
- CLI usable for agents
- LLM layer works for created issues
- Backend/frontend fully integrated

---

## Can Be Pushed to Next Week

- AI resource tracking
- Web UI accessibility improvements
  - multiple viewports
  - technical/non-technical views
- Downloadable CLI from website

---

# QoL Stretch Goals

- User profile details/settings
  - PFPs
  - bios
- Team roles/permissions
- Users reviewing LLM output
- Third-party integrations
  - Slack
  - external sign-ins
- More in-depth notifications
  - issue resolved
  - new users in team
  - etc.

---

# Removed

- Human-usable CLI UX

---

# 3. More Structured Development Cycle

## Pull Requests

- Announce PRs in the channel
- One of:
  - Amormio
  - Anchita
  - James
  will review/approve
- PR reviews are required

## Exceptions

Use reasonable judgment:

- Small wording changes/comments likely do not need PRs

## Team Standards

- Follow commit guidelines
- Follow code design guidelines
- Keep documentation updated
- Ensure tests pass once testing/pipelines are set up

---

# Reminder Topics

- Ask about dependencies like Vite
- Determine CLI ownership
- Decide documentation structure
- Decide Miro workflow usage

