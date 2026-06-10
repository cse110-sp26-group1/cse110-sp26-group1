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
1. View Password:
- used ai to help research and create about how to create a eyeball toggle for login pages. Accessible Rich Internet Applications(aria) is industry standard for accessibility. 
- used ai to help verify if keeping it a seperate file is better or to just intergrate it into login/sigup.
- still hand checked to verify everything and handwrote all of the comments for toggle password.

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

### Jerry:

---

### Jonathan:

---

### Michael:

---

### Noah:
