Sections are ordered in increasing insensity for AI use, but all require very similar amounts of code setup work (especially with AI helping and especially if we build them with the focus of practically only needing to scale to one user)

**WARNING**: The third and fourth sections will require a lot, and I mean A LOT, of setup for the AI work flow, I just included them for completeness. The fifth just contains some good practices for how a pipeline should be structured.

# Issue Drafting:

- Sentry AI summarizes stack traces and error logs into human-readable descriptions
- Github Copilot helps users formulate issues by autocompleting descriptions and summarizing attached code snippets

AIs are highly effective at translating telemtry into clear, natural language summaries. Having the AI act as a ticket intake assistant reduces a lot of the friction that comes with not only reporting the bug but also reproducing a bug afterwards.
This also only requires like 1-2 AI calls per ticket, making it really efficient.

Some common patterns to improve accuracy/performance include:

- Structured Output Enforcement: Forcing the LLM to return data in strict JSON formats ensuring specific fields (`steps_to_reproduce`, `expected_behavior`, etc.) are always filled in.
- Few-Shot Prompting: Feeding the AI 2-3 examples of "perfect" bug reports so it has something to work with
- Automated Context Gathering: Running lightweight scripts to pull environment variables, browser data, system state, etc. Gives the LLM a richer context.

# Report Classification:

- [Agile-Style Workflow](https://www.mdpi.com/2079-8954/13/3/208)
- [A model-specific approach](https://www.sciencedirect.com/science/article/pii/S2665963826000060)
- Linear has two models (Asks and Triage) that group similar bug reports, flag duplicates, and suggest tags/labels based on the text
- Jira also includes something like this (Atlassian Intelligence) that cateogirzes incoming tickets by intent (Hardware Request, Authentication Bug, etc.)

AIs show all of the same strengths from the previous sections when it comes to things like intent detection and even classification. The main risk is how we define the buckets we want it to classify into.

Some common patterns to improve accuracy/performance include:

- Confidence Thresholding: Having a fullback if the LLM indicates that it is not certain about the classification of a ticket.
- Hybrid AI/ML Routing: Most actually don't solely rely on LLMs, but use other ML techniques like vector embeddings to perform stricter, more interpretably classification.

# Bug Localization:

- [CogniGent](https://arxiv.org/pdf/2601.12522)
- [SourceGraph Cody](https://sourcegraph.com/docs/cody)
- [Raygun](https://raygun.com/ai-error-resolution)

Can succeed where simple keyword searches or single-prompt LLM queries fail, but does require a multi-agent or pipeline approach

Some common patterns to improve accuracy/performance include:

- Knowledge Graph: Parsing the repository to construct a knowledge graph or an abstract syntax tree can reduce the friction between the AI and the search.
- Multi-Agent Pipelines: Ex. One agent forms a hypothesis, a second agent performs a semantic search, a third agent validates if the retrieved code actually contains the flaw (obviously can be done with one agent).
- RAG: Improved methods of document retrieval

# Issue Resolution:

- [SWE-Fixer](https://arxiv.org/abs/2501.05040)
- [AutoCodeRover](https://arxiv.org/abs/2404.05427) provides a nice layout for how agent interaction with a codebase could work
- Literally any coding agent

Generating code is simple, generating correct code is really really hard and often needs more than just a direct input output structure with an agent to be reliable.

Some common patterns to improve accuracy/performance include:

- Sandboxed Execution Environments: Giving the agent access to a secure, isolated container where it can run bash commands, do unit tests, see errors etc.
- Self-Correction Loops: Program, Test, Read stack trace if an error occurs, repeat
- Tool Provisioning: Provide the agent with specific tools so it can interact with the code like a developer would

# End-To-End Bug Tracking:

- [Past, Present, and Future of Bug Tracking in the Generative AI Era](https://arxiv.org/pdf/2510.08005)

The biggest problem for these are human trust and oversight. No human is in the loop, more errors occur, especially if we need to cut corners for the task.