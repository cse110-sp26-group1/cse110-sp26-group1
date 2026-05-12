# Non-Functional Requirements Research


## User-Facing

### Usability
- **Definition:** In software engineering, usability is the degree to which a software can be used by specified consumers to achieve quantified objectives with effectiveness, efficiency, and satisfaction in a quantified context of use.
  - *Simply: How easy and pleasant it is for a user to get something done.*
- **Why it matters for AIT:** The spec explicitly calls for "less friction" and "AI-level speeds." If creating or updating an issue takes too many steps, the tool slows down the workflow it's meant to support both for human developers and for AI agents acting on their behalf.
- **Measurable target:** A new user should be able to create, assign, and close an issue in under 60 seconds without any guidance. Task completion rate of 90%+ in user testing.
- **Design implications:** Prioritize keyboard shortcuts, minimal required fields on issue creation, and clear affordances (buttons/labels that obviously do what they say). Avoid modal-heavy flows.

### Learnability
- **Definition:** In software development and product design, learnability describes a quality of products and interfaces that allows users to quickly become familiar with them and able to make good use of all their features and capabilities.
  - *Simply: How fast a new user can figure out how to use it.*
- **Why it matters for AIT:** New team members or external collaborators shouldn't need a tutorial to start using the tracker. Since the app may also be used by AI agents, the interface and data model should be self-describing.
- **Measurable target:** A first-time user with no onboarding should complete basic CRUD operations (create, view, update, delete an issue) within 5 minutes.
- **Design implications:** Use familiar issue tracker conventions (status labels, assignee fields, priority tags). Include inline hints or placeholder text rather than separate documentation for common actions.

### Accessibility
- **Definition:** Accessibility is the design of products, devices, services, vehicles, or environments to be usable by disabled people.
  - *Simply: Can someone with a disability still use it?*
- **Why it matters for AIT:** Even as an internal dev tool, accessibility is a baseline standard of quality. It also overlaps with keyboard usability, which benefits all power users.
- **Measurable target:** Meet WCAG 2.1 AA standards sufficient color contrast (4.5:1 ratio for normal text), all interactive elements reachable via keyboard, and screen-reader-compatible HTML semantics.
- **Design implications:** Use semantic HTML elements (`<button>`, `<nav>`, `<main>`), add `aria-label` attributes where needed, and never rely on color alone to convey meaning (e.g., status indicators should also use text or icons).

### Performance
- **Definition:** Performance refers to how fast and smoothly a system responds to user actions and completes tasks under expected conditions.
  - *Simply: Does it run fast and not lag?*
- **Why it matters for AIT:** A slow issue tracker breaks developer flow. Since the app is static (GitHub Pages / Cloudflare), there's no server to offload work to all rendering and data handling happens client-side, making performance a design responsibility.
- **Measurable target:** Initial page load under 2 seconds on a standard connection. Issue list rendering under 300ms for up to 500 issues. LLM-powered features should show a loading state within 100ms of being triggered.
- **Design implications:** Minimize and lazy-load assets. Avoid blocking the main thread with large data operations. For AI features, use streaming responses and optimistic UI updates rather than waiting for full API responses.

### Aesthetics
- **Definition:** Aesthetics in software refers to the visual quality and consistency of an interface including layout, typography, color, and overall design coherence.
  - *Simply: Does it look good and feel polished? does using it feel good?*
- **Why it matters for AIT:** The spec encourages building something resume-worthy. A visually polished tool signals professionalism and makes it more compelling in interviews and demos. Aditionally, user experience is very important so it is significant to learn how to build something users would want to use. 
- **Measurable target:** 80%+ of surveyed users rate the UI as "visually appealing" or "professional" in user testing. Design follows a consistent system (spacing scale, color palette, type hierarchy).
- **Design implications:** Define a minimal design system early a color palette, spacing scale, and type styles and apply it consistently across all views. Avoid mixing unrelated UI conventions.

---

## System Quality

### Modifiability
- **Definition:** Modifiability is the degree to which a system can be changed without introducing defects or degrading existing quality.
  - *Simply: How easy it is to change the code without breaking things.*
- **Why it matters for AIT:** Requirements will evolve sprint-to-sprint. Features like token tracking or agent integrations will be added incrementally, so the codebase needs to tolerate change cleanly.
- **Measurable target:** Adding a new issue field (e.g., "token budget") should require changes to no more than 3 files. No single function exceeds 50 lines.
- **Design implications:** Separate data models from UI rendering. Use clear module boundaries so changes to one feature don't ripple unexpectedly into others. Document architectural decisions in ADRs so future changes are informed.

### Reliability
- **Definition:** Software reliability is the probability that a system performs its required functions without failure under stated conditions for a specified period of time.
  - *Simply: Does it work consistently and not break or lose data?*
