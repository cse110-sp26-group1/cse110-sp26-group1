// ============================================================
// Sample data, ordering keys, and the skills.md payload.
// Backend integration swaps ISSUES + TEAMS for real fetch() calls;
// the rest stay client-only.
// ============================================================

export const PRI_ORDER = { urgent: 0, high: 1, med: 2, low: 3 };
export const STATUS_ORDER = { 'in-progress': 0, open: 1, pending: 2, done: 3, closed: 4 };
export const PRI_LABEL = { urgent: 'URG', high: 'P1', med: 'P2', low: 'P3' };
export const PRI_NAME = { urgent: 'Urgent', high: 'High', med: 'Medium', low: 'Low' };
export const STATUS_NAME = {
	open: 'Open',
	'in-progress': 'In progress',
	done: 'Done',
	closed: 'Closed',
	pending: 'Processing',
};

export const TEAMS = {
	'studio-ai': { name: 'Studio · AI Tools', mark: 'SA', color: 38 },
	'group-eight': { name: 'Group 8 · Capstone', mark: 'G8', color: 200 },
	'side-quest': { name: 'Side Quest', mark: 'SQ', color: 130 },
	'hearth-os': { name: 'Hearth OS', mark: 'HO', color: 320 },
	invited: { name: 'Dawn Kernel', mark: 'DK', color: 200 },
};

export const ISSUES = [
	{
		id: 142,
		title: 'Login redirect loops after session expiry',
		summary:
			'When a session expires mid-session, the redirect to /login bounces back to the original protected page, which redirects again. Missing return-URL guard.',
		description: `<p>Reproduces consistently when sitting on a protected route past the session TTL (currently 30m).</p>
			<p><strong>Steps to reproduce</strong></p>
			<ul>
				<li>Sign in.</li>
				<li>Open <code>/issues/142</code>.</li>
				<li>Wait 31 minutes (or invalidate the cookie in devtools).</li>
				<li>Refresh.</li>
			</ul>
			<p><strong>Expected:</strong> sign-in page with a return URL; after auth, return to <code>/issues/142</code>.</p>
			<p><strong>Actual:</strong> sign-in → protected page → sign-in → … loop.</p>
			<p><strong>Stack (abridged):</strong></p>
			<pre>at requireAuth (middleware/auth.ts:42)
at handleRedirect (router/index.ts:118)
… 12 frames omitted …</pre>`,
		status: 'in-progress',
		priority: 'high',
		difficulty: 2,
		labels: ['bug', 'auth'],
		attachments: [
			{ name: 'trace-2026-05-09.log', size: '8.4 KB', ic: 'LOG' },
			{ name: 'browser-console.txt', size: '1.2 KB', ic: 'TXT' },
		],
		activity: [
			{ who: 'JK', what: 'moved to In progress', when: '2h ago' },
			{ who: 'AL', what: 'added label auth', when: '5h ago' },
			{ who: 'AL', what: 'created issue', when: '5h ago' },
		],
		updated: '2h ago',
	},
	{
		id: 144,
		title: 'OAuth callback hangs on slow networks',
		summary: 'On 3G-throttled connections, the OAuth callback page never finalizes; spinner sits indefinitely with no error surfaced.',
		description: '<p>Spinner appears, no timeout, no fallback.</p>',
		status: 'open',
		priority: 'urgent',
		difficulty: 3,
		labels: ['bug', 'auth'],
		attachments: [],
		activity: [{ who: 'MN', what: 'created issue', when: '30m ago' }],
		updated: '30m ago',
	},
	{
		id: 141,
		title: 'Filter chips cause list reflow',
		summary: 'Selecting a chip in the filter row reflows the list because the row collapses to 0 height when empty. Reserve space.',
		description: "<p>Add min-height to filter bar so chips don't push content.</p>",
		status: 'open',
		priority: 'med',
		difficulty: 2,
		labels: ['ui'],
		attachments: [{ name: 'filter-jank.gif', size: '2.1 MB', ic: 'GIF' }],
		activity: [{ who: 'AL', what: 'created issue', when: '5h ago' }],
		updated: '5h ago',
	},
	{
		id: 139,
		title: 'D1 schema: add team_id to issues',
		summary: 'Team scoping is missing — issues currently visible across accounts. Add team_id column + index, scope all queries.',
		description: '<p>Required to satisfy team isolation. Update migrations and re-seed dev.</p>',
		status: 'open',
		priority: 'med',
		difficulty: 3,
		labels: ['infra'],
		attachments: [],
		activity: [{ who: 'BS', what: 'created issue', when: 'yesterday' }],
		updated: 'yesterday',
	},
	{
		id: 138,
		title: 'Issue body lacks max-width — too wide to read',
		summary: 'Constrain description in detail pane to ~60ch for better readability on wide screens.',
		description: '<p>Use <code>max-width: 60ch</code> on the description container.</p>',
		status: 'in-progress',
		priority: 'low',
		difficulty: 1,
		labels: ['ui'],
		attachments: [],
		activity: [{ who: 'JK', what: 'started work', when: 'yesterday' }],
		updated: 'yesterday',
	},
	{
		id: 137,
		title: 'Skeleton row missing on filter apply',
		summary: 'List collapses while filters are pending. Add a placeholder skeleton row to prevent height collapse.',
		description: '<p>Added shimmer placeholder.</p>',
		status: 'done',
		priority: 'low',
		difficulty: 1,
		labels: ['ui'],
		attachments: [],
		activity: [{ who: 'MN', what: 'marked done', when: '2d ago' }],
		updated: '2d ago',
	},
	{
		id: 136,
		title: "Drag handle on split pane doesn't persist",
		summary: 'Width of detail pane resets on every reload. Persist in localStorage and rehydrate on mount.',
		description: '',
		status: 'open',
		priority: 'low',
		difficulty: 1,
		labels: ['ui'],
		attachments: [],
		activity: [],
		updated: '3d ago',
	},
	{
		id: 135,
		title: 'Invite link expires too fast',
		summary: '2h window blocks the human onboarding flow. Bump to 72h and rotate on use.',
		description: '',
		status: 'open',
		priority: 'low',
		difficulty: 1,
		labels: ['auth'],
		attachments: [],
		activity: [],
		updated: '3d ago',
	},
	{
		id: 134,
		title: 'Slow query: issues by tag',
		summary: 'Tag filter query is unindexed and full-scans. Add composite index (team_id, tag).',
		description: '',
		status: 'open',
		priority: 'med',
		difficulty: 2,
		labels: ['perf', 'infra'],
		attachments: [],
		activity: [],
		updated: '4d ago',
	},
	{
		id: 133,
		title: 'Detail pane scrolls under sticky toolbar on Safari',
		summary: 'Sticky positioning bug — toolbar drifts under content on Safari 17.',
		description: '',
		status: 'open',
		priority: 'low',
		difficulty: 2,
		labels: ['ui', 'bug'],
		attachments: [],
		activity: [],
		updated: '5d ago',
	},
	{
		id: 132,
		title: 'Worker cold-starts > 1s on free tier',
		summary: 'Cold-start time exceeds budget on first request after idle. Investigate keep-warm or eager init.',
		description: '',
		status: 'done',
		priority: 'med',
		difficulty: 2,
		labels: ['perf', 'infra'],
		attachments: [],
		activity: [],
		updated: '1w ago',
	},
];

