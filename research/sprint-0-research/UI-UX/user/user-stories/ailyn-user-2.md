# User Story 2: Toggleable Human/Agent Data Views

## Story

As a user of the Agent Issue Tracker, I want to be able to toggle between a "Human-Friendly" layout and an "Agent-Optimized" data view so that I can see the information most relevant to me while ensuring the agent has access to the raw structured data it needs.

## Why This Matters

A fundamental challenge of AIT is that humans and agents consume information differently. Humans need visual hierarchy, icons, and summaries to avoid burnout. Agents need high-density, structured data (like JSON or Markdown tables) and clear metadata links. Instead of compromising the UI for one or the other, providing dual views ensures readability for both  the human and the agent.

## Acceptance Criteria

- Global or per-issue toggle allows the user to switch between "Standard View" and "Agent View."
- The "Agent View" highlights structured fields, unique identifiers (UUIDs), and raw token/budget metadata.
- The "Standard View" or "Human View" prioritizes readability, using status colors, progress bars, and formatted descriptions.
- Users can copy an "Agent-Ready" snippet of any issue to the clipboard for use in LLM prompts.
- Changes made in one view are instantly reflected and synced in the other.

## UI/UX Notes

- The toggle should be easily accessible but not intrusive (i.e. a top-right view icon).
- In "Agent View," use a monospaced font and a "code-editor" aesthetic to signal the different context.
- Use tooltips to explain specific "agent-only" fields to human users who might be curious about the underlying data.