# Semantic Release Workflow

This document outlines our branching, commit, and release process. Following these steps can help keep our history clean and our releases consistent.

---

## 1. Create a Branch

Start by creating a branch off `main` for your work:

```bash
git checkout -b feature/add-authentication
```

Branch naming is flexible — use whatever makes the purpose of the branch clear. Common conventions include `feature/...`, `fix/...`, and `hotfix/...`, but there is no strict enforcement.

---

## 2. Make Commits

All commits, including local ones, must follow **conventional commits** format. This keeps branch history meaningful and makes code review easier for everyone.

```
feat: add JWT token generation
fix: handle null response from auth service
chore: install bcrypt dependency
```

Refer to the tag reference at the end of this document if you are unsure which prefix to use.

---

## 3. Open a Pull Request

When your work is ready for review, open a pull request. The PR title must follow **conventional commits** formatting, as it becomes the final commit message on `main` and determines the version bump.

```
feat: add authentication API
fix: resolve Docker container startup issue
docs: update local setup instructions
refactor: simplify payment service
```

---

## 4. CI Runs

Opening a PR triggers the CI pipeline automatically. It runs the necessary checks and creates the appropriate version based on the PR title.

---

## 5. Review and Approval

Before merging, make sure the PR title is in the correct **conventional commits** format — this is what drives the version update.

---

## 6. Merge into `main`

Once approved, merge the PR into `main`.

```
feat: add authentication API
```

---

## 7. Automated Release via `semantic-release`

After a merge to `main`, GitHub Actions runs `semantic-release`, which handles versioning and changelog generation automatically:

```yaml
- run: npx semantic-release
```

It will:

1. Identify the latest release tag
2. Read all commits since that tag
3. Determine the appropriate semVer bump
4. Update the changelog
5. Create a new release and tag

**Example:** If the current version is `v2.1.0` and the following PRs were merged:

```
fix: resolve memory leak
feat: add metrics dashboard
```

The highest bump is `feat` (minor), so the new version will be `v2.2.0`.

---

## 8. Changelog

The changelog is updated automatically as part of the release. No manual edits are needed.

```
# 2.2.0

## Features
- add metrics dashboard

## Bug Fixes
- resolve memory leak
```

---

## Conventional Commits Reference

### Version-Affecting Tags

| Tag                | Meaning          | semVer Bump |
|--------------------|------------------|-------------|
| `feat:`            | New feature      | MINOR       |
| `fix:`             | Bug fix          | PATCH       |
| `feat!:`           | Breaking feature | MAJOR       |
| `BREAKING CHANGE:` | Breaking change  | MAJOR       |

### Non-Version Tags

These do not trigger a release but should still be used for clarity.

| Tag         | Purpose                    |
|-------------|----------------------------|
| `docs:`     | Documentation              |
| `test:`     | Tests                      |
| `refactor:` | Internal restructuring     |
| `style:`    | Formatting only            |
| `chore:`    | Maintenance / dependencies |
| `ci:`       | CI/CD changes              |
| `build:`    | Build tooling              |
| `perf:`     | Performance improvements   |