export const SKILLS_MD = `# skills.md — Issue Tracker agent guide

This file describes how an external agent should interact with this team's
Issue Tracker backend. Drop it into your agent's skills / context folder.

## Endpoints (agent-facing)

GET    /api/issues
GET    /api/issues/:id
POST   /api/issues
PATCH  /api/issues/:id
DELETE /api/issues/:id

Filters: ?status=open&priority=high&tag=ui

## Issue shape

{
  "title": "string",
  "summary": "short, context-window friendly",
  "description": "string (markdown allowed)",
  "status":     "open | in-progress | done | closed | pending",
  "priority":   "urgent | high | med | low",
  "difficulty": 1 | 2 | 3,
  "labels":     ["bug", "ui", ...],
  "attachments":[{ "name": "...", "url": "..." }],
  "team_id":    "string"
}

## Conventions for agents

- Always scope by team_id (passed via header or query).
- Treat 'summary' as canonical short text for prompt context.
- 'description' may be long; include attachments verbatim when needed.
- When updating: append to activity log, do not overwrite history.
- Respect issue 'status'; do not move from done → in-progress without comment.

## Suggested agent loop

1. GET /api/issues?status=open  (oldest unassigned first)
2. Pick highest-priority, lowest-difficulty issue.
3. GET /api/issues/:id  → full context + attachments.
4. Attempt fix locally.
5. PATCH /api/issues/:id  → status='in-progress', append log entry.
6. On termination, PATCH with final status + termination report.
`;
