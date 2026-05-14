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
import { handleAuth } from '../routes/auth.js';

const ALLOWED_ORIGINS = [
	'http://localhost:3000',
	// 'https://your-org.github.io',  // add GitHub Pages URL when known
	// 'https://issue-tracker-api.your-subdomain.workers.dev',  // add deployed worker URL when known
];

const CORS_HEADERS = {
	'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Wraps a Response with the appropriate CORS headers based on the request origin.
 * Only sets `Access-Control-Allow-Origin` for origins in ALLOWED_ORIGINS.
 * @param {Response} response - The response to decorate.
 * @param {Request} request - The incoming request, used to read the Origin header.
 * @returns {Response} A new Response with CORS headers applied.
 */
function withCors(response, request) {
	const origin = request.headers.get('Origin');
	const res = new Response(response.body, response);
	if (ALLOWED_ORIGINS.includes(origin)) {
		res.headers.set('Access-Control-Allow-Origin', origin);
	}
	Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
	return res;
}

/**
 * Main Cloudflare Worker entry point. Routes requests to the appropriate handler
 * and wraps every response with CORS headers.
 * @param {Request} request - The incoming HTTP request.
 * @param {Env} env - Worker environment bindings (includes `issue_tracker_db` D1 binding).
 * @param {ExecutionContext} _ctx - Execution context (unused).
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

		// routes use env.DB; wrangler.jsonc binds issue_tracker_db
		const envWithDb = { ...env, DB: env.issue_tracker_db };

		if (path.startsWith('/auth')) {
			return withCors(await handleAuth(request, envWithDb), request);
		}

		if (path.startsWith('/issues')) {
			return withCors(await handleIssues(request, envWithDb), request);
		}

		return withCors(new Response('Not Found', { status: 404 }), request);
	},
};
