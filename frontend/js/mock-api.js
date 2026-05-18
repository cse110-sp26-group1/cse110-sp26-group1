// ============================================================
// TO DELETE IN PRODUCTION:
// Once your real API is ready, delete `dbIssues`, `dbTeams`, 
// `initDB()`, and the `delay()` helper entirely.
// ============================================================

const API_BASE = "https://your-api.your-subdomain.workers.dev";

let dbIssues = null;
let dbTeams = null;

const delay = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Lazy-loads the mock database from our JSON file
 */
async function initDB() {
    if (!dbIssues || !dbTeams) {
        const response = await fetch("../js/db.json");
        if (!response.ok) throw new Error("Failed to load mock database");
        
        const data = await response.json();
        dbIssues = data.issues;
        dbTeams = data.teams;
    }
}

/**
 * Replaces: POST /api/auth/login
 */
export async function login(email, password) {
    // === REAL API CALL (Replace mock logic below with this) ===
    /*
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error("Invalid credentials");
    return await res.json(); 
    */

    if (email && password) {
        return { token: "mock_jwt_token_12345", user: { name: "Ada Lovelace", email } };
    }
    throw new Error("Invalid credentials");
}

/**
 * Replaces: GET /api/teams
 */
export async function fetchTeams() {
    // === REAL API CALL (Replace mock logic below with this) ===
    /*
    const res = await fetch(`${API_BASE}/api/teams`);
    if (!res.ok) throw new Error("Failed to fetch teams");
    return await res.json(); 
    */

    await initDB(); 
    await delay(400);
    return Object.entries(dbTeams).map(([slug, data]) => ({
        slug,
        ...data
    }));
}

/**
 * Replaces: GET /api/issues?team_id={teamId}
 */
export async function fetchIssues(teamId) {
    // === REAL API CALL (Replace mock logic below with this) ===
    /*
    const url = teamId 
        ? `${API_BASE}/api/issues?team_id=${encodeURIComponent(teamId)}` 
        : `${API_BASE}/api/issues`;
        
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch issues");
    return await res.json(); 
    */

    await initDB(); 
    return [...dbIssues]; 
}

/**
 * Replaces: POST /api/issues
 */
export async function createIssue(formData) {
    // === REAL API CALL (Replace mock logic below with this) ===
    /*
    const res = await fetch(`${API_BASE}/api/issues`, {
        method: 'POST',
        body: formData // Browser handles multipart/form-data automatically
    });
    if (!res.ok) throw new Error("Failed to create issue");
    return await res.json(); 
    */

    await initDB(); 
    await delay(1000); 

    const title = formData.get('title');
    const description = formData.get('description');
    const files = formData.getAll('attachments');

    const newId = Math.max(0, ...dbIssues.map(x => x.id)) + 1;

    const newIssue = {
        id: newId,
        title: title,
        summary: '',
        description: `<p>${description.replace(/\n/g, '</p><p>')}</p>`,
        status: 'open',
        priority: 'med',
        difficulty: 1,
        labels: [],
        attachments: files.map(f => ({ 
            name: f.name, 
            size: (f.size / 1024).toFixed(1) + ' KB', 
            ic: (f.name.split('.').pop() || '').toUpperCase().slice(0, 3) 
        })),
        activity: [{ who: 'AL', what: 'created issue', when: 'just now' }],
        updated: 'just now',
    };

    dbIssues.unshift(newIssue);
    return newIssue;
}

/**
 * Replaces: PATCH /api/issues/:id
 */
export async function updateIssue(id, updates) {
    // === REAL API CALL (Replace mock logic below with this) ===
    /*
    const res = await fetch(`${API_BASE}/api/issues/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error("Failed to update issue");
    return await res.json(); 
    */

    await initDB();

    const issueIndex = dbIssues.findIndex(i => i.id === id);
    if (issueIndex === -1) throw new Error("Issue not found");

    dbIssues[issueIndex] = { ...dbIssues[issueIndex], ...updates };
    
    dbIssues[issueIndex].activity.unshift({
        who: 'AL',
        what: `updated status to ${updates.status || 'something'}`,
        when: 'just now'
    });

    return dbIssues[issueIndex];
}

/*  
 *  - Invitations
 *  - create new team 
 *  - sign out/ sign in
 *  - assigne new issue
 * - delete issue
 * - update issues
 */  