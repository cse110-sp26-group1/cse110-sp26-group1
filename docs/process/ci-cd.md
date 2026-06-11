# CI/CD

This document describes our continuous integration and continuous deployment (CI/CD) setup. All automation runs through [GitHub Actions](https://docs.github.com/en/actions), with each workflow defined as a YAML file under [`.github/workflows`](../../.github/workflows).

## Overview

Our pipeline covers three areas:

- **Integration** — every push and pull request is linted and tested so problems are caught before merging.
- **Deployment** — once changes land on `main`, the frontend and API are deployed automatically.
- **Release management** — versions and release notes are generated automatically from our commit history.

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| Lint | `lint.yml` | Every push and PR | Check JS, CSS, HTML, and formatting |
| API Tests | `api-tests.yml` | Changes to the API | Run the API test suite |
| PR Size Check | `pr-size-check.yml` | Pull requests to `main` | Require review for large PRs |
| Deploy frontend to GitHub Pages | `pages.yml` | Push to `main` | Deploy the frontend |
| Deploy Worker | `deploy-worker.yml` | Changes to the API on `main` | Deploy the Cloudflare Worker |
| Release | `release.yml` | Push to `main` | Create version tags and releases |

## Continuous Integration

### Lint (`lint.yml`)

Runs on every push and pull request. It installs dependencies on Node 20 and runs each of our linters in turn:

- `npm run lint:js` — [ESLint](https://eslint.org/) for JavaScript
- `npm run lint:css` — [Stylelint](https://stylelint.io/) for CSS
- `npm run lint:html` — [HTMLHint](https://htmlhint.com/) for HTML
- `npm run format:check` — [Prettier](https://prettier.io/) formatting check

If any check fails, the workflow fails, signalling that the code needs to be cleaned up before it is merged.

### API Tests (`api-tests.yml`)

Runs the backend test suite whenever files under `issue-tracker-api/` (or the workflow itself) change, on both pushes and pull requests. Scoping the trigger to the API directory keeps unrelated frontend changes from running these tests unnecessarily.

### PR Size Check (`pr-size-check.yml`)

Runs on every pull request targeting `main`. It counts the total number of lines changed (insertions plus deletions) in the PR. If a PR changes **more than 300 lines**, it must have at least one approved review before it can pass this check. This keeps our pull requests small and reviewable, and ensures larger changes get a second pair of eyes.

## Continuous Deployment

### Deploy frontend to GitHub Pages (`pages.yml`)

Runs on every push to `main` (and can be triggered manually with `workflow_dispatch`). It uploads the contents of the `frontend/` directory and deploys them to [GitHub Pages](https://pages.github.com/).

### Deploy Worker (`deploy-worker.yml`)

Runs on pushes to `main` that touch `issue-tracker-api/`. It deploys the API to [Cloudflare Workers](https://developers.cloudflare.com/workers/) using the [`wrangler-action`](https://github.com/cloudflare/wrangler-action). Credentials and secrets are stored as GitHub repository secrets and injected at deploy time:

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — authenticate with Cloudflare
- `DEEPSEEK_API` — passed through to the Worker as a runtime secret

## Release Management

### Release (`release.yml`)

Runs on every push to `main` and uses [`semantic-release`](https://semantic-release.gitbook.io/) to automate versioning and releases. It reads our [conventional commit](https://www.conventionalcommits.org/) messages to decide the next version number, creates a Git tag, and publishes a GitHub release with notes generated from the commits.

## Secrets

The following secrets are configured in the repository settings and consumed by the deployment workflows:

| Secret | Used by | Purpose |
|--------|---------|---------|
| `CLOUDFLARE_API_TOKEN` | `deploy-worker.yml` | Authenticate with Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy-worker.yml` | Identify the Cloudflare account |
| `DEEPSEEK_API` | `deploy-worker.yml` | DeepSeek API key for the LLM layer |
