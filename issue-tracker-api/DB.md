# Database Reference Sheet

## How it works

The D1 database is accessed through `env.DB` in every route handler. You never write connection strings or credentials — Cloudflare handles that through the binding in `wrangler.jsonc`.

`env.DB` is passed in from `src/index.js` to every route handler automatically.

---

## The four operations

**SELECT one row:**

```js
const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first();

// Returns a plain object — access columns directly by name
user.id
user.username
user.email
user.created_at

// Returns null if not found
if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
```

**SELECT multiple rows:**

```js
const { results } = await env.DB.prepare('SELECT * FROM issues WHERE team_id = ?')
    .bind(teamId)
    .all();

// results is always an array of plain objects, empty array if nothing found
results[0].id
results[0].title
results[0].status

// loop through them
results.map(issue => issue.title)
```

**INSERT / UPDATE / DELETE:**

```js
const { meta } = await env.DB.prepare(
    'INSERT INTO issues (team_id, created_by, title) VALUES (?, ?, ?)'
).bind(teamId, userId, title).run();

// meta.changes — how many rows were affected
// meta.last_row_id — ID of the newly inserted row
```

**Check if a row exists:**

```js
const member = await env.DB.prepare(
    'SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ?'
).bind(userId, teamId).first();

if (!member) return Response.json({ error: 'Forbidden' }, { status: 403 });
```

---

## Return shapes

| Method | Returns | Notes |
|---|---|---|
| `.first()` | `{ col_name: value, ... } \| null` | e.g. `{ user_id: number, expires_at: string }` — access as `row.user_id`, `row.expires_at`; `null` if no row matched |
| `.all()` | `{ results: { col_name: value, ... }[] }` | e.g. `results[0].title` — always an array, empty if nothing matched |
| `.run()` | `{ meta: { changes: number, last_row_id: number } }` | `changes` = rows affected; `last_row_id` = ID of the inserted row |

---

## Column names match schema.sql exactly

Whatever the column is named in `schema.sql` is how you access it in code:


| Schema column   | In code              |
| --------------- | -------------------- |
| `created_by`    | `issue.created_by`   |
| `team_name`     | `team.team_name`     |
| `expires_at`    | `session.expires_at` |
| `password_hash` | `user.password_hash` |


---

## Rules


| Do                                                           | Don't                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| Always use `?` placeholders and `.bind()`                    | Put variables directly in the SQL string (SQL injection risk) |
| Use `.first()` when expecting one row                        | Use `.all()` when you only need one row                       |
| Check `meta.changes === 0` to confirm a DELETE/UPDATE worked | Assume the operation succeeded                                |
| Use `auth.userId` from `requireAuth` for user identity       | Trust user IDs sent in the request body                       |


---

## Full route example

```js
import { requireAuth } from '../src/lib/auth.js';

export async function handleIssues(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const issueId = url.pathname.split('/')[2]; // /issues/:id

    // GET /issues?team_id=1
    if (method === 'GET') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const teamId = url.searchParams.get('team_id');
        if (!teamId) return Response.json({ error: 'team_id required' }, { status: 400 });

        const { results } = await env.DB.prepare('SELECT * FROM issues WHERE team_id = ?')
            .bind(teamId)
            .all();

        return Response.json(results); // results is an array of issue objects
    }

    // POST /issues
    if (method === 'POST') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const body = await request.json();
        if (!body.title || !body.team_id) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { meta } = await env.DB.prepare(
            'INSERT INTO issues (team_id, created_by, title) VALUES (?, ?, ?)'
        ).bind(body.team_id, auth.userId, body.title).run();

        return Response.json({ success: true, id: meta.last_row_id }, { status: 201 });
    }

    // DELETE /issues/:id
    if (method === 'DELETE' && issueId) {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const { meta } = await env.DB.prepare('DELETE FROM issues WHERE id = ?')
            .bind(issueId)
            .run();

        if (meta.changes === 0) return Response.json({ error: 'Issue not found' }, { status: 404 });

        return Response.json({ success: true });
    }
}
```

---

## Schema quick reference


| Table          | Key columns                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `users`        | `id`, `username`, `email`, `password_hash`                                  |
| `teams`        | `id`, `team_name`                                                           |
| `team_members` | `team_id`, `user_id`, `role`                                                |
| `issues`       | `id`, `team_id`, `created_by`, `assigned_to`, `title`, `status`, `priority` |
| `sessions`     | `id`, `user_id`, `token`, `expires_at`                                      |
| `invites`      | `id`, `team_id`, `inviter_user_id`, `invited_user_id`, `status`             |


Full schema is in `schema.sql`.

---

## Files


| File              | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `schema.sql`      | All table definitions                          |
| `src/index.js`    | Router — passes `env.DB` to all route handlers |
| `wrangler.jsonc`  | Defines the D1 binding                         |
| `src/lib/auth.js` | `requireAuth` middleware — see `AUTH.md`       |


