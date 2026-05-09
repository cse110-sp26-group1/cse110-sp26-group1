# Sprint 1 Closing / Pre-Sprint 2 Coordination

## UPDATES after Friday's meeting!!!

### Deadlines (IMPORTANT)

-   **Main deadline:** Monday before meeting
-   **Hard cutoff:** Monday night (after meeting if not finished, so we can keep pace)
-   Goal is to have:
    -   usable backend prototype
    -   usable frontend prototype
    -   working database schema (D1)
    -   callable API endpoints

---

### Monday Meeting Plan

-   Review what each team completed
-   Check integration readiness (frontend ↔ backend ↔ LLM)
-   Clarify remaining MVP scope and next sprints
-   Do professor worksheet if there's time (6 pages, possibly split asynchronously before meeting to save time)

---

### MVP Scope Clarifications

-   LLM output review/confirmation flow → **STRETCH GOAL** (one pass for now, so user doesn't get confirmation ability)
-   CLI interface:
    -   must stay **minimal**
    -   is a **terminal-based tool used by external agents**, not part of the web UI
    -   used when a user runs an agent (e.g. Claude in terminal) to interact with our backend API and retrieve structured issue data
    -   this is separate from the frontend UI entirely (not embedded in the webpage)
    -   assumes users of the CLI are more technical, so agent-level structured outputs are acceptable

---

### Frontend / Design Requirements

Must include:

-   login page
-   sign up page

Key design requirement:

-   Define clear interaction flows:
    -   what happens when user clicks buttons
    -   loading states (especially during LLM processing)
    -   how issue results appear after AI processing
-   UI team needs to ensure the **desired end-to-end workflow is fully implemented**
-   Goal is to deliver a **working and high-quality prototype by Monday**

---

### Backend Requirements

Must be ready by Monday night:

-   working database schema in D1
-   callable API prototype
-   real structure for frontend integration

Required tables:

-   users table
-   teams table
-   team_members relationship handling
-   issues table (must support team filtering)

> Refer to [this example](/research/backend-research/db-tables-example.md)

Important clarification (team/workspace model):

-   teams are basically **separate workspaces / groups of people (like GitHub repo collaborators)**
-   each team represents a real group like “Group1”, “Group8”, etc.
-   users log in, join a team, and that team becomes their shared workspace (like a github repo)
-   only people in that team can see and interact with that team’s issues
-   so each team has its own isolated issue space, and there is no mixing of issues across teams

-   issues should include a `team_id` so we can query issues per team (each team = its own workspace)

Additional requirement:

-   user table must be compatible with Cloudflare authentication system

---

### System / Product Understanding

-   Teams are scoped **collaborative workspaces**
-   Each user belongs to a team (or multiple teams via mapping)
-   Issue visibility and actions are restricted to team membership only
-   Each team acts like its own isolated issue tracker space (similar to a GitHub repo)

---

### LLM / AI Layer

Current focus:

-   ci/cd setup and possibly help backend if you have time

---

### General Notes

-   Backend + frontend must be usable together by Monday night
-   Prototype should be “real enough” (real forms + real API + real schema)
-   Full polish and advanced features come after MVP stabilization

## EVERYTHING BELOW WAS INFO PRIOR TO FRIDAY'S MEETING

## FIRST!!!

-   Read the [ADR](/ADR/adr.md) to make sure you completely understand our project plan moving forward
-   Please ask questions if you have any confusion

## Repository & Documentation Reminders

-   Organize MVP a bit and put it on the repo (Amormio)
-   Prof said repo needs to be clean and the main source of truth instead of Slack having unrecorded information

> Every member _must_ adhere to the Conventional Commits guideline. This is simple enough so please don't forget.

---

## Team Coordination / Planning

-   Organize a Miro board that everyone works on
-   Have design, backend, and AI teams all contribute workflow ideas there so we can coordinate properly and build on each others' ideas

### Intermediate Deadlines

-   Might be good to place more intermediate deadlines
-   Especially if we try to uphold the **“everything done a day before deadline”** rule
-   This current set of work feels more like “closing Sprint 1” rather than actual Sprint 2 items
-   Could use Sprint 2 more for integration and refinement once all teams have enough detail to combine work together
-   Sprint 3 could then focus on final MVP completion + wiggle room if things go wrong

---

## UI / UX Planning (EVERYBODY)

Need _everyone_ to get an idea of what they want:

-   Issue tracker UI workflow
-   CLI behavior/workflow

For the website UI:

-   Important that everyone specifies event flow
-   Can be hand-drawn, Miro, whatever
-   Current prototype mostly gives overall look/features, but not interaction details
-   It will **benefit** the _entire group_ if everyone is very opinionated and almost critical of the current prototype. As a target user yourself, you will certainly have problems with the current prototype UI and its usability, so we'd rather you have a lot more to say than nothing at all.

> Example: It's clear from the prototype the layout breaks immediately when you choose filters. Personally I'd like to have the main "split" view allow you to drag to resize the two panels (list of issues and current issue display), I think the "list" view should look like this [example](https://www.theodinproject.com/paths/foundations/courses/foundations) where the content is in the middle. It's generally advised to keep line character lengths short hence the center-aligned content for readability. - Amormio

Example questions we should answer:

-   What happens when a button is clicked?
-   What pops up?
-   Where does it pop up?
-   What happens when a user creates an issue and it gets parsed through the LLM?
-   Do we want a loading screen?
-   How should the LLM response/confirmation flow look?
-   Do we assume one-pass prompting for now? If so how would that look?

Doesn’t need everyone spending massive amounts of time on this, but everyone’s opinion matters because UI/interaction is huge.

---

## CLI Workflow / Agent Interaction

Example:

```
ait get_issue 3
ait patch_issue 3
```

Questions:

-   What do we display to the user?
-   How minimal/AI-centric should the CLI be?
-   Should users have monitoring over what the agent is doing?

Current direction:

-   Keep CLI minimal and AI-centric initially
-   More Human-friendly CLI UX is likely a stretch goal
-   User-agent behavior/permissions are mostly controlled by the user’s own agent configuration/system prompts
-   Our system mainly provides:

    -   structured issue information
    -   issue updates/logging
    -   agent-friendly endpoints/tools

-   The tracker is fundamentally the same system for both humans and agents, just through different interfaces

---

## Backend Team

General schema direction seems mostly understood now.

Example: [schema example](/research/schema-example.js)

Need backend team to:

-   Contribute example user endpoints (based on schema)
-   Contribute example agent endpoints (based on schema)
-   Carefully read ADR and understand updated CLI-centered architecture
-   Learn/setup:
    -   Cloudflare Workers
    -   D1 database

Need at least a bare backbone next week so frontend + LLM teams can integrate against something even if responses are still rough/mock.

Even garbage-returning endpoints are still useful for frontend integration/testing.

---

## LLM Integration Team

Need to continue testing:

-   Prompting structure
-   AI layer formatting
-   What works best for coding agents
-   What information agents need most

Important:

-   Need consistency in LLM output formatting before moving heavily into integration
-   Especially important because cheaper models may aggressively force weird output formats that can break pipelines

Need to determine (AI team has already done a lot of this, just continue research):

-   Input prompt structure
-   Output format structure
-   What AI should add vs what user provides
-   What information the agent should receive

Examples:

-   Error traces
-   Potential steps
-   Summaries
-   Structured issue details

Potential fallback:

-   Default JSON-style structured output if needed

Also:

-   LLM team should finish AI formatting/output research before moving into CI/CD responsibilities (which should begin this weekend or early next week)

---

## Design Team

Need more detailed workflow/event planning in addition to prototype visuals.

Can revise prototype if needed, but the detailed event flow is priority.

Need:

-   Better interaction/event flow (Miro)
-   Revised personas/user stories to better match:
    -   target users are people like us
    -   users want assistance
    -   users do NOT want full agent dependency

---

## General Concern

Main issue right now seems to be:

-   people may not feel like their tasks were explicitly stated
-   need clearer backlog/planning/task ownership
-   repo should become the central organized source instead of scattered Slack discussion
