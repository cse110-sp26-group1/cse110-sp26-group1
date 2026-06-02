# The Opera House: Sprint 2 Meeting

### Meeting Type: Sprint Review Meeting

### Purpose:

Evaluate sprint 4 results and show demos

### Present:

- Everyone 

### Absent:

- Ailyn joined via zoom for about 30 mins

### Time and Place:

June 1, 2026 | 4-6pm @ Triton Transfer Hub

## Agenda

- Discuss progress made since Sprint 4
- Review unfinished tasks from Sprint 4
- Demonstrate the working product
- Have everyone use our own product for feedback

---

### Review Notes:

#### What did we get working?

- sign up/log in
- working team workspaces with closed set of issues and members
- invite by username/email to a team workspace
- leaving a team workspace (admin can only leave if only team member present)
- issue creation that leverages an LLM layer
- minimal functionality for editing features
- somewhat functioning sorting and filtering for issues
- CLI tool able to create, read, update issues and is reflected on the UI page

---

#### What needs fixing?

#### Functionality

- Invite user button is unclear (move to a more typical location).
- Cannot delete issues.
- Category field cannot be updated (confirm whether this is intended behavior).
- After switching teams, all issues are displayed instead of only open issues.
- Tags can only be updated to a single tag, despite supporting multiple tags during issue creation.
- Some difficulty levels on the issue contents display (like Medium), don't render the color chip.
- Steps to reproduce (and hypothesis) are not automatically generated for issues that are described vaguely.
- Team page does not always refresh correctly (profile pictures, progress indicators).

#### UI/UX

- Priority dropdown ordering is unintuitive (currently: Medium → Low → High → Critical).
- Assignee profile pictures do not display the correct full name (as well as pfps in each page we have).
- Team invitation timestamps use an unreadable raw ISO format and should match issue date formatting (refer to the google doc).
- Multiple navigation buttons exist for returning from issues to the team page.
- Text overflow issues occur in some views.
- Issue detail section headers (e.g., "Summary") should be visually distinguished with stronger styling.
- Add notification indicators for pending team invites (stretch).

#### AI Features

- Hypothesis summaries update inconsistently across issues.
- Issue summaries update inconsistently.

#### Security

- Website is still flagged as potentially dangerous and requires investigation.

### CLI & Documentation Improvements

- Update `skills.md` documentation to match the current GitHub version.
- Simplify CLI onboarding and setup process.
- Consider creating a dedicated repository for the CLI so users can download it independently.
- Add direct links to the CLI directory in setup instructions.
- Better document how `skills.md` should be used.
- Expand user documentation for different agent environments and where `skills.md` should be placed.

---

### Upcoming tasks:

- Work on Sprint 5 tasks

### Meeting Summary:

Evaluate sprint 4 results and show demos