- **Why it matters for AIT:** An issue tracker that loses data or produces inconsistent state is worse than useless especially if an AI agent is reading from it and making decisions. Dropped writes or stale reads could silently corrupt a team's workflow.
- **Measurable target:** Zero data loss on issue create/update/delete operations under normal conditions. Application should degrade gracefully (show an error state, not a blank screen) if an LLM API call fails.
- **Design implications:** Validate all writes before committing them. Handle API failures explicitly with fallback UI. For local storage, confirm writes were successful before updating the displayed state.

### Maintainability
- **Definition:** Maintainability is the ease with which a software system can be modified to correct faults, improve performance, or adapt to a changed environment.
  - *Simply: How easy it is for someone new (or future-you) to understand and fix the code.*
- **Why it matters for AIT:** The spec requires JSDocs, a changelog, ADRs, and a technical documentation site all of which are maintainability investments. A codebase the TA reviewer can't follow will cost points.
- **Measurable target:** All exported functions have JSDoc comments. A new team member should be able to find and fix a labeled bug within 30 minutes using only the repo documentation.
- **Design implications:** Consistent naming conventions, inline comments for non-obvious logic, and a documented folder structure. Keep the README and technical wiki up to date as the codebase evolves.

### Testability
- **Definition:** Software testability is the degree to which a software artifact supports testing meaning how easy it is to write tests that can detect real faults.
  - *Simply: How easy it is to write tests for the code.*
- **Why it matters for AIT:** The spec requires both unit and e2e tests and mandates that testing happen throughout the project, not just at the end. Code that's hard to test usually signals poor separation of concerns.
- **Measurable target:** Core business logic (issue creation, status transitions, token tracking) covered by unit tests with 80%+ code coverage. At least one e2e test per major user flow.
- **Design implications:** Separate business logic from DOM manipulation so it can be tested without a browser. Use dependency injection for external services (LLM APIs, storage) so they can be mocked in tests.

### Scalability
- **Definition:** Scalability is the property of a system to handle a growing amount of work. One definition for software systems specifies that this may be done by adding resources to the system.
  - *Simply: Can it handle more data or users without falling apart?*
- **Why it matters for AIT:** While the initial user base is small, the app may accumulate hundreds or thousands of issues over time. Since storage is client-side (JSON/localStorage), there's a natural ceiling to be aware of.
- **Measurable target:** The app should render and filter a list of 1,000 issues in under 500ms. localStorage usage should stay under 4MB with a warning shown to the user as it approaches the limit.
- **Design implications:** Use pagination or virtual scrolling for issue lists rather than rendering everything at once. Consider an indexing strategy for filtering/searching large datasets client-side.

### Portability
- **Definition:** Software portability is a design objective for source code to be easily made to run on different platforms.
  - *Simply: Does it work the same everywhere it needs to run?*
- **Why it matters for AIT:** The spec restricts deployment to GitHub Pages or Cloudflare (static hosting only), and forbids server-side technologies that don't work there. The app also needs to work across modern browsers.
- **Measurable target:** Full functionality in the latest versions of Chrome, Firefox, and Safari. No server-side dependencies that would break on static hosting.
- **Design implications:** Avoid browser-specific APIs without polyfills. Stick to the allowed tech stack (vanilla JS, HTML, CSS). Test on multiple browsers during development, not just at the end.

### Securability
- **Definition:** Securability focuses on protecting software systems and data from unauthorized access, disclosure, or disruption.
  - *Simply: Is the app and its data protected from misuse or exposure?*
- **Why it matters for AIT:** The app will likely handle LLM API keys and potentially integrate with GitHub or Slack. Exposing API keys client-side is a real and common vulnerability in browser-based tools.
- **Measurable target:** No API keys stored in plaintext in the repository or exposed in client-side JavaScript bundles. Any user-provided credentials stored only in memory or encrypted local storage.
- **Design implications:** Never hardcode secrets in source files. Use environment variables at build time where possible. Document in the README how users should supply their own API keys safely. Add a `.gitignore` rule to prevent any config files with secrets from being committed.

---

## AI / Integration-Specific

### Observability
- **Definition:** Observability is a measure of how well the internal state of a system can be inferred from its external outputs such as logs, metrics, and traces.
  - *Simply: Can you tell what the system is doing and why, just by looking at its outputs?*
- **Why it matters for AIT:** The spec asks whether agents can track tokens, budget, and time. If AI-driven actions are invisible, debugging failures or unexpected behavior becomes very hard. Developers need to see what the agent did, when, and at what cost.
- **Measurable target:** Every LLM API call logs its model, token usage, latency, and outcome. A dashboard view shows total tokens used and estimated cost for the current session.
- **Design implications:** Wrap all LLM calls in a logging layer that captures metadata before and after each request. Surface this data in a visible "AI activity" view rather than hiding it in the browser console.

