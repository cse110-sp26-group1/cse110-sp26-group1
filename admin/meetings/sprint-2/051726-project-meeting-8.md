# The Opera House: Sprint 2 Meeting

### Meeting Type: "Emergency" Discussion Meeting

### Purpose:
Discuss ongoing failures in backend endpoints and coordinate a plan to address during team meeting

### Present: Amormio, James

### Absent: Everyone else 

### Time and Place:

May 17, 2026 | 3-4pm Discord

## Agenda
- Review all the incorrect code throughout several endpoints 
  - missing required functionality for UI (specific methods and actions that need to be implemented)
- Go over possible deadlines for fixes so we can get a video presentation with a minimal working product

### Decisions Made:
- Agree on what the endpoints/schema need to fix
  - figure out a global handleAuth in index.js instead of repeating function calls in each endpoint
  - decide filtering (query string)
  - need to get an attempt_notes field in issues table (differs from resolution notes in the case where issue wasn't resolved)
  - remove agents table
  - make sure we handle in issues that the POST /issues actually goes through LLM layer (coordinate with Anchita and Jerry)
  - agent endpoint should follow the same exact format as the issues endpoint (the fixed issues endpoint version), meaning it will do the same exact stuff by returning the same data, handling data creation the same way
    - this makes it simpler for LLM team to change anything if needed and further coordinate on what gets added to data specifically for the agents to work with

- Set a strict deadline Monday night or Tuesday morning to get all fixes in the endpoints so we can publish Cloudflare Worker and front-end can actually connect
- Created rough plan of how we want to address the team in Monday's meeting
- Delay proper code quality, documentation, pipeline requirements until we can get a baseline working product

### Upcoming tasks:
- Work on endpoint fixes and front-end makes do with temporary function calls

### Meeting Summary:
Discuss ongoing failures in backend endpoints and coordinate a plan to address during team meeting
