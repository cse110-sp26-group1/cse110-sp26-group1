import { makeUniqueIssueTitle } from './api.js';

/**
 * Issue payloads spanning statuses, priorities, tags, and categories.
 * @returns {object[]}
 */
export function issueSeeds() {
	return [
		{
			title: makeUniqueIssueTitle('Login button not clickable'),
			description: 'The big blue login button is unresponsive in Firefox.',
			priority: 'Critical',
			category: 'Bug',
			tags: ['ui', 'authentication'],
		},
		{
			title: makeUniqueIssueTitle('Dashboard charts slow to load'),
			description: 'Charts take 6+ seconds to render with 1000 issues.',
			status: 'In Progress',
			priority: 'High',
			category: 'Bug',
			tags: ['performance'],
		},
		{
			title: makeUniqueIssueTitle('Add CSV export to issues'),
			description: 'Users want to export the filtered issue list as CSV.',
			priority: 'Medium',
			category: 'Feature',
			tags: ['enhancement'],
		},
		{
			title: makeUniqueIssueTitle('Audit deprecated API usage'),
			description: 'Replace remaining calls to deprecated /v1 endpoints.',
			status: 'Resolved',
			priority: 'Low',
			category: 'Task',
			tags: ['backend'],
		},
	];
}

/**
 * First three issues from {@link issueSeeds} — enough for mobile drawer/search/detail tests.
 * @returns {object[]}
 */
export function mobileIssueSeeds() {
	return issueSeeds().slice(0, 3);
}
