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
  - Large integration ecosystem (Slack, GitHub, GitHub Actions, ...)
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

- **Main idea:** Reliable issue tracker for smaller software teams
- **Unique strengths:**
  - Extremely fast UI with many keyboard shortcuts
  - Strong GitHub/GitLab/Slack integrations (issues can update themselves as pull requests open, branches push, and conversations happen)
- **Cons / Pain Points:**
  - Less customizable than Jira
  - Smaller integration ecosystem
- **Why choose it:**
  - Startups / fast-moving teams prioritizing speed and simplicity can acclimate to Linear probably faster than Jira
  - Moving towards agentic workflows (automation when issues posted, skills, coding agent)
- **Takeaway:** Optimized for **developer productivity and speed**, not complexity

### GitHub Issues

- **Main idea:** Lightweight issue tracking built directly into code hosting
- **Unique strengths:**
  - Seamless integration with code, PRs, and repositories
  - Simple and flexible with minimal setup
- **Cons / Pain Points:**
  - Lacks advanced reporting and workflow features
  - Focus on individual repos
  - Often not chosen for cross-functional teams (Designers, Product Mangers, ...)
- **Why choose it:**
  - Small teams or dev-focused workflows already using GitHub
  - Already a standard heavily used in open source software
- **Takeaway:** Best as a **lightweight, code-centric issue tracker**

## How Issue Trackers Expand Beyond CRUD

## Automation

**Trigger → Condition → Action**

- Many advanced issue trackers like Jira automate using this 3 step process:
  - Trigger: issue changes state (e.g. in-progress to done)
  - Condition: optional filter (e.g. issue type = bug)
  - Action: (e.g.) notify slack, close linked tasks, update backlog
- Can even customize transitions and enforce requirements (like approval)
- Examples:
  - Auto-assign issues when created
  - Move issue to “In Progress” and relevant child-issues when PR opens
  - Close issue when PR is merged
  - Allocate Jira tasks and send meeting summary to Slack after a recorded meeting
  - Notify team on high-priority bugs, new issue comments, ...

## Integrations

- Common integrations
  - Code:
    - GitHub / GitLab
    - PRs linked to issues
  - Communication:
    - Slack / Discord / Loom
    - Notifications, issue creation from chat, meeting summaries
  - Docs:
    - Confluence / Notion
    - Specs linked to issues
  - CI/CD:
    - GitHub Actions
    - Deploy status updates issues

## AI Features

- Summarization of meetings/issues/sprints
- Code generation after viewing issues in code
- Generating entire issues from prompts or Slack conversatoins and updating related tools like the backlog
- **Takeaway** - AI reacts to user input and can update many project communication platforms

## Opportunities for our AI Issue Tracker

Unlike some existing tools where AI acts as an assistant or chat bot, an AI-native issue tracker can treat AI as an active participant in the workflow.

Potential capabilities include:

- **AI-driven workflow participation**:
  - Analyze issues to extract key tasks, priorities, and missing information
  - Generate subtasks from high-level descriptions
  - Suggest or automatically assign work based on context
  - Update issue statuses based on progress or linked events
  - Trigger updates across dashboards and integrations
  - Act as an assignee for certain tasks (delegating work from humans to AI)- **Token and cost tracking**: Track LLM usage (tokens, cost, latency) per issue to monitor resource usage
- **Execution tracking**: Maintain a log of AI actions (e.g., generating content, modifying issues) and track data (token usage, execution start time and end time) for transparency
- **Dual-format issues**: Support both human-readable and agent-readable structured formats
- **AI-triggered automation**: Allow AI to make decisions and trigger workflows dynamically rather than relying only on static rules (relates to first bullet)
- **Context aggregation**: AI can synthesize information across issues, pull requests, and documentation (relates to first bullet)

However, these features must be built on top of strong fundamentals such as:

- clear CRUD operations for issues
- intuitive workflows and status tracking
- collaboration features (comments, assignments)
- fast and simple user experience

#### Sources:

- [Issue Trackers](https://pieces.app/blog/best-bug-tracking-software)
- [Jira Complaints](https://www.reddit.com/r/jira/comments/1qvsbgs/jira_users_free_plan_what_problems_or/)
- [Linear AI push](https://linear.app/next)
- [Linear Specifics](https://thecommonwealthcreative.com/the-codex/linear-issue-tracking/)
