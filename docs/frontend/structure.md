# Frontend structure

The frontend is plain HTML/CSS/JS with no build step — ES modules served as static files. Serve the `frontend/` directory with any static server (see [testing.md](./testing.md) for the local setup).

## Directory layout

```
frontend/
├── html/                 # One HTML file per page
│   ├── index.html        # Entry point; redirects based on auth state
│   ├── login.html        # Sign-in form
│   ├── signup.html       # Signup form
│   ├── teams.html        # Teams dashboard (post-login landing page)
│   ├── tracker.html      # Issue tracker for a single team
│   └── components/       # Shared <template> markup for custom elements
│       ├── invite-row.html
│       ├── issue-row.html
│       └── team-card.html
├── css/
│   ├── global.css        # Shared variables, resets, theme (light/dark) styles
│   ├── login.css         # Login + signup pages
│   ├── teams.css         # Teams dashboard
│   └── tracker.css       # Issue tracker page
├── js/
│   ├── api.js            # All backend communication (see api-integration.md)
│   ├── constants.js      # API_BASE, priority order, status names, tags, categories
│   ├── helpers.js        # Shared UI utilities (theme, password toggles, formatting)
│   ├── theme-init.js     # FOUC guard: applies saved dark theme before first paint
│   ├── index-redirect.js # Auth-aware redirect logic for index.html
│   ├── login.js          # Page script for login.html
│   ├── signup.js         # Page script for signup.html
│   ├── teams.js          # Page script for teams.html
│   ├── tracker.js        # Page script for tracker.html
│   └── components/       # Custom element definitions
│       ├── load-template.js  # Shared template-fetching helper
│       ├── invite-row.js
│       ├── issue-row.js
│       └── team-card.js
├── imgs/                 # Static assets
└── README.md             # Local testing instructions
```

## Pages and their scripts

Each rendered page in `html/` loads exactly one page script from `js/`, plus `theme-init.js` before CSS. `index.html` is the exception: it only loads `index-redirect.js`.

| Page | Script | Purpose |
| --- | --- | --- |
| `index.html` | `index-redirect.js` | Redirects to `teams.html` if a token exists, otherwise to `login.html?redirect=<teams URL>` |
| `login.html` | `login.js` | Sign-in; calls `login()` from `api.js`, stores the token, follows `?redirect=` |
| `signup.html` | `signup.js` | Registration via `createAccount()` |
| `teams.html` | `teams.js` | Lists teams and pending invites; create/leave/manage teams |
| `tracker.html` | `tracker.js` | Issue list, filters, issue detail, create/edit/delete for one team |

Protected pages call `requireAuth()` at the top of their script; auth pages call `requireNoAuth()`. See [api-integration.md](./api-integration.md).

## Components

Reusable UI pieces are custom elements (`<team-card>`, `<issue-row>`, `<invite-row>`). Each one is split into two files:

- **Markup** lives in `html/components/*.html` as a `<template>` element
- **Behavior** lives in `js/components/*.js` as a class extending `HTMLElement`

The JS side fetches its template once via `loadHtmlTemplate()` (`js/components/load-template.js`), caches it in a module-level variable, and clones it in `connectedCallback()`. Data flows in through observed attributes (e.g. `team-id`, `name`, `role`), and `attributeChangedCallback()` re-renders on changes.

To add a new component, follow this pattern: create the template HTML in `html/components/`, the element class in `js/components/`, and import the module from the page script that uses it.

## Conventions

- **No framework, no bundler** — everything is native ES modules. Import paths must include the `.js` extension and be relative.
- **All backend API calls go through `js/api.js`** — page scripts should not call backend endpoints with `fetch` directly. Direct `fetch` is still used for static assets such as templates and downloadable files.
- **Shared constants live in `js/constants.js`** — statuses, priorities, tags, categories, and the API base URL.
- **Theming** uses a `dark` class on `<html>`, persisted in `localStorage` under `theme`. Non-redirect pages include `theme-init.js` in `<head>` *before* CSS so the saved theme applies without a flash of the wrong theme; `initTheme()` in `helpers.js` wires the toggle button after load.
- **Per-page CSS** — `global.css` holds shared variables and base styles; each page additionally loads its own stylesheet.
