# User Story 2: Human-in-the-loop Agent Monitoring

**As an Agent Runner,** I want to monitor the progress of my autonomous terminal agent (`ait`) through the Web UI, so that I can "nudge" it in the right direction if it starts working on the wrong files.

### Step-by-Step Experience:
1. **Activity Check:** User opens the Issue Tracker and sees an issue with a pulsating **"Agent Active"** badge.
2. **Deep Dive:** User clicks the issue to open the detail panel and scrolls to the "Agent Activity Log."
3. **Detection:** User reads the log and sees the agent is trying to fix a bug in `auth.py`, but the user knows the bug is actually in `session_manager.ts`.
4. **Intervention:** User types a message into a special **"Steering Note"** field: "Check the session manager instead of the auth logic."
5. **Synchronized Update:** The Web UI sends this note to the API.
6. **Agent Pivot:** The CLI agent pulls the updated issue state, reads the "Steering Note," and shifts its work to the correct file automatically.