# Backend Setup and Development

Project-specific guide for the Allegro API in `issue-tracker-api/`. For product context, see [architecture overview](../architecture/overview.md).

---

## 1. Backend overview

The backend API is implemented using a Cloudflare Worker located in `issue-tracker-api/`.

Instead of running a traditional Node.js/Express server, the application uses Cloudflare’s serverless Worker runtime to handle HTTP requests, route endpoints, authenticate users, and communicate with the D1 database.

The Worker acts as the central API layer between:

- the frontend UI,
- external agent/CLI interactions,
- and the database.

Key responsibilities include:

- handling route logic (`/auth`, `/teams`, `/issues`, `/invites`, etc.)
- validating and authenticating requests
- querying and updating the D1 database
- enforcing team/member permissions
- returning structured JSON responses for both human UI and AI-agent workflows

Entry point: `issue-tracker-api/src/index.js`.

---

## 2. Core backend architecture

**Request flow**

1. `src/index.js` `fetch()` receives the request.
2. `OPTIONS` → CORS preflight (`ALLOWED_ORIGINS` in `index.js`).
3. Path prefix → route module (`routes/*.js`).
4. Handler uses `requireAuth` where needed (`src/lib/auth.js`), runs D1 via `env.DB.prepare()`, returns `Response.json(...)`.
5. Response wrapped with `withCors()`.

**Key files**


| Path                                                              | Role                                      |
| ----------------------------------------------------------------- | ----------------------------------------- |
| `src/index.js`                                                    | Router, CORS, mounts handlers             |
| `routes/auth.js`                                                  | Register, login, logout                   |
| `routes/teams.js`                                                 | Teams, members, leave                     |
| `routes/invites.js`                                               | Invites CRUD, accept/reject               |
| `routes/issues.js`                                                | Issue CRUD, filters, LLM on create        |
| `routes/agent.js`                                                 | `/agents` CRUD (see schema note below)    |
| `src/lib/auth.js`                                                 | `requireAuth`, password hashing, sessions |
| `src/lib/teams.js`                                                | Shared team helpers                       |
| `src/llm.js`                                                      | DeepSeek structuring (`DEEPSEEK_API`)     |
| `schema.sql`                                                      | Table definitions                         |
| `wrangler.jsonc`                                                  | Worker name, D1 binding, compat flags     |
| `ROUTES.md`                                                       | Routing overview; how to add a new route  |
| `DB.md (possibly update this once we reorganize file location)`   | D1 query patterns                         |
| `AUTH.md (possibly update this once we reorganize file location)` | Session/auth usage                        |


---

## 3. Cloudflare Workers

- Runtime for `issue-tracker-api`; `main` is `src/index.js` (`wrangler.jsonc`).
- Each request runs the default export’s `fetch(request, env, ctx)`; `env` includes `DB` and secrets.
- `nodejs_compat` is enabled for dependencies that expect Node APIs.
- **Deploy** publishes the Worker globally (`npm run deploy` / CI). Code changes do not affect production until deploy runs.
- `ExecutionContext` (`ctx`) is passed but not heavily used in route code today.

---

## 4. Wrangler usage

**Wrangler** is the CLI for local dev, D1, and deploy.


| Config (`wrangler.jsonc`) | Value               |
| ------------------------- | ------------------- |
| Worker name               | `issue-tracker-api` |
| D1 binding                | `DB`                |
| D1 database name          | `issue-tracker-db`  |


**Scripts** (`issue-tracker-api/package.json`):

```bash
npm run dev      # wrangler dev → http://localhost:8787
npm run deploy   # wrangler deploy
npm test         # vitest
```

**Common Wrangler commands** (run from `issue-tracker-api/`):

```bash
# Local D1 — apply full schema
wrangler d1 execute issue-tracker-db --local --file=./schema.sql

# Local D1 — one-off SQL
wrangler d1 execute issue-tracker-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# Remote D1 (production data — coordinate with team)
wrangler d1 execute issue-tracker-db --remote --file=./schema.sql
```

**Migrations:** Schema changes are applied via `schema.sql` and `wrangler d1 execute`. `CREATE TABLE IF NOT EXISTS` does not alter existing columns; destructive changes need a planned remote migration.

---

## 5. Local development setup

```bash
cd issue-tracker-api
npm install
wrangler d1 execute issue-tracker-db --local --file=./schema.sql
npm run dev
```

