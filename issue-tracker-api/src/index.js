/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export default {
	async fetch(request, env, ctx) {
		return new Response('Hello World!');
	},
};
// example how we'd manage the requests
// import { handleIssues } from "./routes/issues.js";
// import { handleInvites } from "./routes/invites.js";
// import { handleTeams } from "./routes/teams.js";

// export default {
//   async fetch(request, env) {
//     const url = new URL(request.url);
//     const path = url.pathname;

//     // Issues routes
//     if (path.startsWith("/issues")) {
//       return handleIssues(request, env);
//     }

//     // Invites routes
//     if (path.startsWith("/invites")) {
//       return handleInvites(request, env);
//     }

//     // Teams routes
//     if (path.startsWith("/teams")) {
//       return handleTeams(request, env);
//     }

//     return new Response("Not Found", { status: 404 });
//   }
// };