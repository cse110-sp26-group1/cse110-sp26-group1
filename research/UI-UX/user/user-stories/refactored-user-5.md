# User Story 5: Safety Net and Hallucination Recovery

**As a User,** I want a "kill switch" for AI-generated content, so that if the AI "hallucinates" or provides a bad summary, I can instantly revert to my original data without losing progress.

### Step-by-Step Experience:
1. **Failed Processing:** User submits a complex technical bug. The AI attempts to summarize it but gets the technical details wrong.
2. **Visual Warning:** The UI detects a "Low Confidence" output or the user simply realizes the summary is incorrect.
3. **Reversion:** User clicks a prominent **"Discard AI Changes"** button located at the top of the issue.
4. **Restoration:** The UI instantly wipes the AI's structured fields and restores the user's original, unformatted "Raw Input" text.
5. **Manual Correction:** User manually fills in the fields that the AI failed to handle.
6. **Feedback Loop:** User clicks "Report Bad Suggestion" to flag the specific hallucination for the system developers.