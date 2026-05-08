# Sprint 1 Closing / Pre-Sprint 2 Coordination

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
