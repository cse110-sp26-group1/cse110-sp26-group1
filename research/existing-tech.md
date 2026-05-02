# Existing Tech (References for Issue Tracking)

## Key Features of Issue Trackers

- ticket CRUD operations with detailed descriptions and labels/tags
- issues have section for commenting (review, collaboration)
- issue assignment (linking specific issues to assigned members) and linking to PRs
- status tracking (new/open, in progress, resolved/fixed, closed)
- basic search/filtering for issues
- software often combines issue tracking capabilities with other project management tools like Kanban boards

---

### Jira

- **Main idea:** Enterprise-level project management system with issue tracking
- **Strengths:**
  - Highly customizable workflows
  - Strong Agile support (Scrum/Kanban, reporting, dashboards)
  - Large integration ecosystem
- **Cons / Pain Points:**
  - Complex and takes a while to learn/setup
  - Can feel slow, bloated, and overkill for small teams as it has so many features
  - Users report slow loading pages, and sometimes loading states don't exist at all
- **Why choose it:**
  - Large teams needing structure, reporting, and scalability
- **AI Compatibility**
  - Atlassian Intelligence (Prompt-Based AI Assistant) layered on top of Jira for _paid_ plans
  - Utilizes LLM for generating structured issue descriptions, summarizing comment threads, creating tickets from conversations
  - AI Chat can help with questions regarding project (pulls from data in backlog issues, tickets, and documentation, but does not interpret information from UI humans see)
- **Takeaway:** More of a **full workflow platform** than just an issue tracker, with existing AI integration into issue tracking.

### Linear

- **Main idea:** Modern, fast, developer-first issue tracker
- **Unique strengths:**
  - Extremely fast UI, keyboard-first workflow
  - Clean, opinionated design (low friction)
  - Strong GitHub/GitLab integrations
- **Cons / Pain Points:**
  - Less customizable than Jira
  - Smaller integration ecosystem
- **Why choose it:**
  - Startups / fast-moving teams prioritizing speed and simplicity
- **Takeaway:** Optimized for **developer productivity and speed**, not complexity

### GitHub Issues

- **Main idea:** Lightweight issue tracking built directly into code hosting
- **Unique strengths:**
  - Seamless integration with code, PRs, and repositories
  - Simple and flexible with minimal setup
- **Cons / Pain Points:**
  - Limited structure and scalability for large teams
  - Lacks advanced reporting and workflow features
- **Why choose it:**
  - Small teams or dev-focused workflows already using GitHub
- **Takeaway:** Best as a **lightweight, code-centric issue tracker**