- API: **[http://localhost:8787](http://localhost:8787)**
- Local D1 state is per-machine and not shared across the GitHub repo.
- **Secrets (local):** for LLM issue create, add `DEEPSEEK_API=...` to `issue-tracker-api/.dev.vars` (gitignored). You do not need Cloudflare deploy tokens for local dev.

**Frontend ↔ local backend**

- CORS allows `http://localhost:3000` and `https://cse110-sp26-group1.github.io` (`src/index.js`).
- `frontend/js/api.js` currently points at production (`API_BASE` workers.dev URL). For local API testing, point `API_BASE` at `http://localhost:8787` or use **curl** (below).
- Frontend static server is often `python3 -m http.server 4173` — if the browser origin is not in `ALLOWED_ORIGINS`, add it to `index.js` or use port 3000.

**Agent CLI:** `cli/index.js` document this once we get cli tool done

---

## 6. D1 database setup


| When                          | Command                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| First local setup / new clone | `wrangler d1 execute issue-tracker-db --local --file=./schema.sql`                            |
| After schema changes          | Re-run the same command locally (reset/recreate local DB first if schema conflicts occur)     |
| Production / shared remote DB | `wrangler d1 execute issue-tracker-db --remote --file=./schema.sql` (team agreement required) |


**Local vs remote**

- `--local` → your machine under `.wrangler/`
- `--remote` → Cloudflare-hosted D1 bound in `wrangler.jsonc`

**Important:** Merging to `main` deploys the **Worker only** (`.github/workflows/deploy-worker.yml`). **D1 is not updated by CI**, must apply schema to remote manually when needed.

Tables and relationships: [schema.sql](../../issue-tracker-api/schema.sql), [database.md](../architecture/database.md).

---

## 7. Testing workflow

**Vitest + Workers pool** (`vitest.config.js`, `@cloudflare/vitest-pool-workers`):

```bash
cd issue-tracker-api
npm test
```



**Manual / curl**

See `research/backend-demos/cloudflare-testing-guide.md` for curl examples. Typical flow:

```bash
# Register / login, save token
curl -X POST http://localhost:8787/auth/login -H "Content-Type: application/json" -d '{"email":"...","password":"..."}'

# Protected route
curl http://localhost:8787/teams -H "Authorization: Bearer <token>"
```

---

## 8. Deployment workflow

**Automatic (GitHub Actions)**

- Workflow: `.github/workflows/deploy-worker.yml`
- Triggers: push to `main` when `issue-tracker-api/` or the workflow file changes
- Runs `npm ci` + `wrangler deploy` using GitHub Actions secrets (maintainer setup): `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for deploy; `DEEPSEEK_API` for the Worker at runtime (issue LLM). Don't commit these secret values (which we keep in GitHub Secrets)

**Manual**

```bash
cd issue-tracker-api
npm run deploy
```

**Clarifications**

- Pushing code to a feature branch does **not** deploy production.
- Deploy updates **Worker code + secrets**, not remote D1 schema.
- Local Worker (`npm run dev`) and production Worker are separate; local D1 ≠ remote D1.

The purpose is so that `main` is kept clean and our github page hosting the frontend UI only keeps the latest correct update to the Worker.

---

## 9. Common developer workflows

**Add a route**

1. Add handler in `routes/<resource>.js` (use `requireAuth` where needed).
2. Import and register prefix in `src/index.js` (see `ROUTES.md`).
3. Document in `issue-tracker-api/ROUTES.md` / `docs/api/`.
4. Add Vitest unit test cases in `test/`.
5. Test with curl against `localhost:8787`.

**Change schema**

1. Edit `schema.sql`.
2. Apply locally: `wrangler d1 execute issue-tracker-db --local --file=./schema.sql`.
3. Update route handlers and tests.
4. Coordinate remote apply with team; best to push to remote when endpoints have been locally tested and schema is stable (bad idea if product is already being used by many users)

**Test auth locally**

1. Apply schema.
2. `POST /auth/register` then `POST /auth/login`.
3. Use returned `token` as `Authorization: Bearer ...` on protected routes.

**Redeploy backend**

- Merge to `main` (if paths match workflow), or run `npm run deploy` with Cloudflare credentials.

**Frontend against prod**

- `frontend/js/api.js` uses deployed Worker URL; no Wrangler needed for UI-only work when API is already live.

---

## 10. Troubleshooting


| Symptom                                      | Fix                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `no such table` / D1 errors                  | Run `wrangler d1 execute issue-tracker-db --local --file=./schema.sql`                                        |
| Local data feels “stuck” after schema change | Delete `.wrangler/` and re-apply `schema.sql` (Note: know that this will remove all your locally stored data) |
| `401` on protected routes                    | Login again; send `Authorization: Bearer <token>`; check `sessions` row exists                                |
| CORS blocked from browser                    | Origin must be in `ALLOWED_ORIGINS` in `src/index.js`                                                         |
| LLM / issue create fails locally             | Set `DEEPSEEK_API` in `.dev.vars` or Wrangler secret                                                          |
| Deploy didn’t update API                     | Confirm push was to `main` and touched `issue-tracker-api/`**; check Actions log                              |
| Prod API broken after code deploy            | Remote D1 may be missing tables/columns—apply `schema.sql` with `--remote`                                    |


---

## Related docs (update later on after repo reorganization)

- [Product overview](../architecture/overview.md)
- [Database architecture](../architecture/database.md)
- [Cloudflare testing guide](../../research/backend-demos/cloudflare-testing-guide.md)
- [AUTH.md](../../issue-tracker-api/AUTH.md)
- [DB.md](../../issue-tracker-api/DB.md)
- [ROUTES.md](../../issue-tracker-api/ROUTES.md)
- [Auth doc](./auth.md)

