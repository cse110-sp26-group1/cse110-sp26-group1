import { requireAuth } from '../src/lib/auth.js';
import { requireTeamMember } from '../src/lib/teams.js';

const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const ISSUE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ALLOWED_CATEGORIES = ['Bug', 'Feature', 'Task'];

/**
 * Handles all /issues routes: GET (list by team), POST (create), PATCH (update), DELETE (remove).
 * @param {Request} request
 * @param {{ DB: D1Database }} env - Worker environment with a D1 database binding.
 */
export async function handleIssues(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const pathParts = url.pathname.split('/');
    const issueId = pathParts[2];

    // Validate issueId early
    if (issueId) {
        const parsedIssueId = Number(issueId);
        if (!Number.isInteger(parsedIssueId) || parsedIssueId <= 0) {
            return Response.json({ error: 'Invalid issue ID format. Must be a positive integer.' }, { status: 400 });
        }
    }

    // GET /issues?team_id=X
    if (method === 'GET' && !issueId) {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const teamId = Number(url.searchParams.get('team_id'));
        if (!teamId) {
            return Response.json({ error: 'team_id query param required' }, { status: 400 });
        }

        if (!Number.isInteger(teamId) || teamId <= 0) {
            return Response.json({ error: 'Invalid team_id format. Must be a positive integer.' }, { status: 400 });
        }

        const membership = await requireTeamMember(env, auth.userId, teamId);
        if (membership.error) return membership.error;

        const { results } = await env.DB.prepare('SELECT * FROM issues WHERE team_id = ?').bind(teamId).all();

        const formatted = results.map((row) => ({
            ...row,
            tags: JSON.parse(row.tags || '[]'),
            stack_trace: JSON.parse(row.stack_trace || '[]'),
            affected_files: JSON.parse(row.affected_files || '[]'),
        }));

        return Response.json(formatted);
    }

    // POST /issues
    if (method === 'POST') {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const body = await request.json();

        if (!body.title || !body.team_id) {
            return Response.json({ error: 'title and team_id are required' }, { status: 400 });
        }

        if (typeof body.title !== 'string' || body.title.trim() === '') {
            return Response.json({ error: 'Invalid title format. Must be a non-empty string.' }, { status: 400 });
        }

        const parsedTeamId = Number(body.team_id);

        if (!Number.isInteger(parsedTeamId) || parsedTeamId <= 0) {
            return Response.json({ error: 'Invalid team_id. Must be a positive integer.' }, { status: 400 });
        }

        const membership = await requireTeamMember(env, auth.userId, parsedTeamId);
        if (membership.error) return membership.error;

        const status = body.status?.trim();
        const priority = body.priority?.trim();
        const category = body.category?.trim();

        if (status && !ISSUE_STATUSES.includes(status)) {
            return Response.json({ error: `Invalid status. Must be one of: ${ISSUE_STATUSES.join(', ')}` }, { status: 400 });
        }

        if (priority && !ISSUE_PRIORITIES.includes(priority)) {
            return Response.json({ error: `Invalid priority. Must be one of: ${ISSUE_PRIORITIES.join(', ')}` }, { status: 400 });
        }

        if (category && !ALLOWED_CATEGORIES.includes(category)) {
            return Response.json({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` }, { status: 400 });
        }

        const now = new Date().toISOString();

        const { success } = await env.DB.prepare(
            `
            INSERT INTO issues (
                team_id, created_by, title, description, summary,
                status, priority, category, tags, difficulty,
                entry_point, error_type, error_message, stack_trace,
                affected_files, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        )
            .bind(
                parsedTeamId,
                auth.userId,
                body.title.trim(),
                body.description || null,
                body.summary || null,
                status || 'Open',
                priority || 'Medium',
                category || 'Bug',
                JSON.stringify(body.tags || []),
                body.difficulty || null,
                body.details?.entry_point || null,
                body.details?.error_type || null,
                body.details?.error_message || null,
                JSON.stringify(body.details?.stack_trace || []),
                JSON.stringify(body.details?.affected_files || []),
                now,
                now,
            )
            .run();

        return Response.json({ success }, { status: 201 });
    }

    // PATCH /issues/:id
    if (method === 'PATCH' && issueId) {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const issue = await env.DB.prepare('SELECT team_id FROM issues WHERE id = ?').bind(Number(issueId)).first();

        if (!issue) {
            return Response.json({ error: 'Issue not found' }, { status: 404 });
        }

        const membership = await requireTeamMember(env, auth.userId, issue.team_id);
        if (membership.error) return membership.error;

        const body = await request.json();

        if (!body.status && !body.priority && !body.assigned_to) {
            return Response.json({ error: 'No valid fields provided' }, { status: 400 });
        }

        const status = body.status?.trim();
        const priority = body.priority?.trim();

        if (status && !ISSUE_STATUSES.includes(status)) {
            return Response.json({ error: 'Invalid status value' }, { status: 400 });
        }
        if (priority && !ISSUE_PRIORITIES.includes(priority)) {
            return Response.json({ error: 'Invalid priority value' }, { status: 400 });
        }

        let assignedTo = null;
        if (body.assigned_to !== undefined) {
            assignedTo = Number(body.assigned_to);
            if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
                return Response.json({ error: 'Invalid assigned_to format. Must be a positive integer.' }, { status: 400 });
            }
        }

        const now = new Date().toISOString();

        const { success } = await env.DB.prepare(
            `
            UPDATE issues SET
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                assigned_to = COALESCE(?, assigned_to),
                updated_at = ?
            WHERE id = ?
            `,
        )
            .bind(status || null, priority || null, assignedTo, now, Number(issueId))
            .run();

        return Response.json({ success });
    }

    // DELETE /issues/:id
    if (method === 'DELETE' && issueId) {
        const auth = await requireAuth(request, env);
        if (auth.error) return auth.error;

        const issue = await env.DB.prepare('SELECT team_id FROM issues WHERE id = ?').bind(Number(issueId)).first();

        if (!issue) {
            return Response.json({ error: 'Issue not found' }, { status: 404 });
        }

        const membership = await requireTeamMember(env, auth.userId, issue.team_id);
        if (membership.error) return membership.error;

        const { success } = await env.DB.prepare('DELETE FROM issues WHERE id = ?').bind(Number(issueId)).run();

        return Response.json({ success });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
}
