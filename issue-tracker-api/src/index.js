/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
// export default {
// 	// underscore prefixes as these variables are not currently being used
// 	async fetch(_request, _env, _ctx) {
// 		return new Response('Hello World!');
// 	},
// };

import { handleIssues } from '../routes/issues.js';
import { handleAgents } from '../routes/agent.js';
import { handleInvites } from '../routes/invites.js';
import { handleTeams } from '../routes/teams.js';
import { handleAuth } from '../routes/auth.js';

const ALLOWED_ORIGINS = [
	'http://localhost:3000',
	'https://cse110-sp26-group1.github.io',
	// 'https://issue-tracker-api.your-subdomain.workers.dev',
];

const CORS_HEADERS = {
	'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Wraps a Response with the appropriate CORS headers based on the request origin.
 * @param {Response} response - The response to decorate.
 * @param {Request} request - The incoming request.
 * @returns {Response} A new Response with CORS headers applied.
 */
function withCors(response, request) {
	const origin = request.headers.get('Origin');
	const res = new Response(response.body, response);

	if (ALLOWED_ORIGINS.includes(origin)) {
		res.headers.set('Access-Control-Allow-Origin', origin);
	}

	Object.entries(CORS_HEADERS).forEach(([key, value]) => {
		res.headers.set(key, value);
	});

	return res;
}

/**
 * Main Cloudflare Worker entry point.
 * @param {Request} request - The incoming HTTP request.
 * @param {Env} env - Worker environment.
 * @param {ExecutionContext} _ctx - Execution context.
 * @returns {Promise<Response>}
 */
export default {
	async fetch(request, env, _ctx) {
		if (request.method === 'OPTIONS') {
			const origin = request.headers.get('Origin');
			const headers = { ...CORS_HEADERS };

			if (ALLOWED_ORIGINS.includes(origin)) {
				headers['Access-Control-Allow-Origin'] = origin;
			}

			return new Response(null, { status: 204, headers });
		}

		const url = new URL(request.url);
		const path = url.pathname;

		if (path.startsWith('/auth')) {
			return withCors(await handleAuth(request, env), request);
		}

		if (path.startsWith('/issues')) {
			return withCors(await handleIssues(request, env), request);
		}

		if (path.startsWith('/teams')) {
			return withCors(await handleTeams(request, env), request);
		}

		if (path.startsWith('/invites')) {
			return withCors(await handleInvites(request, env), request);
		}

		if (path.startsWith('/agents')) {
			return withCors(await handleAgents(request, env), request);
		}

		return withCors(new Response('Not Found', { status: 404 }), request);
	},
};
