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

// Parse flags like --status=investigating
const flags = {};
args.slice(1).forEach((arg) => {
	if (arg.startsWith('--')) {
		const [key, ...rest] = arg.replace('--', '').split('=');
		flags[key] = rest.join('=');
	}
});

// Positional argument (e.g. the issue ID)
const id = args[1];

/**
 *
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
 *
 * @param queryFlags
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
 *
 * @param issues
 * @param statusFilterApplied
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

// Helper: load saved token
/**
 *
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
 *
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

// Helper: make API requests
/**
 *
 * @param method
 * @param endpoint
 * @param body
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
