# Allegro Command-Line Tool

This document explains about the Allegro Command-Line Tool.

**Related files:**

- [CLT-user-guide](https://github.com/cse110-sp26-group1/cse110-sp26-group1/blob/main/cli/CLT-user-guide.md)
- [SKILL.md](https://github.com/cse110-sp26-group1/cse110-sp26-group1/blob/main/cli/SKILL.md)

**Purpose:**

**CLT-user-guide:** To guide the user through the installation process of our tool, explaining how the agent can get enough information/context about the issue so that it can work on resolving it which will later be updated in the UI, and the commands that are available to the agent once the command-line tool is installed.

**SKILL.md:** To guide the agent about how it would go about fixing the issue locally on the user's computer by getting enough context from our command-line tool. It lists the steps that need to be taken by the agent which can help it get enough context about what the issue is and work on fixing the issue in the user's codebase. After fixing the issue, it is also mentioned that the agent has to update fields that were necessary for resolution and the UI is updated accordingly.

---

## Relevant Files

These files were used to build the command-line tool:

- **index.js** — main source code that was used to build the command-line tool
- **package.json** and **package-lock.json** — was created so that the user can directly install our command-line tool using npm

### `package.json`

Defines a node package such that when this is installed, the command `allegro` is created which is now runnable in the terminal and uses the `index.js` file.

### `package-lock.json`

Configures how Node and npm should handle our dependencies and the package.

### `index.js`

Main source code for the command-line tool.

---

## `index.js` — Global Constants

```js
const CONFIG_DIR;      // directory where our Allegro CLT would live on the computer
const CONFIG_FILE;     // stores the config.json file where the user's authentication details would be stored
const BASE_URL;        // points to our backend API on Cloudflare

const args;            // arguments from the terminal
const command;         // stores the first command that was typed in
const validStatuses;   // stores valid issue statuses like Open, In Progress, Resolved, and Closed
const validPriorities; // stores valid priorities like Low, Medium, High, and Critical
const validCategories; // stores valid issue categories like Bug, Feature, and Task

const flags = {};      // stores command-line tool flags in key=value format
const id;              // stores the issue id passed as a positional argument
```

---

## `index.js` — Functions

**`function printUsage()`**
Prints the supported command-line tool commands and their usage.

**`function buildQueryString(queryFlags)`**
Creates a query string from the provided flags to get information from the backend API.

**`function parseArrayFlag(sourceFlags, key)`**
Parses the key-value pair for the given key as a JSON array for the command-line tool.

**`function formatIssueList(issues, statusFilterApplied)`**
Formats multiple issues, especially for the `list_issues` command, to show a brief summary with only the `id`, `title`, `summary`, `category`, `tags`, and `status` fields, and by default hides resolved and closed issues unless a status filter is applied.

**`function formatIssue(issue)`**
Formats a single issue, especially for the `get_issue` command.

**`function getToken()`**
Returns the token from the `config.json` file.

**`function promptForPassword()`**
Prompts the user for their password during login and masks the input in the terminal.

**`async function request(method, endpoint, body = null)`**
Sends authenticated requests to the backend API and parses the response.
