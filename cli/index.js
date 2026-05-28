#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.allegro');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const BASE_URL = 'https://issue-tracker-api.amorbuks25.workers.dev';

const args = process.argv.slice(2);
const command = args[0];
const validStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
const validPriorities = ['Low', 'Medium', 'High', 'Critical'];

/**
 * Parsed CLI flags in key=value format.
 * @type {Record<string, string>}
 */
const flags = {};
args.slice(1).forEach((arg) => {
	if (arg.startsWith('--')) {
		const [key, ...rest] = arg.replace('--', '').split('=');
		flags[key] = rest.join('=');
	}
});

const id = args[1];

/**
 * Prints the supported CLI commands and their expected usage.
 *
 * @returns {void}
 */
function printUsage() {
	console.error('Usage:');
	console.error('  allegro login --email=xxx');
	console.error('  allegro logout');
	console.error('  allegro list_teams');
	console.error('  allegro list_issues --team_id=<team_id> [--status=xxx] [--priority=xxx] [--assigned_to=xxx]');
	console.error('  allegro get_issue <id>');
	console.error('  allegro update_issue <id> --status=xxx --priority=xxx [--assigned_to=xxx]');
	console.error('  allegro resolve_issue <id>');
}

/**
 * Builds a URL query string from a set of optional CLI flags.
 *
 * Empty, null, and undefined values are omitted from the final query string.
 *
 * @param {Record<string, string | undefined>} queryFlags - Key-value pairs to serialize.
 * @returns {string} The serialized query string, including the leading `?` when needed.
 */
function buildQueryString(queryFlags) {
	const params = new URLSearchParams();

	Object.entries(queryFlags).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			params.set(key, value);
		}
	});

	const queryString = params.toString();
	return queryString ? `?${queryString}` : '';
}

/**
 * Formats the issue list response for terminal output, so that it
 * shows a brief summary with id, title, summary, category, tags and status fields
 *
 * By default, resolved and closed issues are hidden so the CLI shows active issues.
 *
 * @param {unknown} issues - Raw issue list returned by the API.
 * @param {boolean} statusFilterApplied - Whether the user explicitly requested a status filter.
 * @returns {unknown} A compact list of issues, or the original value if the response is not an array.
 */
function formatIssueList(issues, statusFilterApplied) {
	if (!Array.isArray(issues)) {
		return issues;
	}

	const formattedIssues = issues.map((issue) => ({
		id: issue.id,
		title: issue.title,
		summary: issue.summary,
		category: issue.category,
		tags: issue.tags,
		status: issue.status,
	}));

	if (statusFilterApplied) {
		return formattedIssues;
	}

	return formattedIssues.filter((issue) => issue.status !== 'Resolved' && issue.status !== 'Closed');
}

/**
 * Loads the saved session token from the local CLI config file.
 *
 * Exits the process if the user is not currently logged in.
 *
 * @returns {string} The saved bearer token.
 */
function getToken() {
	if (!fs.existsSync(CONFIG_FILE)) {
		console.error('Not logged in. Run: allegro login --email=xxx');
		process.exit(1);
	}
	const config = JSON.parse(fs.readFileSync(CONFIG_FILE));
	return config.token;
}

/**
 * Prompts the user for a password in the terminal and masks input with `*`.
 *
 *
 * @returns {Promise<string>} The password entered by the user.
 */
function promptForPassword() {
	return new Promise((resolve, reject) => {
		if (!process.stdin.isTTY || !process.stdout.isTTY) {
			reject(new Error('Interactive password prompt requires a terminal.'));
			return;
		}

		const previousRawMode = process.stdin.isRaw;
		let password = '';

		const cleanup = () => {
			process.stdin.setRawMode(Boolean(previousRawMode));
			process.stdin.pause();
			process.stdin.removeListener('data', onData);
		};

		const onData = (chunk) => {
			const key = chunk.toString('utf8');

			if (key === '\r' || key === '\n') {
				process.stdout.write('\n');
				cleanup();
				resolve(password);
				return;
			}

			if (key === '\u0003') {
				process.stdout.write('\n');
				cleanup();
				reject(new Error('Password entry cancelled.'));
				return;
			}

			if (key === '\u007f') {
				if (password.length > 0) {
					password = password.slice(0, -1);
					process.stdout.write('\b \b');
				}
				return;
			}

			if (key >= ' ' && key !== '\u001b') {
				password += key;
				process.stdout.write('*');
			}
		};

		process.stdout.write('Password: ');
		process.stdin.resume();
		process.stdin.setRawMode(true);
		process.stdin.on('data', onData);
	});
}

