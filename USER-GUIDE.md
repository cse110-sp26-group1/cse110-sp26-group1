# Allegro User Guide

Quick start for the **web app**. For the command-line tool and agent workflows, see the [CLT User Guide](cli/clt-user-guide.md).

**Live app:** [Allegro](https://cse110-sp26-group1.github.io/cse110-sp26-group1/html/login.html)

---

## What Allegro is

Allegro is a team issue tracker. You manage issues in the browser; users can utilize a coding agent to make changes in their own codebase and update issues using the Allegro CLI tool.

---

## Web onboarding

### 1. Create an account

1. Open the [login page](https://cse110-sp26-group1.github.io/cse110-sp26-group1/html/login.html).
2. Go to **Sign up**.
3. Enter username, name, email, and password (8+ characters).
4. You are signed in automatically after registration.

### 2. Join or create a team

On **Your teams**:

- **Create a team** — name required; short bio optional (helps AI context for your team).
  - team creators automatically become admins.
- **Pending invitations** — accept or decline invites from teammates.

Click a team card to open that workspace.

### 3. Work with issues

Inside a team **tracker**:

- **Create issue** — add a title and description; the backend uses the Deepseek API to structure fields (priority, summary, tags, etc.) to reduce friction and organize issue details.
  - Note: lazy descriptions will result in vague LLM output which is to be expected
- **Browse** — filter and sort the issue list; open an issue to see details.
- **Edit / delete** — update status and fields from the issue view.

Changes are shared with everyone on the team.

### 4. Team settings

Open team **settings** from the tracker:

- View members and roles (admin / member).
- **Admins:** invite users by username or email, update team name/bio, remove members, or delete the team.
- **Members:** leave the team (admins can only leave if they're the last member).

---

## Tips

- Use the same email for the website and CLI tool.
- Issues belong to one team — switch teams from the tracker to see a different backlog.

---

## CLI Tool and agents

The Allegro CLI tool is for developers who want an external coding agent (e.g. Claude) to read and update issues while working locally.

**Full install, login, commands, and agent setup:** [CLT User Guide](cli/clt-user-guide.md)

**Agent instructions file:** [cli/SKILL.md](cli/SKILL.md)

Short version:

1. Install and link the CLI from the repo `cli/` folder.
2. Run `allegro login --email=<your-email>` (same account as the website).
3. Point your agent at `SKILL.md` and use `allegro` commands to inspect and update issues.

Updates from the CLI tool appear in the web UI for the whole team.

---

## More documentation


| Resource                                                              | Description                         |
| --------------------------------------------------------------------- | ----------------------------------- |
| [README](README.md)                                                   | Project overview and links          |
| [Contributing](CONTRIBUTING.md)                                       | Developers contributing to the repo |
| [Wiki](https://github.com/cse110-sp26-group1/cse110-sp26-group1/wiki) | Technical docs for maintainers      |


---

