# Frontend local testing

Run the stack locally like this.

## Terminal 1: backend

From your repo root:

```bash
cd issue-tracker-api
npm install
npx wrangler d1 execute issue-tracker-db --local --file=./schema.sql
npm run dev
```

That should start the API at:

**http://localhost:8787**

Temporarily change `frontend/js/api.js` (around line 2) to:

```javascript
const API_BASE = 'http://localhost:8787';
```

(Comment out or replace the production `API_BASE` while testing locally.)

## Terminal 2: frontend

Use port **3000**, because the backend CORS config allows that origin.

From your repo root:

```bash
python3 -m http.server 3000 --directory frontend
```

Then open:

**http://localhost:3000/html/login.html**
