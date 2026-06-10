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

Temporarily change `API_BASE` in `frontend/js/constants.js`:

```javascript
export const API_BASE = 'http://localhost:8787';
```

Or, without editing the file, set an override in the browser console before loading the app:

```javascript
localStorage.setItem('allegro_api_base', 'http://localhost:8787');
```

Revert the constant change or clear `allegro_api_base` when done testing locally.

## Terminal 2: frontend

Use port **3000**, because the backend CORS config allows that origin.

From your repo root:

```bash
python3 -m http.server 3000 --directory frontend
```

Then open:

**http://localhost:3000/html/login.html**
