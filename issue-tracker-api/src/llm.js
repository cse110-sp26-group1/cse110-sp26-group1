import OpenAI from 'openai';

const client = new OpenAI({
	apiKey: '',
	baseURL: 'https://api.deepseek.com',
});

const PROMPT = `You are an issue triage agent for a software team. Given a user's raw issue description, produce a structured JSON object ready for the issue tracker API.

INSTRUCTIONS:
- Return ONLY a valid JSON object. No markdown fences, no explanation.
- Omit any field you cannot reasonably infer — fill fields with null.
- The fewer details the user provides, the MORE you should populate "missing_information" with specific questions that would help clarify the issue.
- Infer category from context: vague requests like "make X work" are "Task" unless there's evidence of a bug (error messages, crashes, broken behavior).
- Be opinionated about priority: if a user reports a crash, that's High/Critical. If it's a vague request, it's Medium or Low.

OUTPUT SCHEMA:
{
  "title": "string — concise, specific title (rewrite vague input into something actionable)",
  "description": "string — expanded description with any context you can infer",
  "summary": "string (optional) — one-sentence summary if description is long",
  "status": "Open",
  "priority": "Low | Medium | High | Critical",
  "category": "Bug | Feature | Task",
  "tags": ["from: ui, backend, database, authentication, performance, security, testing, documentation, integration, enhancement, research"],
  "difficulty": "easy | medium | hard (your best estimate)",
  "details": {
    "entry_point": "string — file, function, or component if identifiable",
    "error_type": "string — e.g. TypeError, 500, CORS",
    "error_message": "string — exact error text if provided",
    "stack_trace": ["string array — stack frames if provided"],
    "affected_files": ["string array — files involved if identifiable"]
  },
  "expected_behavior": "string — what should happen",
  "actual_behavior": "string — what actually happens",
  "steps_to_reproduce": ["string array — ordered steps"],
  "missing_information": ["string array — specific questions to ask the user to clarify the issue"],
  "hypothesis": "string — your best guess at root cause or what needs to happen"
}

RULES:
1. "title" should always be rewritten to be specific and actionable, even if the user input is vague.
2. Omit the entire "details" object if there is no error/technical info to populate it with.
3. Do NOT include: id, created_by, team_id, created_at, updated_at, token_usage, resolution_notes.
4. For Features/Tasks with no error context, omit "details", "actual_behavior", and "steps_to_reproduce".

USER INPUT:{raw_user_input}
`;

export async function processIssue(rawUserInput) {
	const response = await client.chat.completions.create({
		model: 'deepseek-v4-flash',
		messages: [
			{
				role: 'user',
				content: PROMPT.replace('{raw_user_input}', rawUserInput),
			},
		],
	});

	return response.choices[0].message.content;
}
