# Frontend

## Overview

The frontend is a static multi-page prototype for **Allegro**, the team's AI-aware issue tracker. It uses plain HTML, CSS, and ES modules only: no bundler, no framework, and no frontend build step.

The current implementation is intentionally prototype-oriented:

- Core page flows work locally.
- Most data comes from in-memory mock objects in `js/data.js`.
- Several controls are presentational only and do not talk to the backend yet.

## Run Locally

Serve the `frontend/` directory with any static file server. Using a server is recommended because the pages load ES modules.

```bash
cd frontend
python3 -m http.server 4173
```

Then open:

- `http://localhost:4173/login.html`
- `http://localhost:4173/teams.html`
- `http://localhost:4173/tracker.html?team=studio-ai`

`index.html` redirects to `teams.html`.

## Directory Map

```text
frontend/
├── index.html
├── login.html
├── teams.html
├── tracker.html
├── styles.css
├── login.css
├── teams.css
├── tracker.css
├── README.md
├── fontend-documentation.md
└── js/
    ├── data.js
    ├── login.js
    ├── teams.js
    ├── theme.js
    └── tracker.js
```

## Page Responsibilities

### `login.html`

Authentication prototype with sign-in and sign-up modes.

- `js/login.js` switches between modes by toggling body classes.
- Form submission validates that email is non-empty, then redirects to `teams.html`.
- Social auth buttons and password recovery are UI-only placeholders.
- Theme choice is shared across pages through `localStorage`.

### `teams.html`

Team picker and team-creation prototype.

- Team cards navigate to `tracker.html?team=<slug>`.
- "New team" opens a modal and auto-generates a slug from the entered name.
- Accepting an invite shows a toast, then routes to the invited team workspace.
- Search, sort, "Join with code", and decline actions are currently presentational only.

### `tracker.html`

Primary issue-tracker screen.

- Reads the `team` query parameter and updates the visible team badge.
- Renders an issue list from mock data.
- Supports sort-by-priority, sort-by-updated, sort-by-difficulty, and tag filtering.
- Renders a detail pane for the selected issue.
- Supports a new-issue modal with drag-and-drop file attachments.
- Simulates AI enrichment by creating new issues in `pending` state, then flipping them to `open` after a timeout.
- Lets the user download an agent-facing `skills.md` file generated from `js/data.js`.

Important prototype limitation:

- Switching teams from the tracker dropdown updates the UI only. It does not rewrite the URL or fetch a different issue dataset yet.

## JavaScript Modules

### `js/theme.js`

Shared theme controller used by all pages.

- Reads `localStorage.theme`.
- Applies or removes the `.dark` class on `<html>`.
- Wires the page-local `#themeToggle` button when present.

Each HTML page also includes a tiny inline script in `<head>` so the saved theme is applied before paint and avoids a flash of the wrong theme.

### `js/data.js`

Static source of truth for the prototype.

- Exports ordering maps for status and priority.
- Exports team metadata used by the tracker team switcher.
- Exports mock issues rendered by `tracker.js`.
- Exports `SKILLS_MD`, the generated markdown file downloaded from the tracker sidebar.

This is the first file to replace when wiring the frontend to real API data.

### `js/login.js`

Owns the login/signup mode toggle and the prototype redirect after submit.

### `js/teams.js`

Owns:

- create-team modal open/close
- slug generation from team name
- create-team redirect
- invite acceptance toast behavior

### `js/tracker.js`

Owns nearly all tracker interactivity.

Main responsibilities:

- local UI state for sorting, tag filters, selected issue, and detail-pane visibility
- issue list rendering
- issue detail rendering
- team dropdown behavior
- draggable list/detail divider
- new-issue modal lifecycle
- temporary toast notifications
- keyboard shortcuts
- `skills.md` download

## Data Flow

The tracker is built around a small mutable state object:

```js
const state = {
  sort: 'priority',
  tag: 'all',
  selected: 142,
  detailOpen: true,
};
```

The general pattern is:

1. A user event mutates local state or the in-memory `ISSUES` array.
2. The relevant render function is called.
3. The DOM is regenerated with template strings and rebound event listeners where needed.

This is simple and easy to follow, but it means rendering and data access are tightly coupled inside `tracker.js`.

## Persistence

The frontend currently persists only a small amount of client state:

- `localStorage.theme`: light or dark mode
- `localStorage.detailWidth`: the list/detail split set by dragging the divider

Issue data, team data, and session state are not persisted client-side beyond the lifetime of the page.

## Interactive vs Placeholder Features

The prototype mixes working UI flows with non-functional placeholders. That distinction matters when building on top of it.

Interactive today:

- theme toggle
- login/signup mode switch
- team-card navigation
- create-team modal
- invite accept flow
- issue sorting and tag filtering
- issue selection
- detail-pane collapse toggle
- divider drag resizing
- new-issue creation
- file attachment chips in the new-issue modal
- keyboard shortcuts
- `skills.md` download

Placeholder-only today:

- real authentication
- top-bar search
- notifications button
- edit/copy-link/mark-done buttons in issue detail
- sidebar counts and most sidebar filter rows
- backend-backed team switching
- real file upload persistence
- live issue CRUD against the API

## Backend Integration Notes

The frontend already hints at the API contract expected by the team:

- `GET /api/issues`
- `GET /api/issues/:id`
- `POST /api/issues`
- `PATCH /api/issues/:id`
- `DELETE /api/issues/:id`

Recommended integration path:

1. Replace `TEAMS` and `ISSUES` reads in `js/data.js` with async fetch helpers.
2. Introduce a small API layer so `tracker.js` stops mutating imported mock arrays directly.
3. Update the create-team, invite, login, and tracker team-switch flows to use real backend state.
4. Keep `SKILLS_MD` in sync with the actual backend contract once endpoints stabilize.

## Styling Notes

The shared visual system lives in `styles.css`.

- CSS custom properties define surfaces, typography, semantic colors, radii, and shadows.
- Page-specific CSS files layer layout and component styling on top of those shared tokens.
- Dark mode works by overriding the token set under `.dark`.

## Known Constraints

- No client-side router; navigation uses normal links and `location.href`.
- The tracker uses template-string rendering instead of componentized UI primitives.
- There is no test coverage for frontend behavior in this repository yet.
- Accessibility is partially addressed, but keyboard and screen-reader coverage is not complete.

## Suggested Next Docs To Add

- a UI state diagram for `tracker.js`
- a frontend-to-backend API mapping once fetch calls land
- accessibility and keyboard support expectations per page
- screenshot-based docs for demos and sprint handoff
