/**
 * Sends raw user input to DeepSeek and returns the structured issue JSON.
 *
 * The LLM returns plain-text key-value pairs which are then parsed
 * into a structured JSON object before being returned.
 */

const BASE_URL = 'https://api.deepseek.com';

const PROMPT = `You are an issue triage agent for a software team.

Given a user's raw issue description, produce structured key-value pairs for an issue tracker.

INSTRUCTIONS:
- Return ONLY plain text key-value pairs.
- DO NOT return JSON.
- DO NOT use markdown.
- One field per line in this exact format:
key: value
- Never omit fields. Use null if unknown.
- Rewrite vague input into actionable engineering language.
- Infer category, priority, tags, and difficulty whenever possible.
- If the issue is vague, aggressively populate missing_information with useful engineering questions.

ARRAY FIELD RULES:
- The following fields are arrays:
tags
stack_trace
affected_files
missing_information
steps_to_reproduce

- Array fields MUST use comma-separated values ONLY.
- NEVER use numbered lists.
- NEVER use bullet points.
- NEVER combine multiple items into one sentence.
- Each array item should be short and distinct.

GOOD:
steps_to_reproduce: Open login page, Enter credentials, Click submit
missing_information: Browser version, Console logs, Stack trace

BAD:
steps_to_reproduce: 1. Open login page 2. Enter credentials
missing_information: What browser are you using and do you have logs?

FIELDS:
title
description
summary
status
priority
difficulty
category
tags
entry_point
error_type
error_message
stack_trace
affected_files
expected_behavior
actual_behavior
missing_information
steps_to_reproduce
hypothesis

RULES:
- status must always be: Open
- priority must be one of:
Low, Medium, High, Critical
- difficulty must be one of:
easy, medium, hard
- category must be one of:
Bug, Feature, Task
- tags should be chosen from:
ui, backend, database, authentication, performance, security, testing, documentation, integration, enhancement, research
- Broken behavior, crashes, errors, incorrect output = Bug
- New functionality request = Feature
- Setup, migration, refactor, cleanup, investigation = Task
- Crashes, auth failures, outages, or data loss = High or Critical priority

USER INPUT:
{raw_user_input}
`;

/**
 * Parses DeepSeek key-value output into a JSON object.
 *
 * @function parseKeyValueResponse
 * @param {string} text - Raw LLM response text.
 * @returns {object} Parsed structured issue object.
 */
function parseKeyValueResponse(text) {
	const result = {};

	const arrayFields = new Set(['tags', 'details.stack_trace', 'details.affected_files', 'steps_to_reproduce', 'missing_information']);

	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

	for (const line of lines) {
		const separator = line.indexOf(':');

		if (separator === -1) continue;

		const key = line.slice(0, separator).trim();
		let value = line.slice(separator + 1).trim();

		if (value.toLowerCase() === 'null') {
			value = null;
		} else if (arrayFields.has(key)) {
			value = value
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean);
		}

		const path = key.split('.');
		let current = result;

		for (let i = 0; i < path.length - 1; i++) {
			if (!current[path[i]]) {
				current[path[i]] = {};
			}

			current = current[path[i]];
		}

		current[path[path.length - 1]] = value;
	}

	return result;
}

/**
 * Sends raw user input to DeepSeek and returns the structured issue object.
 *
 * @async
 * @function processIssue
 * @param {string} rawUserInput - Raw issue description from the user.
 * @param {string} apiKey - DeepSeek API key.
 * @returns {Promise<object>} Parsed issue object.
 * @throws {Error} If the API key is missing or the API request fails.
 */
export async function processIssue(rawUserInput, apiKey) {
	if (!apiKey) {
		throw new Error('DEEPSEEK_API is required');
	}

	const response = await fetch(`${BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: 'deepseek-v4-flash',
			messages: [
				{
					role: 'user',
					content: PROMPT.replace('{raw_user_input}', rawUserInput),
				},
			],
		}),
	});

	if (!response.ok) {
		throw new Error('LLM request failed');
	}

	const data = await response.json();

	const raw = data?.choices?.[0]?.message?.content;

	if (!raw) {
		throw new Error('DeepSeek returned empty response');
	}

	return parseKeyValueResponse(raw);
}
