# Linting & Formatting Guide

## Overview
This project uses **ESLint** to catch JavaScript code issues and **Prettier** to enforce consistent formatting. Both tools run automatically in CI via GitHub Actions on every push and pull request.

---

## Setup

From the **root** of the repository, install dependencies:

```bash
npm install
```

This installs ESLint, Prettier, and their shared config as devDependencies.

---

## Running Locally

### ESLint (code quality)

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors where possible
npm run lint:fix
```

### Prettier (formatting)

```bash
# Format all files
npm run format

# Check formatting without writing changes (pass/fail)
npm run format:check
```

---

## What the Linter Checks

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
4. Runs ESLint (`npm run lint`)
5. Checks formatting (`npm run format:check`)

If either step fails, the workflow fails and the PR gets a red X.

---

## Recommended Workflow

1. Write your code
2. Run `npm run format` to auto-format
3. Run `npm run lint:fix` to auto-fix lint issues
4. Fix any remaining lint errors manually
5. Commit and push — CI will verify everything passes
