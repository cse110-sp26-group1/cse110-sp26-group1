# Sprint Backlog

**Legend:** `[x]` done · `[ ]` not done / still buggy · `[~]` partial

---

## Sprint 1 — Research, design, prototype (~May 4–10)

### Product

- [x] Project concept + dual-interface direction
- [~] ADR (CLI tool + LLM layer + Cloudflare D1)
- [~] Personas, user stories, workflow diagrams
- [~] MVP draft
- [~] Start Miro board event flows 

### Build

- [x] Early tracker UI prototype
- [x] D1 schema prototyped design (`users`, `teams`, `issues`, …)

---

## Sprint 2 — Integrated MVP (~May 11–17)

### Backend

- [x] Setup Cloudflare Worker and D1 database
- [~] Auth / login / CORS / sessions (Noah)
- [~] Teams + team members endpoint (Ben)
- [~] Invites endpoint — accept / reject (Ben)
- [~] Issue endpoint (Jonathan)
- [~] Agent endpoint (Michael)
- [~] LLM layer + DeepSeek API research/setup (Jerry + Anchita)

### Frontend

- [~] Move off localStorage-only prototype toward API integration
- [~] View password toggle on login / signup

---

## Sprint 3 — Integration + demo prep (~May 18–25)

### Integration (sprint goal)

- [~] Integrate team + invite APIs into frontend 
- [~] Integrate issue endpoints into web UI 
- [~] LLM enrich `POST /issues` end-to-end
- [~] Deploy pipeline + GitHub Pages

### Frontend

- [~]  **Send invite section** (team settings invite flow)
- [~] **Join workspace** 
- [~]  **Team view — needs UI** (teams dashboard + cards)
- [ ] **Team roles, members, leave team, team settings** (settings modal + leave API)
- [ ] **Leaving a team**
- [~] **Details page — needs UI** (split pane exists; polish continued Sprint 4)
- [~] **Short bio — place to display** (card UI existed; save/display fixed Sprint 4)

---
## Sprint 4 — Polish, E2E, docs (~May 26–Jun 1)

### Frontend

- [~] Join workspace / pending invites flow
- [~] Issue details page UI
- [x] Short bio on team card
- [~] Tags dropdown/filter
- [x] Responsive viewport / mobile layout
- [~] Notifications for new issues (removed later)
- [~] Notification styling
- [x] Pending invite notification indicator
- [ ] Allegro logo
- [~] Consistent topbar / navbar
- [~] List of notifications
- [x] Valid tags only
- [x] Edit issue UI fix
- [x] Remove Views link
- [~] Priority dropdown order
- [~] Sort by priority / updated
- [~] Team page polish
- [~] Team page refresh / avatars

### Bugs

- [ ] Delete issue from UI
- [ ] Update category from UI
- [ ] Team switch shows open issues only
- [ ] Multi-tag edit
- [ ] Difficulty color chip
- [ ] Assignee name / avatar
- [ ] Invite timestamp formatting
- [ ] Duplicate back-to-teams navigation
- [ ] Text overflow
- [ ] LLM summary / hypothesis consistency
- [ ] Browser unsafe-site warning

### Documentation

- [~] JSDoc / code comments
- [~] User documentation
- [~] Technical docs for maintainers
- [~] Changelog and semantic versioning docs
- [~] CLI `SKILL.md` updates

---

## Sprint 5 — Hardening + final delivery (Jun 2+)

### Product

- [ ] Remaining UI fixes from sprint review
- [x] Expanded E2E coverage
- [~] Code documentation complete
- [~] User documentation complete
- [x] Formal backlog in repo
- [ ] Website security warning
- [ ] Final demo / status video

---    