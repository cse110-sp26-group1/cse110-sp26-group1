# Frontend styling

Plain vanilla CSS. Styles live in `frontend/css/` and are split into one shared stylesheet (global.css) plus one stylesheet per page (see [structure.md](./structure.md) for the directory layout).

## Stylesheet layout

| File | Scope |
| --- | --- |
| `global.css` | Design tokens (CSS custom properties), base/reset styles, shared component classes, dark mode |
| `login.css` | Login + signup pages (centered card layout) |
| `teams.css` | Teams dashboard |
| `tracker.css` | Issue tracker page (topbar + sidebar grid, issue list, detail panel) |

Every non-redirect page loads `global.css` first, then its own stylesheet. Page CSS may add page-local variables (e.g. `--topbar-h` in `tracker.css`) but shared tokens belong in `global.css`.

## Design tokens

All theming goes through CSS custom properties defined on `:root` in `global.css`. The main groups:

- **Surfaces** — `--bg`, `--surface`, `--surface-2`, `--surface-3` (warm off-white palette)
- **Text ("ink")** — `--ink`, `--ink-2`, `--muted`, `--muted-2`
- **Lines** — `--line`, `--line-strong` for borders and dividers
- **Accent** — warm coral defined in `oklch()`: `--accent`, `--accent-ink`, `--accent-soft`
- **Semantic colors** — issue status (`--st-open`, `--st-prog`, `--st-resolved`, `--st-closed`), priority (`--pri-urgent`), feedback (`--danger`, `--danger-bg`)
- **Type** — `--sans` (system font stack) and `--mono`
- **Shape & depth** — radii `--r-1`/`--r-2`/`--r-3`, `--pill`, shadows `--shadow-1`/`--shadow-2`/`--shadow-pop`, scrims for modal backdrops
- **Layout** — `--sidebar-w`, `--divider-w`

Always use these variables instead of hard-coded colors so dark mode keeps working. New color variants should use `oklch()` like the existing accent/status colors.

## Sizing

The root font size is scaled down (`html { font-size: 87.5%; }`), so **1rem = 14px**. Prefer `rem` for app spacing, borders, radii, shadows, and component dimensions. Use `px` only when intentional, such as responsive breakpoints or a true 1px hairline border.

## Shared component classes

`global.css` provides reusable classes that page markup composes:

- **Buttons** — `.btn` with modifiers `.primary`, `.ghost`, `.sm`, `.icon`; `[disabled]` and `[hidden]` are handled
- **Forms** — `.input`, `.textarea`, `select.input`, wrapped in `.field` with `label`, `.hint`, `.req`; error states via `.input.invalid` and `.field-error`
- **Chips** — `.chip` (+ `.sm`) with status variants `.st-open`, `.st-prog`, `.st-resolved`, `.st-closed`
- **Modals** — `.backdrop` (toggled with `.open`) containing `.modal` with `.modal-head` / `.modal-body` / `.modal-foot`; `.modal-small` for confirms
- **File upload** — `.dropzone` (drag state `.drag`) and `.file-chip`
- **Feedback** — `.toast` (shown with `.show`), `.page-error` full-page error state
- **Identity** — `.avatar` (+ `.sm`), `.user-switch` / `.user-dropdown` menu
- **Utilities** — `.muted`, `.h-2`, `.optional-label`, `.redirect-page`, `.logo`

Before writing new styles, check whether one of these already covers the case. If a pattern is needed on more than one page, move it into `global.css`.

## Dark mode

Dark mode is a `dark` class on `<html>` (persisted in `localStorage` under `theme` — see the theming convention in [structure.md](./structure.md)):

- `html.dark { … }` in `global.css` re-assigns the custom properties (surfaces, ink, lines, shadows) and sets `color-scheme: dark`
- Components that use `var(--ink)` as a *background* need explicit dark-mode overrides for contrast — currently `.btn.primary`, `.toast`, and `.logo` (inverted with `filter`)
- The toggle button uses `.theme-toggle::before` to swap the ☾/☀ glyph
- Non-redirect pages run `theme-init.js` in `<head>` before CSS loads so the saved theme applies without a flash

When adding styles, prefer token variables; only add an `html.dark` override when a component inverts foreground/background.

## Accessibility

- A global `:focus-visible` outline provides a consistent focus ring; don't remove outlines without replacing them (inputs replace it with a border + box-shadow focus style)
- Interactive states (`:hover`, `:active`, `.drag`, `[disabled]`) are styled on the shared classes — keep them when extending components

## Linting

CSS is linted with [Stylelint](https://stylelint.io/) using `stylelint-config-standard` (`.stylelintrc.json` at the repo root), and formatted by Prettier (tabs for indentation):

```bash
npm run lint:css       # check
npm run lint:css:fix   # auto-fix
```

Run before committing; CI expects clean lint output.
