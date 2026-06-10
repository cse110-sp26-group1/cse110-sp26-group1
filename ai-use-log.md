# AI Usage Log


## Entry Template
- Use this template for each time you log significant AI usage when working on the project. 
- Bullet points are preferred. 
- Place under your assigned section
```md
### Name

#### AI Tool(s) / LLM(s) used
- 

#### Purpose
- 

#### Results 
- Pros?
- Cons?
- Did you review the AI output?
- Did you fully copy paste the output or did you make any changes?

#### Related Files
- 
```

---

## Logged Entries

---

### Ailyn:


---

### Albert:

#### AI Tool(s) / LLM(s) used
- Claude code
- Codex
- Cursor

#### Purpose
- Claude and Codex:
  - Primarily for code creation for the frotnend features and e2e testing
  - Research about certain fixes that needed to be fixed
  - Prototyping our AIT
  - Understanding large files
  - Used the Codex code review feature to see if im missing anything such as security issues
  - find potential bugs 

- Cursor:
  - Markdown file formating

#### Results 
- Pros?
  - Helped speed up the learning process and code creation process
  - Helped saved time transfering everything from a google doc into markdown format
  - When prompted, found the bugs quicker than I could
- Cons?
  - generated code, when not prompted well, created poor quality code that I had to go back and reprompt it to make it understand what I wanted
  - Somtimes had to give it a picture refrence on where things should be for it to understand it better(had to create visiuals)
  - When formating Markdown files, it would somtimes change some of the context and gave incorrect results
- Did you review the AI output?
  - Generally yes. I would check to see what it did then document it into a google doc for future refrence. For the e2e testing, I would have it document it into the document on what needed to be changed next.
- Did you fully copy paste the output or did you make any changes?
  - For Markdown files, I would copy and paste it but hand review it to make sure it didnt put any misinformation
  - I made sure to review the AI generated code and locally test before pushing to the repo. If anything didnt seem correct, I would prompt it to make a change. I also did smaller fixes myself (such as bolding something, changing the order, ect.)

#### Related Files
- e2e testing files, frontend, and formating markdown files.
---

### Amberly:
- fix linting 
- used ai to help with getting LLM response
- conversion of px to dynamic
- used to help identify dead code

---

### Amormio:

#### AI Tool(s) / LLM(s) used
- ChatGPT, Deepseek, Cursor

#### Purpose
- ChatGPT and Deepseek:
  - Sprint 0 research stage (e.g. references, existing issue trackers, ...)
  - formatting markdown files (e.g. sprint plans from google docs)
  - prototyping early examples of backend schema 
  - understanding how to setup Cloudflare Worker
- Cursor:
  - code generation 
  - understanding certain code I wasn't familiar with (e.g. frontend code, certain backend code)
  - formatting markdown files
    - combining existing repo docs and refining to migrate into Wiki

#### Results 
- Pros?
 - Speed up process of finding references for research 
 - saved time through markdown file formatting
 - gave a good idea of what our backend schema could look like based on our project vision
 - helped me understand backend setup for our project
 - code generation was mainly for fixing bugs while simultaneously asking for understanding on confusion points like SQL code; helped fix backend endpoint bugs considering we knew what was missing/incorrect

- Cons?
  - researching references with AI didn't let me know about Beads (had to learn from Professor Powell himself), mostly about other products like Jira
  - generated code would sometimes be overkill or not match our product requirements
  - formatted markdown files would often be too verbose and assumed things about our project vision

- Did you review the AI output?
  - I had to review and edit the formatted markdown files most of the time as it was often too verbose and had slight mistakes
  - for larger generated code, I took pretty long reviewing it to understand it matched what we needed

- Did you fully copy paste the output or did you make any changes?
  - for markdown files, I typically copy pasted to a markdown file in our repo and edited it there
  - I copy pasted code snippets that were just several lines long for bug fixes, and for larger code only if I saw that it didn't have unnecessary features/considerations
    - also manually tested with curl commands (before we had unit tests) to our endpoints with local db setup to ensure expected output

#### Related Files
- most of the codebase, with heavier code generation to fix issues with the backend endpoints

---

### Anchita:
#### AI Tool(s) / LLM(s) used
- codex
- claude

#### Purpose
* Used it primarily for code creation, specifically for the LLM layer and command-line tool.
* Also used it for researching topics related to our project and building a better understanding.
* used it for setting up sem-ver and JSDoc in ci/cd pipeline
* Additionally used it for formatting documentation, I told it to only correct grammatical errors while preserving my wording.
* I also wrote function header comments on my own but used AI to check for grammatical mistakes, again with instructions to preserve my wording.

