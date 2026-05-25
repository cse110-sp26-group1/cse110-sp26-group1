# Allegro Command-line Tool

`allegro` is a command-line tool for working with teams and issues in the Allegro issue tracker.

## Prerequisites

- Node.js 18 or newer
- Access to an Allegro account
- Access to a team in the issue tracker

# Getting Started

- Go to the `cli` directory.
- Run `npm install -g .` to install the `allegro` command line tool.
- Run `allegro help` to confirm the CLI is installed.
- Log in with the email you use for the Allegro website.
- You will be prompted for your password in the terminal.

## Commands

```bash
allegro login --email=xxx
allegro logout
allegro list_teams
allegro list_issues --team_id=<team_id> [--status=xxx] [--priority=xxx] [--assigned_to=xxx] [--category=xxx] [--difficulty=xxx] [--sort_by=xxx] [--order=asc|desc]
allegro get_issue <id>
allegro update_issue <id> [--status=xxx] [--priority=xxx] [--assigned_to=xxx]
allegro resolve_issue <id>
allegro help
```

## Argument Types

- `email`: string. Example: `user@example.com`
- `team_id`: integer. Example: `1`
- `id` for `get_issue`, `update_issue`, and `resolve_issue`: integer issue ID. Example: `42`
- `status`: string. Valid values: `"Open"`, `"In Progress"`, `"Resolved"`, `"Closed"`
- `priority`: string. Valid values: `"Low"`, `"Medium"`, `"High"`, `"Critical"`
- `assigned_to`: integer user ID. Example: `7`
- `category`: string. Example values may include `"Bug"`, `"Feature"`, or `"Task"`
- `difficulty`: string. Use the difficulty values supported by the backend for your project
- `sort_by`: string. Example values: `id`, `title`, `status`, `priority`, `category`, `difficulty`, `created_at`, `updated_at`, `assigned_to`
- `order`: string. Valid values: `asc` or `desc`

## Typical Flow

1. Use `allegro list_teams` to find your teams. The `id` field in the output is the `team_id`.
2. Run `allegro list_issues --team_id=<team_id>` to get a brief summary of issues for that team.
3. Use `allegro get_issue <id>` with the issue `id` from `list_issues` to get the full issue details.
4. Use `allegro update_issue <id> [--status=xxx] [--priority=xxx] [--assigned_to=xxx]` to update issue fields such as status, priority, or assignee.
5. Use `allegro resolve_issue <id>` to resolve an issue.
6. Use `allegro help` to see the supported commands and usage patterns.
7. Use `allegro logout` to sign out.

## Notes

- If a status contains spaces, wrap it in quotes, for example: `--status="In Progress"`.
- `list_issues` returns a compact issue summary by default.
