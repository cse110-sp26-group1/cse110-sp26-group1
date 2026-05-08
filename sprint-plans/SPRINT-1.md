# Sprint 1

## AI-Integrated Issue Tracker General Overview

This project is a centralized issue tracking system designed for both human users and AI agents, enabling structured collaboration between the two.

At its core, the system consists of:

- A **Human UI (frontend)** for creating, viewing, and managing issues
- A **Backend API layer** that handles data processing, AI integration, and communication
- An **AI layer (LLM)** used specifically to refine and structure human input into consistent, database-friendly formats
- A single **Database (DB)** that serves as the source of truth for all issue data
- A specialized **Agent-facing API interface** that exposes structured, context-optimized data for external AI agents

The system follows a **dual-interface design**:

- Humans interact through a visual UI that prioritizes readability and usability
- AI agents interact programmatically through API endpoints that return structured, minimal, and machine-readable data

The backend acts as the central coordinator:

- It receives raw input from users
- Uses AI to transform unstructured input into structured data
- Stores all processed data in a unified database
- Exposes different API endpoints tailored to the needs of humans and agents

Importantly:

- There is **only one backend and one database**
- The “dual-interface” refers to **different ways of accessing the same system**, not separate systems
- The platform itself does **not implement autonomous agents**, but instead provides the infrastructure for external agents to read from and write to the system

Overall, the goal is to reduce friction for human users while providing a clean, efficient interface for AI agents to consume and act on issue data.

## AI-Integrated Issue Tracker Workflow

### Human Flow:

1. User fills out form in UI (issue description, error info, etc.)
2. Data sent to backend API (e.g. POST /issue)
3. Backend:

- Sends input to LLM (we'll likely use some free model like Deepseek)
- LLM returns structured human readable text (e.g. priority levels, summaries, etc.)
- Backend parses it into fields

Example:

**AI text file** (human readable text):

```
priority=High
summary=...
```

**Backend job** (parse into fields):

```
{
    priority: "High"
    summary: ""
    ...
}
```

4. Store the parsed data into DB (there is only 1 DB)
5. UI fetches and displays human-friendly version

### Agent Flow:

1. Agent calls API (same API, different endpoint)

Example:

User might use this endpoint
`ait_service/get_issues/category=?`

Agent might call this endpoint (tailor-made for the AI agent)

`ait_service/get_issue/id=3`

2. Retrieves structured issue data
3. Uses it as context for making edits or fixes to the issue(outside your system)
4. Can update issue via its API endpoint as well(status, logs, etc.)

### Important Distinction:

The agent in the the [Agent Flow](#agent-flow) section is _not_ the same as the LLM we're using to structure/organize human form inputs.

This agent is the user's own agent which they'd use to call our backend endpoint (the one for the agent) and retrieve issue context (stored data) in clean format. Then it may work on fixing any bugs/code until it finishes or gives up, sending an update report back to the backend on termination.

Both endpoints will have full CRUD support (GET, POST, etc.)

---

## Team Responsibilities (Sprint 1 → Moving Forward)

### Design / Frontend Team

- Design and prototype the **Human UI**
  - Issue creation form (inputs: description, error info, labels, priority, etc.)
  - Issue display/dashboard (simple with toggle settings discussed in meeting)
  - _This will most likely take up one folder and have refinement stages similar to Warm Up_
- Work with AI/backend team to:
  - determine what inputs the user should provide (e.g. schema for things to store in DB)
- Build initial prototype for professor demo (continue refining prototype even after Prof meeting)
- Ensure UI supports:
  - easy issue creation
  - readable summaries
  - USABLE

---

### Backend Team

- Understand how to set up:
  - Cloudflare Workers
  - Cloudflare D1 (database)
- Design **database schema**
  - Define fields for:
    - user input
    - AI-generated data (priority, summaries, etc.)
- Implement **API structure (dual-interface)**
  - Human endpoints (UI-driven queries)
  - Agent endpoints (structured, minimal responses)
- Prototype:
  - basic CRUD endpoints (GET, POST, PATCH, DELETE)
- Decide:
  - whether to use one table or multiple tables (user table vs agent table to correspond to user endpoint and api endpoint)
  - how to structure data for both human + agent use

**Ideally have one folder with refinement stages similar to the Warm Up as well, but this needs more discussion**

---

### AI / LLM Team

- Test how we need to prompt the AIs and what works best for coding agents

  - Goal: figure out what information we need for each issue **before designing the database**

- Determine:

  - how we want to structure the **input prompt**
  - how we want to structure the **AI output**

- Check what information should be provided through the AI/API for agents

  - i.e., what an agent would need to best solve an issue:
    - error traces
    - potential steps
    - summaries
    - other relevant context

- Identify:

  - what the **user must provide**
  - what the **AI should generate**

- They do **not need to worry about the exact implementation of the API**

  - only:
    - how it is called
    - what the agent receives

- Overall goal:
  - define everything needed to make:
    - AI input/output
    - agent API calls/responses **AI-friendly and reliable for use by coding agents**

---

**Plan for future features/stretch goals unless mentioned by stakeholders to be part of MVP**

- AI usage tracking (tokens, cost)
- story points / planning metrics
- integrations (GitHub, Slack)

---

### Current Concerns to Address

- AI usage documentation in our project (what I mean by this is how much are we using AI to help us work on our project (planning, AI helping in research), not the issue tracker' LLM model in the human workflow)
- Are we properly addressing this:

`The end goal is to explore how agents can read and interact with issues, track tokens/budget/time, and offer different views for humans vs. agents.`

`The system should reduce overhead to support planning at AI-level speeds. Integration with other tools in the software engineering process (e.g., GitHub, Slack, LLM APIs) is also part of the vision. Note that you are not trying to build an autonomous coding agent. It is a tracker that engineers would want to integrate into their workflow (download, use, etc.). The UI/UX should aim to be inviting, with easy-to-use features and developer access that allow AI agents to read, create, write, and report on issues.`

---

### ✅ Key Goal for This Week

- Deliver:

  - **UI prototype (Design team priority)**
  - **Basic API + schema plan (Backend)**
  - **Prompt + output structure (AI team)**

- Ensure all components are:
  - compatible with each other
  - aligned with the overall system workflow
