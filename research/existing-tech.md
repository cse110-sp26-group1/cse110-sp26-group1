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
