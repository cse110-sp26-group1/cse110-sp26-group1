# User Story 1: Collaborative Issue Enrichment

**As an Engineer,** I want to use AI to professionalize my rough technical notes, so that I can create high-quality issues without spending 10 minutes on formatting, while still retaining final editorial control.

### Step-by-Step Experience:
1. **Initial Draft:** User opens the "New Issue" modal and types a quick, messy description (e.g., "login button broke on mobile safari").
2. **AI Trigger:** Instead of auto-saving, the user clicks a dedicated **"Propose Enrichment"** button.
3. **Pending State:** The UI shows a "Processing" indicator. The user can still edit their original text during this time.
4. **Review Proposal:** The AI populates suggested fields (Title, Priority, Labels, structured "Steps to Reproduce") in a distinct "Proposed" visual style (e.g., italicized or highlighted).
5. **Human Steering:** User notices the AI suggested "Priority: High" but clicks a "Downgrade" button to set it to "Medium" because they know the fix is non-critical.
6. **Final Commit:** User clicks **"Approve & Post"**. Only then is the issue officially created in the database.