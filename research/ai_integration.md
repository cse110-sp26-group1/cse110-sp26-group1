# Agent Issue Tracker (AIT) AI Integration Research

## Ranking Criteria


| Criterion                | Why it matters for AIT                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Cost per 1M tokens       | AIT will run many background tasks: triage, dedupe, summaries, repro attempts, log parsing, and PR review. |
| Coding performance       | AIT needs models that can understand bugs, inspect repos, generate patches, and reason about tests.        |
| Tool use / agent ability | AIT should call repo search, test runners, ticket APIs, CI logs, and patch-generation tools.               |
| Context length           | Long issue threads, logs, stack traces, and repo summaries can be large.                                   |
| Enterprise fit           | Security, data residency, audit logs, vendor support, and reliability matter for production use.           |


---

## Cost-Efficient Ranking


| Rank | Model                   | Approx. API cost per 1M tokens                                                                                                                                                                                                           | Best AIT use                                                               | Strength                                                                  | Weakness                                                            |
| ---- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1    | DeepSeek V4 Flash / Pro | Flash: $0.14 input / $0.28 output. Pro promo: $0.435 input / $0.87 output. [DeepSeek API pricing](https://api-docs.deepseek.com/quick_start/pricing)                                                                                     | Cheap coding worker, repo/log analysis, routine bug triage, patch attempts | Very strong price/performance, 1M context, tool calls, JSON, FIM          | Discount may change; check compliance and vendor-risk requirements. |
| 2    | Kimi K2.6               | $0.95 input / $4 output [Kimi API Platform](https://platform.moonshot.ai)                                                                                                                                                                | Main coding-agent worker                                                   | Excellent coding scores for the price; strong long-horizon agent behavior | 256K context; newer ecosystem than OpenAI/Anthropic/Google.         |
| 3    | Qwen3.5 Flash / Plus    | Qwen Flash: $0.065 input / $0.26 output [OpenRouter: Qwen3.5-Flash](https://openrouter.ai/qwen/qwen3.5-flash-02-23). Global Plus: $0.4 input / $2.4 output [OpenRouter: Qwen3.5 Plus](https://openrouter.ai/qwen/qwen3.5-plus-20260420). | Ticket labels, dedupe, summaries, field extraction, routing                | Extremely cheap, 1M context for Plus/Flash                                | Not my first choice for hard patch generation.                      |
| 4    | Gemini 3.1 Flash-Lite   | $0.25 input / $1.50 output. [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite-preview)                                                                                                            | Google Cloud high-volume processing                                        | Good cheap Google-platform agentic worker                                 | Not the best Gemini for hard coding; use Gemini Pro for that.       |


---

## Performance Ranking


| Rank | Model           | Approx. API cost per 1M tokens                                                                                                                                | Performance signal                                                                      | Best AIT use                                                                     | Weakness                                                  |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | GPT-5.5         | $5 input / $30 output [OpenAI API pricing](https://openai.com/api/pricing/)                                                                                   | Vals SWE-bench: 82.60%; OpenAI Terminal-Bench 2.0: 82.7                                 | Hard bugs, autonomous coding, multi-file patches, final escalation               | Expensive; check API availability and deployment rules.   |
| 2    | Claude Opus 4.7 | $5 input / $25 output [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)                                                              | Vals SWE-bench: 82.00%; Anthropic positions it for complex reasoning and agentic coding | Code review, ambiguous issues, long-horizon coding, careful reasoning            | Expensive; tokenizer may increase real token counts.      |
| 3    | Gemini 3.1 Pro  | $2 input / $12 output up to 200K; $4 input / $18 output above 200K [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-pro-preview) | Vals LiveCodeBench: 88.48%; Vals SWE-bench: 78.80%                                      | Huge context, multimodal tickets, design docs, logs, diagrams, codebase analysis | Less strong than GPT-5.5 / Opus 4.7 on Vals SWE-bench.    |
| 4    | Kimi K2.6       | $0.95 input / $4 output [Kimi API Platform](https://platform.moonshot.ai)                                                                                     | Kimi reports SWE-bench Verified 80.2, SWE-bench Pro 58.6, LiveCodeBench 89.6            | Best high-performance coding model per dollar                                    | 256K context; enterprise support varies by deployment.    |
| 5    | DeepSeek V4 Pro | Promo: $0.435 input / $0.87 output [DeepSeek API pricing](https://api-docs.deepseek.com/quick_start/pricing)                                                  | Vals LiveCodeBench: 87.48%                                                              | Cost-sensitive high-performance coding worker                                    | Use premium models for final review of high-risk changes. |


---

## AIT Model Architecture (We can also use one model to make everything easy)


| AIT module                                                       | Recommended model type                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| Issue intake, title cleanup, tags, severity, duplicate detection | Qwen3.5 Flash, Gemini 3.1 Flash-Lite, DeepSeek V4 Flash |
| Log and stack-trace summarization                                | DeepSeek V4 Flash, Qwen3.5 Plus, Gemini Flash-Lite      |
| Repro-plan generation                                            | Kimi K2.6, DeepSeek V4 Pro, Gemini 3.1 Pro              |
| Patch generation                                                 | Kimi K2.6, DeepSeek V4 Pro, GPT-5.5, Claude Opus 4.7    |
| Final PR/code review                                             | Claude Opus 4.7, GPT-5.5, Gemini 3.1 Pro                |
| Large repo / multimodal issue analysis                           | Gemini 3.1 Pro, Claude Opus 4.7, DeepSeek V4 Pro        |
| Background batch jobs                                            | DeepSeek V4 Flash, Qwen3.5 Flash, Gemini Flash-Lite     |
| Enterprise-safe premium fallback                                 | Claude Opus 4.7 or GPT-5.5                              |


---

## Practical Setup

Use **Qwen3.5 Flash** or **DeepSeek V4 Flash** background tasks, **Kimi K2.6** or **DeepSeek V4 Pro** for most coding-agent work, and **Claude Opus 4.7 / GPT-5.5 / Gemini 3.1 Pro** only for hard escalations and final review.

Strong performance without paying premium-model prices for every ticket.

## Implementation Notes

Use [OpenRouter Models](https://openrouter.ai/models) to compare providers, pricing, and context limits, and to pick model IDs when routing AIT tasks through a single OpenAI-compatible API. Benifit: easy to change models with a single API.