/**
 * Sends an authenticated request to the Allegro backend API.
 *
 * The saved session token is attached as a bearer token, and JSON responses are parsed
 * automatically when possible.
 *
 * @param {string} method - HTTP method to send.
 * @param {string} endpoint - API path relative to the configured base URL.
 * @param {Record<string, unknown> | null} [body=null] - Optional JSON request body.
 * @returns {Promise<{ ok: boolean, data: unknown }>} Parsed API response and status flag.
 */
async function request(method, endpoint, body = null) {
	const token = getToken();
	const res = await fetch(`${BASE_URL}${endpoint}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: body ? JSON.stringify(body) : null,
	});

	const text = await res.text();
	try {
		return { ok: res.ok, data: JSON.parse(text) };
	} catch {
		return { ok: res.ok, data: text };
	}
}

if (command === 'login') {
	const { email } = flags;

	if (!email) {
		console.error('Usage: allegro login --email=xxx');
		process.exit(1);
	}

	let password;
	try {
		password = await promptForPassword();
	} catch (error) {
		console.error(error.message);
		process.exit(1);
	}

	if (!password) {
		console.error('Password is required.');
		process.exit(1);
	}

	const res = await fetch(`${BASE_URL}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});

	const data = await res.json();

	if (!res.ok) {
		console.error('Login failed:', data.message);
		process.exit(1);
	}

	fs.mkdirSync(CONFIG_DIR, { recursive: true });
	fs.writeFileSync(CONFIG_FILE, JSON.stringify({ token: data.token, expires_at: data.expires_at }));
	console.log('Logged in successfully!');
} else if (command === 'logout') {
	const token = getToken();

	await fetch(`${BASE_URL}/auth/logout`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
	});

	fs.unlinkSync(CONFIG_FILE);
	console.log('Logged out successfully!');
} else if (command === 'list_teams') {
	const { ok, data } = await request('GET', '/teams');
	if (!ok) {
		console.error('Error:', data);
		process.exit(1);
	}
	console.log(JSON.stringify(data, null, 2));
} else if (command === 'list_issues') {
	if (!flags.team_id) {
		console.error('Usage: allegro list_issues --team_id=<team_id> [--status=xxx] [--priority=xxx] [--assigned_to=xxx]');
		process.exit(1);
	}

	if (flags.status && !validStatuses.includes(flags.status)) {
		console.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
		process.exit(1);
	}

	if (flags.priority && !validPriorities.includes(flags.priority)) {
		console.error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
		process.exit(1);
	}

	const queryString = buildQueryString({
		team_id: flags.team_id,
		status: flags.status,
		priority: flags.priority,
		assigned_to: flags.assigned_to,
		category: flags.category,
		difficulty: flags.difficulty,
		sort_by: flags.sort_by,
		order: flags.order,
	});

	const { ok, data } = await request('GET', `/issues${queryString}`);
	if (!ok) {
		console.error('Error:', data);
		process.exit(1);
	}
	console.log(JSON.stringify(formatIssueList(data, Boolean(flags.status)), null, 2));
} else if (command === 'get_issue') {
	if (!id) {
		console.error('Usage: allegro get_issue <id>');
		process.exit(1);
	}

	const { ok, data } = await request('GET', `/issues/${id}`);
	if (!ok) {
		console.error('Error:', data);
		process.exit(1);
	}
	console.log(JSON.stringify(data, null, 2));
} else if (command === 'update_issue') {
	if (!id) {
		console.error('Usage: allegro update_issue <id> --status=<status> --priority=<priority>');
		process.exit(1);
	}

	if (!flags.status && !flags.priority && !flags.assigned_to) {
		console.error('Provide at least one field to update: --status, --priority, or --assigned_to');
		process.exit(1);
	}

	if (flags.status && !validStatuses.includes(flags.status)) {
		console.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
		process.exit(1);
	}

	if (flags.priority && !validPriorities.includes(flags.priority)) {
		console.error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
		process.exit(1);
	}

	const { ok, data } = await request('PATCH', `/issues/${id}`, {
		...(flags.status && { status: flags.status }),
		...(flags.priority && { priority: flags.priority }),
		...(flags.assigned_to && { assigned_to: flags.assigned_to }),
	});
	if (!ok) {
		console.error('Error:', data);
		process.exit(1);
	}
	console.log('Issue updated successfully!');
} else if (command === 'resolve_issue') {
	if (!id) {
		console.error('Usage: allegro resolve_issue <id>');
		process.exit(1);
	}

	const { ok, data } = await request('PATCH', `/issues/${id}`, {
		status: 'Resolved',
	});
	if (!ok) {
		console.error('Error:', data);
		process.exit(1);
	}
	console.log('Issue resolved successfully!');
} else if (!command || command === 'help' || command === '--help') {
	printUsage();
	process.exit(1);
} else {
	console.error(`Unknown command: ${command}`);
	printUsage();
	process.exit(1);
}
