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
    const url = new URL(request.url);
    const method = request.method;

    // Health check / home route
    if (url.pathname === "/" && method === "GET") {
      return Response.json({
        message: "AIT API prototype is running",
      });
    }

    // GET /invites
    if (url.pathname === "/invites" && method === "GET") {
      return Response.json([
        {
          id: "1",
          team_id: "team_1",
          email: "test@example.com",
          role: "member",
          status: "pending",
          invited_by: "user_1",
          created_at: new Date().toISOString(),
        },
      ]);
    }

    // POST /invites
    if (url.pathname === "/invites" && method === "POST") {
      const body = await request.json();

      if (!body.email || !body.team_id) {
        return Response.json(
          { error: "Missing required fields: email and team_id" },
          { status: 400 }
        );
      }

      const invite = {
        id: crypto.randomUUID(),
        team_id: body.team_id,
        email: body.email,
        role: body.role || "member",
        status: "pending",
        invited_by: body.invited_by || null,
        created_at: new Date().toISOString(),
      };

      return Response.json(
        {
          success: true,
          invite,
        },
        { status: 201 }
      );
    }

    // DELETE /invites/:id
    if (url.pathname.startsWith("/invites/") && method === "DELETE") {
      const id = url.pathname.split("/")[2];

      if (!id) {
        return Response.json(
          { error: "Invite ID required" },
          { status: 400 }
        );
      }

      return Response.json({
        success: true,
        deleted: id,
      });
    }

    // POST /teams/:teamId/invite
    if (
      url.pathname.startsWith("/teams/") &&
      url.pathname.endsWith("/invite") &&
      method === "POST"
    ) {
      const parts = url.pathname.split("/");
      const teamId = parts[2];

      const body = await request.json();

      if (!teamId || !body.email) {
        return Response.json(
          { error: "Missing required fields: teamId and email" },
          { status: 400 }
        );
      }

      const invite = {
        id: crypto.randomUUID(),
        team_id: teamId,
        email: body.email,
        role: body.role || "member",
        status: "pending",
        invited_by: body.invited_by || null,
        created_at: new Date().toISOString(),
      };

      return Response.json(
        {
          success: true,
          teamId,
          invite,
        },
        { status: 201 }
      );
    }

    return Response.json(
      {
        error: "Route not found",
        path: url.pathname,
        method,
      },
      { status: 404 }
    );
  },
};
