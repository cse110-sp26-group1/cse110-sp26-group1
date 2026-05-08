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
