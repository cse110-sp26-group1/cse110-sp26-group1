# Testing

How the test suite works and how to write new tests. Source: `issue-tracker-api/test/` — spec files run inside a real Cloudflare Workers runtime against an isolated D1 data
base.

---

## Stack

| Tool | Role |
|---|---|
| `vitest` | Test runner |
| `@cloudflare/vitest-pool-workers` | Runs tests inside the Workers runtime (real `fetch`, real `crypto`, real D1) |
| `wrangler.jsonc` | Provides bindings (`env.DB`) used by both the worker and test helpers |

Config: `issue-tracker-api/vitest.config.js` — points `wrangler.configPath` at `./wrangler.jsonc` so the test worker gets the same D1 binding as dev.

---

## Running tests

```bash
cd issue-tracker-api
npm test
```

`npm test` runs `vitest`, which picks up all `test/*.spec.js` files.

---

## Test files

| File | What it covers |
|---|---|
| `test/health.spec.js` | `GET /health` — confirms schema is loaded and DB is reachable |
| `test/auth.spec.js` | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/validate` |
| `test/issues.spec.js` | Full issues CRUD (`GET /issues`, `GET /issues/:id`, `POST`, `PATCH`, `DELETE`) plus auth and team-membership middleware |
| `test/teams.spec.js` | Team creation, membership, and related endpoints |
| `test/invites.spec.js` | Invite creation, acceptance, rejection, and cancellation |
| `test/agent.spec.js` | Agent-facing issue endpoints |

---

## How it works

### Schema bootstrap

Every spec file runs this pattern once before all tests:

```js
beforeAll(async () => {
  const cleanSql = sqlSchemaRaw
    .split('\n')
    .map((line) => line.split('--')[0].trim()) // strip inline SQL comments
    .filter((line) => line.length > 0)         // drop blank lines
    .join(' ');

  await env.DB.exec(cleanSql);
});
```

`schema.sql?raw` is a Vite raw import — the schema file is loaded as a string at build time, bypassing all path resolution. The comment-stripping step is required because t
he D1 internal engine throws on `--` comments when the SQL is passed as a single string.

### Test isolation

Every spec file runs this before each individual test:

```js
beforeEach(async () => {
  await env.DB.exec(`
    DELETE FROM sessions;
    DELETE FROM invites;
    DELETE FROM issues;
    DELETE FROM team_members;
    DELETE FROM teams;
    DELETE FROM users;
  `);
});
```

Each test starts with an empty database. There is no shared state between tests.

---

## SELF vs worker.fetch

Tests use two styles, sometimes labeled in the test description:

**Integration style — `SELF.fetch`**

```js
import { SELF } from 'cloudflare:test';

const res = await SELF.fetch('http://localhost/issues?team_id=1', {
  headers: { Authorization: `Bearer ${token}` },
});
```

`SELF` dispatches the request through the full worker pipeline exactly as Cloudflare would. Use this when you want end-to-end coverage of routing, CORS, and error handling.

**Unit style — `worker.fetch` + `createExecutionContext`**

```js
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src';

const req = new Request('http://localhost/issues?team_id=1', {
  headers: { Authorization: `Bearer ${token}` },
});
const ctx = createExecutionContext();
const res = await worker.fetch(req, env, ctx);
await waitOnExecutionContext(ctx);
```

`worker.fetch` calls the handler directly and lets you inject a custom `env` (e.g. `{ ...env, DEEPSEEK_API: 'mock-key' }`). Use this when you need to control environment bi
ndings or test specific middleware paths without going through the full runtime.

---

## Seed helpers

Every spec file defines local helpers to set up the database state a test needs. The pattern used in `issues.spec.js`:

```js
async function createTestUser(username, email) {
  const row = await env.DB.prepare(
    'INSERT INTO users (username, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?) RETURNING id',
  ).bind(username, 'Test', 'User', email, 'mock_hash').first();
  return row.id;
}

async function createTestTeam(teamName) {
  const row = await env.DB.prepare('INSERT INTO teams (team_name) VALUES (?) RETURNING id')
    .bind(teamName).first();
  return row.id;
}

async function createTestSession(userId, token, ttlHours = 24) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);
  await env.DB.prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
    .bind(userId, token, expiresAt.toISOString()).run();
}

async function createTeamMembership(userId, teamId, role = 'member') {
  await env.DB.prepare('INSERT INTO team_members (user_id, team_id, role) VALUES (?, ?, ?)')
    .bind(userId, teamId, role).run();
}
```

Pass a negative `ttlHours` to `createTestSession` to seed an already-expired session — used to test session expiry rejection.

---

## Mocking

`issues.spec.js` mocks the AI enrichment layer so tests do not make real external API calls:

```js
import { vi } from 'vitest';

vi.mock('../src/llm.js', () => ({
  processIssue: vi.fn().mockImplementation(async () => ({})),
}));
import { processIssue } from '../src/llm.js';
```

The `beforeEach` block calls `vi.resetAllMocks()` to clear call history and per-test return values between runs.

To simulate a specific AI response in a test:

```js
vi.mocked(processIssue).mockResolvedValueOnce({
  status: 'In Progress',
  priority: 'Critical',
  tags: ['security', 'backend'],
});
```

To simulate an AI failure and verify the fallback:

```js
vi.mocked(processIssue).mockRejectedValueOnce(new Error('API Timeout'));
```

---

## Writing a new test

1. Pick the right spec file for the route you're testing.
2. In the test body, seed only the state you need using the local helpers.
3. Make the request with `SELF.fetch` (integration) or `worker.fetch` (unit, when you need a custom `env`).
4. Assert the response status and body. For DB-side assertions, query `env.DB` directly.

Minimal example for a protected endpoint:

```js
it('200: returns data for an authenticated team member', async () => {
  const userId = await createTestUser('alice', 'alice@example.com');
  const teamId = await createTestTeam('Alpha');
  const token = 'alice-token';

  await createTestSession(userId, token, 24);
  await createTeamMembership(userId, teamId, 'member');

  const res = await SELF.fetch(`http://localhost/your-route?team_id=${teamId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res.status).toBe(200);
  const data = await res.json();
  expect(Array.isArray(data)).toBe(true);
});
```

---

## Related documentation

- [API routing](./routes.md) — handler structure and how routes are registered
- [Database](./db.md) — D1 query patterns used in both handlers and test helpers