# Allegro CLI User Guide

`allegro` is a command-line tool for working with teams and issues in the
Allegro issue tracker. This guide is for a human preparing an agent to use the
tool as part of an issue-driven workflow.

## Purpose

Use `allegro` when you want to equip an agent with a command-line interface for
reading team and issue data and updating issue state. This guide focuses on how to prepare and support an agent that will use it.

## Required Inputs

Before asking the agent to act, provide:

- the repo or workspace where the fix should be made
- the user's task request, such as `fix issue: Button not working in Test Group`
- `SKILLS.md`, which tells the agent which workflow and instructions to follow

`SKILLS.md` is required. It tells the agent how to interpret the task, which
capabilities or workflows are available, and how to use the CLI safely and
consistently before making changes.

## Agent Workflow

At a high level, the prepared agent should:

1. Read the user's task together with `SKILLS.md`.
2. Use the available `allegro` commands to inspect the relevant team or issue state.
3. Follow the task-specific workflow defined in `SKILLS.md`.
4. Use the CLI to update issue state when the workflow requires it.
5. Report the result back to the user.

The detailed task logic belongs in `SKILLS.md`.

## Getting Started

### Mac Users

- Run `nvm install 18`.
- Run `nvm use 18`.
- Go to the `cli` directory.
- Run `npm link`.
- Run `allegro help` to confirm the command line tool is installed.
- Log in using the same email address you use for the Allegro website.
- Enter your password when prompted in the terminal.

### Windows Users

- Open a terminal as an administrator.
- [Download NVM for Windows here, then click "Download from GitHub"](https://www.nvmnode.com/guide/download.html#google_vignette).
- Verify your NVM installation by running `nvm version`.
- Run `nvm install 18`.
- Run `nvm use 18`.
- Close the administrator terminal and switch back to a regular terminal session.
- Run `nvm version` again to confirm NVM is available in the regular terminal session.
- Go to the `cli` directory.
- Run `npm link`.
- Run `allegro help` to confirm the command line tool is installed.
- Log in using the same email address you use for the Allegro website.
- Enter your password when prompted in the terminal.

## Authentication Requirement

The agent relies on an existing local `allegro` session. If no session is
available, the user must run `allegro login --email=<your-email>` in their own
terminal. This is a one-time setup step that creates the local session the
agent relies on.

The agent should not ask for or handle the user's password directly. If the
user is not logged in, the correct recovery step is for them to run the login
command and then retry the request.

## Commands

These commands are available to the agent once it has been prepared with the
right context and `SKILLS.md` instructions:

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

## Notes

- If a status contains spaces, wrap it in quotes, for example: `--status="In Progress"`.
- `list_issues` returns a compact issue summary by default and hides issues with status `Resolved` or `Closed`. Pass `--status=Resolved` or `--status=Closed` to see them.
- Detailed task-specific workflow instructions should live in `SKILLS.md`.
