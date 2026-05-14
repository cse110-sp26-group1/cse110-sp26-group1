# Cloudflare D1 + Wrangler Local Testing Guide

This guide helps the team run and test the backend locally using Cloudflare Workers + D1 before integrating with frontend or CI/CD.

---

## 1. Install dependencies

From the backend folder:

```bash
cd issue-tracker-api
npm install
```

This installs:
- `wrangler` (Cloudflare Workers CLI)
- `vitest` (testing)
- all project dependencies

---

## 2. Run Worker locally

Start the local development server:

```bash
npm run dev
```

OR:

```bash
wrangler dev --local
```

This starts the API at: `http://localhost:8787`

It also connects to a local D1 database (not cloud). For the purposes of having a clean testing environment during this prototyping phase, we won't push to the remote db yet.

---

## 3. Initialize local database

Run schema setup:

```bash
wrangler d1 execute issue-tracker-db --local --file=./schema.sql
```

This creates all tables in your local database (only you can access this, no one else on the repo can).

---

## 4. Verify tables exist

```bash
wrangler d1 execute issue-tracker-db --local --command="SELECT name FROM sqlite_master WHERE type='table';"
```

---

## 5. Insert test data manually

You can insert test rows like MySQL CLI:

```bash
wrangler d1 execute issue-tracker-db --local --command="INSERT INTO users (username, email, password_hash) VALUES ('testuser', 'test@test.com', 'hash');"

wrangler d1 execute issue-tracker-db --local --command="INSERT INTO teams (team_name) VALUES ('Backend Team');"

wrangler d1 execute issue-tracker-db --local --command="INSERT INTO issues (team_id, created_by, title, status) VALUES (1, 1, 'First bug', 'open');"
```
For learning purposes, try figuring out how to do other important commands like SELECT which is basically GET, and DELETE. This will just help you learn to work with the table and test for correctness while other endpoints aren't functioning correctly or aren't available yet.

---

## 6. Test API endpoints with curl

The only working endpoint we have right now as of 5/11/26 is the issues endpoint. Everyone take a look at it to see what might need to change in yours. Notice the following curl examples kinda requires you to understand how our schema works and why we use this specific URL with the query params, as well as you already having an issue stored in your local db in the first place.

**GET issues**
```bash
curl "http://localhost:8787/issues?team_id=1"
```

**POST issue**
```bash
curl -X POST "http://localhost:8787/issues" \
  -H "Content-Type: application/json" \
  -d '{
    "team_id": 1,
    "created_by": 1,
    "title": "Test issue"
  }'
```

**DELETE issue (example)**
```bash
curl -X DELETE "http://localhost:8787/issues/1"
```

---

## 7. Important rules

- Local DB ≠ shared DB (each dev has their own copy)
- Always use `--local` while developing
- Schema changes must be re-applied after edits
- Foreign keys require inserting users/teams first

---

## 8. Mental model

```
Frontend → HTTP request → Worker → D1 (local) → response
```

---

## 9. Common issues

**"wrangler not found"**

Run:
```bash
npm install
```

**"no tables exist"**

Run schema setup again:
```bash
wrangler d1 execute issue-tracker-db --local --file=./schema.sql
```

**wrong database behavior**

Make sure you're using:
```bash
--local
```

---

Once this works locally, the same commands will work in production by switching `--local` → `--remote`. We will coordinate on this in the future.