#### Results

Reviewing AI code:
* I made sure to review all AI-generated output by looking at the files and lines that were changed to verify the changes made sense to me.
* I also usually wrote the function header comments myself so that I understood what each method was doing.

Pros:
* Generally performed well across all tasks, especially frontend work.
* Particularly helpful for catching grammatical mistakes when writing function headers and documentation on my own.

Cons:
* Variable naming was sometimes poor, I changed them to be more meaningful.
* Occasionally ignored security concerns. For example, in the command-line tool, the password was initially not hidden in the terminal. I had to explicitly tell it to mask the password, since that is good practice from a security standpoint.
* When prompted to include all fields from the DB schema (particularly for the command-line tool), it skipped some fields. I only caught this by double-checking against the schema myself, then had to prompt it again to include the missing fields.

#### Related Files
- files in CLI directory
- llm.js in issue-tracker-api/src directory
- release.yml, lint.yml in github workflows

---

### Benjamin:
- used AI for understanding the invites and teams endpoint requirements
- used AI to help write invites and teams test files
- used AI to help debug database schema issues
- still hand-checked all tests to verify they pass, manually fixed status codes, removed non-existent columns (joined_at), and split tests into separate files 

---

### James:

#### AI Tool(s) / LLM(s) used
- Gemini Pro Web UI

#### Purpose
- Mainly code creation, sometimes getting a high-level understanding of large files that were hard to read.

#### Results
- AI Use: I had Gemini output line-by-line edits instead of entire files so that I could review and make edits with less friction. Very very helpful for the pros and cons listed below as well as keeping a consistent mindmap of the entire codebase.
- Pros: Once it was guided to the right idea the code was functional.
- Cons: 90% of the time it made stupid mistakes and/or decisions. Every AI I've ever used has also shown a consistent problem with finding where bugs are occurring in code, so all of the bugfixing was a large majority manual.

#### Related Files
- Basically the entire repo.

---

### Jerry

#### AI Tool(s) / LLM(s) Used

* Cursor: Composer 2
* Cursor: Claude Opus 4.8

#### Purpose

I used the AI tools for explanation, code generation, and debugging. First, I used them to better understand the profile structure and the overall organization of the project. I also used them to generate code, but after the code was generated, I manually reviewed it line by line before deciding whether it should be included in the project. In addition, I used the tools for debugging by asking them to identify potential issues, explain the cause of the problem, and describe the reasoning behind the suggested solution.

#### Results

**Pros**

* The tools were helpful for identifying bugs and potential issues in the code.
* They generated useful code that gave me a good starting point.
* They improved my efficiency by helping me understand and implement things faster.
* They helped clarify the logic and structure of the project.

**Cons**

* The generated output still required manual correction and careful review.
* Sometimes the tools generated errors or code that did not fully match the project requirements.
* If my prompt was not detailed enough, the output could include things I did not want or miss important context.

**Review Process**

* Yes, I reviewed the AI-generated output.
* After the tools generated explanations or code, I manually checked the output to make sure it matched the project requirements.
* For generated code, I reviewed it line by line and checked whether it introduced errors, unnecessary changes, or anything inconsistent with the existing codebase.

**Use of AI Output**

* I did not fully copy and paste the AI output without review.
* I used the AI-generated output as a reference or starting point, then manually tested, modified, and corrected it before including it in the project.
* I also asked follow-up questions to understand why certain changes were suggested before deciding whether to use them.

#### Related Files

* `cli/`
* `issue-tracker-api/llm.js`
* `frontend/`

---

### Jonathan:

---

### Michael:

---

### Noah:

### Team Member
- Noah

### AI Tool(s) / LLM(s) used
- Claude Code (claude-sonnet-4-6)

### Purpose
- Scaffolded the backend auth system (PBKDF2 hashing, `requireAuth` middleware, session management, auth endpoints)
- Setting up auth routing, CORS, and DB query patterns
- Writing and organizing developer documentation across `docs/` and `issue-tracker-api/`

### Results
- All output reviewed and adjusted before accepting
- Docs were iteratively refined based on feedback throughout

### Related Files
- `issue-tracker-api/src/lib/auth.js`
- `issue-tracker-api/routes/auth.js`
- `issue-tracker-api/src/index.js`
- `docs/backend/auth.md`, `docs/api/auth.md`, `docs/backend/routes.md`, `docs/backend/db.md`
