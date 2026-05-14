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

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
export default {
	async fetch(request, env, _ctx) {
		const url = new URL(request.url);
		const path = url.pathname;

		// routes/issues.js uses env.DB; wrangler.jsonc binds issue_tracker_db
		const envWithDb = { ...env, DB: env.issue_tracker_db };

		// Fix: Restore the root response so index.spec.js passes
		if (path === '/') {
			return new Response('Hello World');
		}

		if (path.startsWith('/issues')) {
			return handleIssues(request, envWithDb);
		}

		return new Response('Not Found', { status: 404 });
	},
};
