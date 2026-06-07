export const API_BASE = 'https://issue-tracker-api.amorbuks25.workers.dev';

export const PRI_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export const STATUS_NAME = {
	Open: 'Open',
	'In Progress': 'In Progress',
	Resolved: 'Resolved',
	Closed: 'Closed',
};

/** oklch hue values matching tracker team-menu .c1–.c4 */
export const TEAM_MARK_HUES = [38, 200, 130, 320];

export const CLI_SKILL_MD_URL = 'https://raw.githubusercontent.com/cse110-sp26-group1/Allegro-CLT/main/cli/SKILL.md';

// Standard list of tags
export const TAGS = [
	'ui',
	'backend',
	'database',
	'authentication',
	'performance',
	'security',
	'testing',
	'documentation',
	'integration',
	'enhancement',
	'research',
];

// Backend category enum values, used by the new-issue Category dropdown.
export const CATEGORIES = ['Bug', 'Feature', 'Task'];
