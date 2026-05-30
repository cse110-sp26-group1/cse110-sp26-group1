export const PRI_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export const STATUS_ORDER = { 'In Progress': 0, Open: 1, Resolved: 2, Closed: 3 };
export const PRI_LABEL = { Critical: 'URG', High: 'P1', Medium: 'P2', Low: 'P3' };
export const PRI_NAME = { Critical: 'Critical', High: 'High', Medium: 'Medium', Low: 'Low' };
export const STATUS_NAME = {
	Open: 'Open',
	'In Progress': 'In progress',
	Resolved: 'Resolved',
	Closed: 'Closed',
};

export const SKILLS_MD = `# skills.md - Issue Tracker agent guide...`;

// Standard issue-type tags shown in the sidebar, list, and create/edit forms.
export const TAGS = ['bug', 'feature', 'task'];

// Backend stores category as Title Case; UI tags stay lowercase.
export const TAG_MAP = { bug: 'Bug', feature: 'Feature', task: 'Task' };

// Predefined "Views" (Saved filter/sort combinations)
export const DEFAULT_VIEWS = [
	{
		id: 'all',
		name: 'All Issues',
		filters: { status: 'all', priority: 'all', tag: 'all' },
	},
	{
		id: 'urgent',
		name: 'Urgent Action',
		filters: { status: 'Open', priority: 'Critical', tag: 'all' },
	},
	{
		id: 'ui-bugs',
		name: 'UI Bugs',
		filters: { status: 'all', priority: 'all', tag: 'ui' },
	},
];
