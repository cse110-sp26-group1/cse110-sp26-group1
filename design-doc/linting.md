# Linting & Formatting Guide

## Overview
This project uses **ESLint** (JavaScript), **Stylelint** (CSS), and **HTMLHint** (HTML) to catch code issues, and **Prettier** to enforce consistent formatting. All four tools run automatically in CI via GitHub Actions on every push and pull request.

---

## Setup

From the **root** of the repository, install dependencies:

```bash
npm install
```

This installs ESLint, Stylelint, HTMLHint, Prettier, and their shared configs as devDependencies.

---

## Running Locally

### All linters

```bash
# Run every linter (JS + CSS + HTML)
npm run lint

# Auto-fix everything that can be auto-fixed (JS + CSS)
npm run lint:fix
```

### ESLint (JavaScript)

```bash
npm run lint:js
npm run lint:js:fix
```

### Stylelint (CSS)

```bash
npm run lint:css
npm run lint:css:fix
```

### HTMLHint (HTML)

```bash
npm run lint:html
```

HTMLHint does not support auto-fix; fix issues manually.

### Prettier (formatting)

```bash
# Format all files
npm run format

# Check formatting without writing changes (pass/fail)
npm run format:check
```

---

## What ESLint Checks (JavaScript)

ESLint is configured in `eslint.config.js` with the following rules:

| Rule | Level | What it does |
|------|-------|-------------|
| `no-unused-vars` | warn | Flags variables that are declared but never used (ignores `_`-prefixed args) |
| `no-undef` | error | Flags usage of undeclared variables |
| `no-console` | warn | Flags `console.log` statements |
| `eqeqeq` | error | Requires `===` and `!==` instead of `==` and `!=` |
| `curly` | error | Requires curly braces for all control flow (`if`, `else`, `for`, etc.) |
| `no-var` | error | Disallows `var`; use `let` or `const` instead |
| `prefer-const` | warn | Suggests `const` when a variable is never reassigned |

ESLint ignores: `node_modules/`, `dist/`, `build/`, `coverage/`, `.wrangler/`, `research/`

---

## What Stylelint Checks (CSS)

Stylelint is configured in `.stylelintrc.json` and extends [`stylelint-config-standard`](https://github.com/stylelint/stylelint-config-standard) with no rule overrides. This is the community-maintained baseline and catches issues like:

- Invalid CSS syntax and unknown properties / at-rules
- Duplicate properties or selectors inside the same rule
- Invalid color, length, or function values (incl. modern `oklch()` notation: percentages for lightness, `deg` for hue, `%` for alpha)
- Short-form hex colors (`#fff` over `#ffffff`)
- Consistent empty-line spacing before rules, at-rules, and custom properties
- Modern media-query syntax (`(width >= 600px)` over `(min-width: 600px)`)
- Common typos (e.g. misspelled pseudo-classes)

Most issues are auto-fixable with `npm run lint:css:fix`. The full list of rules lives in the [`stylelint-config-standard` documentation](https://github.com/stylelint/stylelint-config-standard#the-rules). If a specific rule turns out to be more noise than signal for this project, add an override in `.stylelintrc.json`.

Stylelint ignores the paths listed in `.stylelintignore`: `node_modules/`, build output, and `research/`.

---

## What HTMLHint Checks (HTML)

HTMLHint is configured in `.htmlhintrc` and enforces:

| Rule | What it does |
|------|--------------|
| `tagname-lowercase` | Tag names must be lowercase |
| `attr-lowercase` | Attribute names must be lowercase |
| `attr-value-double-quotes` | Attribute values must use double quotes |
| `attr-no-duplication` | No duplicate attributes on the same element |
| `attr-unsafe-chars` | Flags unsafe characters in attribute values |
| `doctype-first` | `<!doctype>` must be the first thing in the document |
| `doctype-html5` | Doctype must be HTML5 (`<!doctype html>`) |
| `tag-pair` | Every opening tag has a matching closing tag |
| `spec-char-escape` | Special characters (`<`, `>`, `&`) must be escaped |
| `id-unique` | `id` values must be unique within a page |
| `id-class-value` | `id` / `class` values must be kebab-case (e.g. `team-label`, not `teamLabel`) |
| `id-class-ad-disabled` | Disallows `id`/`class` values matching common ad-blocker patterns |
| `src-not-empty` | `src` and `href` attributes must not be empty |
| `title-require` | `<head>` must contain a `<title>` |
| `alt-require` | `<img>` / `<area>` must have an `alt` attribute |
| `space-tab-mixed-disabled` | Indentation must be tabs (matches our Prettier config) |

These are sensible HTML5 best-practice defaults. HTMLHint has no auto-fix mode, so issues must be corrected manually. If a rule turns out not to fit the project, edit `.htmlhintrc` to relax it.

The lint glob is scoped to `frontend/**/*.html` and explicitly ignores the `frontend/html/components/**` folder, since template partials there are document fragments (no `<!doctype>` / `<html>` tag) and intentionally fail page-level rules.

---

## Prettier Settings

Configured in `.prettierrc`:

| Setting | Value |
|---------|-------|
| Print width | 140 |
| Quotes | Single |
| Semicolons | Yes |
| Indentation | Tabs |

Prettier ignores files listed in `.prettierignore`: `node_modules/`, build output, `package-lock.json`, and markdown files.

---

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/lint.yml`) runs on every **push** and **pull request**:

1. Checks out the code
2. Sets up Node.js 20
3. Installs dependencies
4. Runs ESLint (`npm run lint:js`)
5. Runs Stylelint (`npm run lint:css`)
6. Runs HTMLHint (`npm run lint:html`)
7. Checks formatting (`npm run format:check`)

If any step fails, the workflow fails and the PR gets a red X. Each linter runs as a separate CI step so you can see at a glance which language failed.

---

## Recommended Workflow

1. Write your code
2. Run `npm run format` to auto-format
3. Run `npm run lint:fix` to auto-fix JS and CSS issues
4. Run `npm run lint` to surface any remaining issues (including HTML)
5. Fix remaining issues manually
6. Commit and push — CI will verify everything passes