### Auditability
- **Definition:** Auditability is the ability to reconstruct the history of actions taken within a system who did what, when, and to what.
  - *Simply: Can you look back and see exactly what happened and who caused it?*
- **Why it matters for AIT:** When an AI agent creates, updates, or closes issues, there needs to be a record distinguishing agent actions from human actions. Without this, teams can't understand or trust the state of their issue tracker.
- **Measurable target:** Every issue mutation (create, update, delete) stores a timestamp and an actor field (human username or "agent"). An audit log view is accessible from each issue.
- **Design implications:** Treat the actor field as a required attribute on every write operation. Design the data model to store an event log alongside each issue's current state, not just the final snapshot.

### Extensibility
- **Definition:** Extensibility is a software engineering and systems design principle that provides for future growth. Extensibility is a measure of the ability to extend a system and the level of effort required to implement the extension.
  - *Simply: How easy it is to add new features or connect new tools later.*
- **Why it matters for AIT:** The spec envisions integrations with GitHub, Slack, and LLM APIs. The team won't build all of these at once, so the architecture needs to support adding integrations incrementally without rewriting core logic.
- **Measurable target:** Adding a new integration (e.g., a new LLM provider) should require creating one new module and modifying no existing modules. Defined via a consistent integration interface/contract.
- **Design implications:** Define a clear interface for integrations (e.g., all LLM providers expose the same `complete(prompt)` function). Use a plugin-style pattern so the core app doesn't need to know the specifics of each integration.

### Interoperability
- **Definition:** Interoperability is a characteristic of a product or system to work with other products or systems.
  - *Simply: Can it talk to other tools and actually share useful information with them?*
- **Why it matters for AIT:** The spec asks whether an agent can read issues, and envisions integration with GitHub, Slack, and potentially other tools in the software engineering workflow. The format and API design of AIT determines whether any of this is possible.
- **Measurable target:** Issues are stored and exposed in a documented JSON format. At least one external system (e.g., GitHub Issues or a LLM via API) can read from or write to AIT without custom hacks.
- **Design implications:** Design the issue data model with interoperability in mind from the start use standard field names, ISO timestamps, and avoid app-specific IDs that don't map to anything external. Consider exposing a simple REST-style interface or export function.

### Security / Confidentiality
- **Definition:** Confidentiality ensures that sensitive information is accessible only to those authorized to access it, and is not exposed to unauthorized parties.
  - *Simply: Private data stays private and is only visible to the right people.*
- **Why it matters for AIT:** If the app integrates with LLM APIs or GitHub, it may handle tokens, credentials, or proprietary issue content. Mishandling these could expose sensitive project data or incur unauthorized API charges.
- **Measurable target:** No credentials or tokens appear in the browser's localStorage in plaintext. No sensitive data is sent to third-party services beyond the explicitly intended integrations.
- **Design implications:** Clearly separate configuration (user-supplied keys) from application code. Prompt users to input credentials at runtime rather than storing them persistently. Document the data flow for all third-party integrations so the team understands exactly what information leaves the app.

---

## Sources & References

| "-ility" | Source URL |
|----------|------------|
| Usability | https://en.wikipedia.org/wiki/Usability |
| Learnability | https://en.wikipedia.org/wiki/Learnability |
| Accessibility | https://en.wikipedia.org/wiki/Accessibility |
| Performance | https://en.wikipedia.org/wiki/Computer_performance |
| Aesthetics | https://en.wikipedia.org/wiki/Aesthetics |
| Modifiability | https://en.wikipedia.org/wiki/List_of_system_quality_attributes |
| Reliability | https://en.wikipedia.org/wiki/Software_reliability |
| Maintainability | https://en.wikipedia.org/wiki/Maintainability |
| Testability | https://en.wikipedia.org/wiki/Software_testability |
| Scalability | https://en.wikipedia.org/wiki/Scalability |
| Portability | https://en.wikipedia.org/wiki/Software_portability |
| Securability | https://en.wikipedia.org/wiki/Information_security |
| Observability | https://en.wikipedia.org/wiki/Observability |
| Auditability | https://en.wikipedia.org/wiki/Audit_trail |
| Extensibility | https://en.wikipedia.org/wiki/Extensibility |
| Interoperability | https://en.wikipedia.org/wiki/Interoperability |
| Security / Confidentiality | https://en.wikipedia.org/wiki/Confidentiality |
| System Quality Attributes (general) | https://en.wikipedia.org/wiki/List_of_system_quality_attributes |

