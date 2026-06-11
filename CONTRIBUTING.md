# Contributing to Allegro

See more details live in the **[project wiki](https://github.com/cse110-sp26-group1/cse110-sp26-group1/wiki)**.

---

## Local development

1. Clone the repo and install dependencies (see wiki **Getting Started**).
2. Run the backend locally: wiki **Backend Setup**.
3. Run lint/tests before opening a PR: wiki **CI/CD**.


| Task                 | Where                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| First-time setup     | [Wiki — Getting Started](https://github.com/cse110-sp26-group1/cse110-sp26-group1/wiki/Getting-Started) |
| Worker + D1 + API    | [Wiki — Backend Setup](https://github.com/cse110-sp26-group1/cse110-sp26-group1/wiki/Backend-Setup)     |
| Lint, tests, deploy  | [Wiki — CI/CD](https://github.com/cse110-sp26-group1/cse110-sp26-group1/wiki/CI-CD)                     |
| End-user / CLI usage | [User Guide](https://github.com/cse110-sp26-group1/Allegro-CLT/blob/main/README.md)                     |


**Quick checks (repo root):**

```bash
npm run lint
npm run format:check
```

**API tests** (when changing `issue-tracker-api/`):

```bash
cd issue-tracker-api
npm test -- --run
```

---

## Branches

- Branch from `**main**`.
- **Preferred naming** (use going forward):
  - `frontend/<short-description>` — UI, CSS, client JS
  - `backend/<short-description>` — Worker, routes, D1, tests
  - Other areas as needed: `cli/...`, `docs/...`, `e2e/...`

**Note:** Earlier in the project we did not always follow this strictly. **Future maintainers should** use the prefix pattern so reviews and history stay easy to scan.

Examples: `frontend/team-bio-display`, `backend/invite-fix`.

---

## Commits

We use **[Conventional Commits](https://www.conventionalcommits.org/)** for commit messages (and meaningful PR titles).

Common types:


| Type       | Use for                         |
| ---------- | ------------------------------- |
| `feat`     | New feature                     |
| `fix`      | Bug fix                         |
| `docs`     | Documentation only              |
| `test`     | Tests                           |
| `chore`    | Tooling, deps, misc             |
| `refactor` | Code change, no behavior change |


Examples:

```text
feat(teams): save bio on team create
fix(issues): allow multi-tag edit
docs(wiki): update routing page
test: add register validation cases
```

Releases on `main` use **semantic-release** and read conventional commit / PR title format — see wiki **Semantic Versioning** (or repo `docs/process/semantic-versioning.md`). Note that it can lead to incorrect releases on incomplete/messy commits so we did a lot of manual editing to the releases.

---

## Pull requests

1. Open a PR into `**main**` from your feature branch.
2. Use a **conventional commit-style title** (it may become the squash merge message).
3. Ensure **CI passes** (lint; API tests if backend files changed).
4. Get **review from a teammate** before merge.
5. Keep PRs focused; course guideline: large changes (>300 LoC) should go through PR review.

Announce PRs in team chat when ready for review.

---

## Documentation

- **User-facing:** update [USER_GUIDE](https://github.com/cse110-sp26-group1/Allegro-CLT/blob/main/README.md) when workflows change.
- **Technical:** update the **[wiki](https://github.com/cse110-sp26-group1/cse110-sp26-group1/wiki)** for backend, API, and process changes.
- **Decisions:** significant architecture choices → `docs/adr/adr.md`.

---

## Questions

- Product usage → [User Guide](https://github.com/cse110-sp26-group1/Allegro-CLT/blob/main/README.md)
- Maintainer / dev setup → [Wiki Home](https://github.com/cse110-sp26-group1/cse110-sp26-group1/wiki)

