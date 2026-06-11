# Architectural Decision Record: AI-Integrated Issue Tracker

## 1. Dual-Interface API with a Unified Database

- **Status:** Accepted
- **Context:** The system must enable structured collaboration between human users and external AI agents. Humans require a visual interface prioritizing readability, while AI agents need programmatic access to minimal, machine-readable data.
- **Decision:** The backend will act as a central coordinator sharing a single, centralized database as the absolute source of truth. Humans will access the system through a visual interface powered by specific API endpoints. For AI agents, the system will provide a dedicated CLI tool that acts as an intermediary, interacting directly with the backend API to fetch and update structured data.
- **Alternatives Considered:**
  - **Direct Agent API Endpoints:** Initially considered exposing raw API endpoints directly for external AI agents to call. This was shifted to an alternative in favor of the CLI approach, which provides a more structured, standardized, and easily integrable entry point for agents and avoid added complexity and work from the user's side.
  - **Beads (Distributed CLI Tracker):** Considered using local, tools like Beads and Trekker. Rejected because it granted too much autonomous power to the AI rather than supporting structured collaboration. This ultimately did not align with our goal, being the potential target audience/users as well, of creating an issue tracker that utilized help from AI without becoming compeltely dependent on it.
  Sources: [Reddit Post](https://www.reddit.com/r/ClaudeCode/comments/1ov1z94/update_i_tried_beads_for_3_weeks_after_asking/), [Trekker Use Case](https://mcpmarket.com/tools/skills/trekker-issue-tracking#:~:text=leaving%20the%20terminal-,environment,-02) and Professor Powell (demo)
  - **Standard Issue Tracker:** Considered building a traditional tracker with AI assistance limited to issue creation. Rejected because it completely lacked the infrastructure for external AI agents to read from and write to the system.
  Source: [Reddit Comment](https://www.reddit.com/r/ClaudeCode/comments/1rh82ww/comment/o7y6odl/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button)
- **Consequences:** The CLI-to-API approach will introduce slightly more latency compared to purely local tools like Beads. However, it provides a significantly better architecture for team-focused, collaborative environments while making it easier for users to plug their personal agents into the system via standard CLI commands.

---

## 2. LLM-Driven Data Structuring

- **Status:** Accepted
- **Context:** Human input provided via forms is generally unstructured. To reduce friction for humans while ensuring external AI agents receive clean, consistent context, the data must be standardized.
- **Decision:** The backend will route raw user input through an LLM layer (potentially a free model like Deepseek). This LLM will parse the unstructured text into structured, human-readable fields (such as priority levels and summaries) before the backend stores it in the database.
- **Alternatives Considered:**
  - Relying strictly on rigid form inputs without an LLM intermediary. Rejected because it forces the user to manually categorize and structure every detail, increasing friction.
- **Consequences:**
  - **Negative:** Introduces recurring API costs and token tracking overhead for the LLM layer.
  - **Positive:** Generates highly detailed, well-structured context for both humans and agents without demanding additional effort from the human user.

---

## 3. Infrastructure and Tech Stack

- **Status:** Accepted
- **Context:** The backend requires a hosting environment and a database solution to manage the dual-interface API and data storage.
- **Decision:** The project will utilize Cloudflare Workers for the backend environment. Cloudflare D1 will be implemented as the unified database.
- **Alternatives Considered:**
  - **Node.js:** Evaluated as a backend environment but halted due to specific project constraints and limitations.
  - **Standard SQLite:** Originally considered for the database, but once the decision to use Cloudflare Workers was finalized, adopting Cloudflare's native D1 (which is SQLite-backed) became the more cohesive choice.
- **Consequences:** The primary trade-off is the loss of local execution. Relying entirely on Cloudflare Workers and D1 means the team cannot easily run or test the environment locally during development.

---

## 4. Agent Interaction Interface

- **Status:** Accepted
- **Context:** The project requires an interface that is accessible in the terminal so that any AI agent can access the tools we provide in the dual-interface setup.
- **Decision:** The project will have a user's AI agents interact with the service through a command-line tool.
- **Alternatives Considered:**
  - **Command-line Interface** Originally considered because of the idea that a human might potentially want to use the terminal interface. Decided against because designing the interface to be human usable as well was a stretch goal that we decided would not be reached.
- **Consequences:** The primary trade-off is that the terminal interface of the application is now explicitly designed for the agent, rather than being friendly to both human and AI users, although it helps us decrease the amount of time that would be required for implementation.

## 5. Vitest for API Unit Testing

- **Status:** Acceped
- **Context:** The backend API endpoints running on the Cloudflare Worker need to have unit testing.
- **Decision:** The project will use Vitest as it came by default during the setup process of the Cloudflare Worker in the repo.  
- **Alternative Considered:**
  - **Jest:** More team members were familiar with Jest and it was used for a lab, but opted for the Cloudflare default.
- **Consequences:**
  - **Positive:** Vitest integrates with Cloudflare’s Workers test pool, so route handlers run against a Worker-like runtime and D1 binding instead of Jest mocks.
  - **Positive:** Matches the Wrangler project scaffold and official Cloudflare testing path.
  - **Note:** End-to-end UI testing uses Playwright separately; Vitest covers API/unit tests only.

## 6. Playwright for E2E Testing

- **Status:** Accepted
- **Context:** The course requires end-to-end testing demonstrated in the project.
- **Decision:** The project will use **Playwright** for E2E tests, organized under `E2E_test/tests/` and run from the repo root via `npm run test:e2e`. 
- **Alternatives Considered:**
  - **Manual testing and unit testing only** — Rejected; does not meet the requirement to demonstrate E2E in the repo.
- **Consequences:**
  - **Positive:** Team member experience from previous warm-ups and web dev experience
  - **Negative:** E2E suite is heavier to run than unit tests (local Worker + D1 setup required) so decided not to include in the Github Actions checks

## 7. One-Pass LLM Issue Creation

- **Status:** Accepted
- **Context:** The project requires some sort of integration with AI for the issue tracker.
- **Decision:** The issue tracker will go through Deepseek API v4 once on issue creation from the UI. 
- **Alternatives Considered:**
  - **Unlimited** — Rejected; could cost a lot more money when potentially running into infinite loop bugs or other errors that cause large amounts of api calls.
- **Consequences:**
  - **Positive:** LLM layer feature for issue creation still works as expected and minimizes costs
  - **Negative:** User satisfiability with updated issue fields may vary depending on their level of details when creating the issue

## 8. Team Member Privileges

- **Status:** Accepted
- **Context:** Team workspaces in the issue tracker can utilize roles for members to have more privileges
- **Decision:** Team creator is automatically made admin and is the only member authorized to invite and remove users from a team.
- **Alternatives Considered:**
  - **Other Team Members Can Invite** — Rejected; was not worth the time considering the need to prioritize other core project features.
- **Consequences:**
  - **Positive:** Team workspace onboarding and expectations from users is normal and aligns with existing conventions
  - **Negative:** Users may want to explore greater privileges for other members in the future though it's not supported.

