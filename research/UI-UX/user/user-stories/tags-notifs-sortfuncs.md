# Issue Tracker Blueprint: Notifications, Tags, and Sort/Filter Specifications

This document outlines the core architecture for the issue tracker's notification system, classification taxonomy, and search/sorting mechanics.

---

## 1. Notification Architecture

To maintain high team velocity without causing alert fatigue, notifications are split into targeted channels based on urgency and context.

### A. Real-Time In-App Alerts
* **Direct Mentions:** Triggered immediately when a user is tagged (`@username`) in a description or comment.
* **Assignment Updates:** Notifies a team member the moment an issue is assigned to them.
* **Blocking/Dependency Updates:** Automatically alerts the assignee of an issue if a separate "blocking" issue they were waiting on has been marked as *Resolved*.

### B. State & Lifecycle Changes
* **Pipeline Movement:** Alerts watchers when an issue transitions across major workflow states (e.g., `Backlog` → `In Progress` → `In Review` → `Done`).
* **Thread Activity:** Notifies all participants or explicit "watchers" when new comments, code snippets, or attachments are added.

### C. AI-Driven Smart Notifications
* **SLA & Deadline Breaches:** Warns the assignee and project lead 24 hours before a high-priority issue hits its due date if no progress has been recorded.
* **Activity Anomaly Detection:** Alerts the product manager if an issue experiences an unusual spike in activity (e.g., status shifting $>4$ times in a single day), indicating a bottleneck or team misalignment.
* **Automated Digests:** Daily morning summary customizable per user, highlighting "Your Open Tasks Due This Week" and "Stale Issues Awaiting Your Review."

<!--Where should alerts like this be stored, note in figma or create-->
---

## 2. Hardcoded System Classifications & Real Tags

### 1. Core Structural Tags

| Category | Database String | UI Display Label | Recommended UI Color Theme | Purpose / System Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Issue Type** | `type:bug` | 🐛 Bug | Soft Red | Triggers immediate tracking; higher priority in default sorting. |
| | `type:feature` | ✨ Feature | Soft Green | Functional enhancements or new requests. |
| | `type:chore` | ⚙️ Chore | Soft Gray | Tech debt, dependency updates, or maintenance tasks. |
| | `type:docs` | 📝 Docs | Soft Purple | Documentation updates, wikis, or user guides. |
| **Severity** | `p0:critical` | 🚨 P0 - Critical | Solid Dark Red | Triggers real-time alerts; pinned to the top of all views. |
| | `p1:high` | ⚠️ P1 - High | Soft Orange | High-velocity tasks requiring attention within the current sprint. |
| | `p2:medium` | 🗓️ P2 - Medium | Soft Yellow | Standard backlog or scheduled milestone items. |
| | `p3:low` | ☕ P3 - Low | Soft Gray | "Nice-to-have" tasks or minor quality-of-life adjustments. |
| **Scope** | `scope:frontend` | Frontend | Minimal Blue | Routes issues to client-side developers UI/UX layouts. |
| | `scope:backend` | Backend | Minimal Green | Routes issues to API, server logic, or database tasks. |
| | `scope:infra` | Infrastructure | Minimal Teal | Covers CI/CD pipelines, Docker, hosting, or cloud setups. |
| **Status Nuance**| `status:blocked` | 🚫 Blocked | Crimson Outline | Explicitly triggers dependency notification to upstream assignees. |
| | `status:stale` | 😴 Stale | Muted Gray | Automatically applied to open issues with zero updates for $>14$ days. |

### 2. AI-Engine System Tags
*These tags are strictly generated or appended by your backend's AI triage processing pipeline. They use a standard distinct neon-border style in the UI detail view to separate human classification from machine classification.*

| Database String | UI Display Label | Purpose / Backend Trigger Logic |
| :--- | :--- | :--- |
| `ai:duplicate-suspect` | 🤖 Duplicate Suspect | Vector embedding search flags an overlap $>85\%$ with an existing ticket. |
| `ai:sentiment-high` | 🔥 Escalated Priority | NLP engine flags severe frustration or urgency spikes in user text. |
| `ai:effort-low` | ⚡ Quick Win | Match-engine determines the scope is minimal based on past fix cycles. |
| `ai:effort-high` | 🏔️ Complex Scope | Machine learning model flags cross-domain impacts requiring architecture review. |

---

## 3. Sort & Filter Functionality

A robust data grid relies on flexible, low-latency querying metrics to isolate subsets of work.

### A. Sorting Engines
Users can sort lists in ascending (`ASC`) or descending (`DESC`) order using these primary properties:
* **Temporal Metrics:** `Date Created`, `Last Updated`, and `Closed Date`.
* **Urgency Metrics:** `Priority Level` (P0 to P3) and `Hard Due Date / Milestone Target`.
* **Engagement Metrics:** `Comment Volume` or `Reaction Count` (to quickly surface highly-discussed or controversial issues). <!--this would be a new metric to be stored, consult backend-->

### B. Multi-Select & Advanced Filtering
Filters must support cumulative multi-selection alongside boolean exclusion (`NOT`) behaviors:
* **Actor Matrices:** Filter strictly by `Assignee`, `Reporter`, `Authoring Team`, or `Mentioned Users`.
* **Dynamic Timeframes:** Relative queries such as `Created within: Last 24 Hours`, `Updated within: Current Sprint`, or `Overdue`.
* **Target Milestone Release:** Grouping issues explicitly bound to deployment milestones (e.g., `Milestone: v1.2.0-rc1`).
* **Boolean Code Operators:** Enabling specialized syntax logic in the search bar, for example:
  `type:bug scope:frontend NOT status:blocked`

---

## 💡 UX Implementation Highlight: Saved Views

To drastically reduce daily cognitive load for engineers and scrum masters, implement **Saved Views** (Persistent Query States). 

Allow users to define a sophisticated blend of filters and sorting (e.g., *"Show me all P1 frontend bugs assigned to me, sorted by closest due date"*). Users can click **"Save View"** to pin this query directly to their left sidebar navigation or dashboard layout. This eliminates repetitive manual filtering during morning stand-ups.

