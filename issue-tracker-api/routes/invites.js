import { handleInvites } from "../routes/invites.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (
      url.pathname.startsWith("/invites") ||
      (url.pathname.startsWith("/teams/") &&
        url.pathname.endsWith("/invite"))
    ) {
      return handleInvites(request, env);
    }

    return Response.json(
      {
        error: "Route not found",
        path: url.pathname,
        method: request.method,
      },
      { status: 404 }
    );
  },
};