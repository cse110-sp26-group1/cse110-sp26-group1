/**
 * This is plain JS so none of this type syntax or enum will actually work,
 * we'll have to manually validate each field when we receive it
 */

const ISSUE_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const ISSUE_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const ALLOWED_CATEGORIES = ["Bug", "Feature", "Task"];
const ALLOWED_TAGS = [
    "testing",
    "enhancement",
    "documentation",
    "research",
    "security",
    "ui",
    "backend",
    "database",
    "authentication",
    "performance",
    "integration",
    "unknown",
];

// USER SCHEMA
const userIssueSchema = {
    id: { type: "string", required: true }, // not inputted by user, we handle this
    title: { type: "string", required: true },
    description: { type: "string", required: true },
    summary: { type: "string", required: false },

    status: { type: "string", enum: ISSUE_STATUSES, required: true },
    priority: { type: "string", enum: ISSUE_PRIORITIES, required: true },
    category: { type: "string", enum: ALLOWED_CATEGORIES, required: true },

    tags: {
        type: "array",
        items: "string",
        enum: ALLOWED_TAGS,
        required: true,
    },

    // not inputted by user, we handle this
    created_at: { type: "string", format: "date-time", required: true },
    updated_at: { type: "string", format: "date-time", required: true },

    details: {
        type: "object",
        required: true,
        properties: {
            entry_point: { type: "string", required: true },
            error_type: { type: "string", required: true },
            error_message: { type: "string", required: true },
            stack_trace: { type: "array", items: "string", required: true },
            affected_files: { type: "array", items: "string", required: true },
            // resolution_notes: { type: "string", required: false }, unsure yet
            // if agent having this field removes need here
        },
    },
};

// AGENT SCHEMA
const agentIssueSchema = {
    // pass in all data from user schema
    ...userIssueSchema,

    // directly from user input (just repeating here to show for clarity, but
    // these will be listed already from the spread operator)
    entry_point: { type: "string", required: true },
    error_type: { type: "string", required: true },
    error_message: { type: "string", required: true },
    stack_trace: { type: "array", items: "string", required: true },
    affected_files: { type: "array", items: "string", required: true },

    // llm infers these fields based on user input
    expected_behavior: { type: "string", required: true },
    actual_behavior: { type: "string", required: true },
    missing_information: { type: "array", items: "string", required: true },

    // llm guesses based on project context and other fields
    steps_to_reproduce: { type: "array", items: "string", required: true },
    hypothesis: { type: "string", required: true },

    // agent fills these below
    total_token_usage: { type: "number", required: true },
    agent_attempted_at: {
        type: "string",
        format: "date-time",
        required: true,
    },
    previous_attempts: {
        type: "array",
        required: true,
        items: {
            type: "object",
            properties: {
                attempt: { type: "number", required: true },
                result: {
                    type: "string",
                    enum: ["failed", "partial", "success"],
                    required: true,
                },
                notes: { type: "string", required: true },
                token_usage: { type: "number" },
            },
        },
    },

    // data to send to human UI so user sees agent fix
    resolution_notes: { type: "string", required: false },
};
