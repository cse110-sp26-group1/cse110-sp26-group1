# Sprint Backlog

---

## Sprint 1 — Research, design, prototype (~May 4–10)

### Product

- [x] Project concept + dual-interface direction
- [ ] ADR (CLI tool + LLM layer + Cloudflare D1) started
- [ ] Personas, user stories, workflow diagrams started
- [ ] MVP draft started
- [ ] Start Miro board event flows started

### Build

- [x] Early tracker UI prototype
- [x] D1 schema prototyped design (`users`, `teams`, `issues`, …)

---

## Sprint 2 — Integrated MVP (~May 11–17)

### Backend

- [x] Setup Cloudflare Worker and D1 database
- [ ] Auth / login / CORS / sessions (Noah) started
- [ ] Teams + team members endpoint (Ben) started
- [ ] Invites endpoint — accept / reject (Ben) started
- [ ] Issue endpoint (Jonathan) started
- [ ] Agent endpoint (Michael) started
- [ ] LLM layer + DeepSeek API research/setup (Jerry + Anchita) started

### Frontend

- [ ] Move off localStorage-only prototype toward API integration started
- [ ] View password toggle on login / signup started

---

## Sprint 3 — Integration + demo prep (~May 18–25)

### Integration (sprint goal)

- [ ] Integrate team + invite APIs into frontend  started
- [ ] Integrate issue endpoints into web UI  started
- [ ] LLM enrich `POST /issues` end-to-end started
- [ ] Deploy pipeline + GitHub Pages started

### Frontend

- [ ]  **Send invite section** (team settings invite flow) started
- [ ] **Join workspace**  started
- [ ]  **Team view — needs UI** (teams dashboard + cards) started
- [ ] **Team roles, members, leave team, team settings** (settings modal + leave API) started
- [ ] **Leaving a team** started
- [ ] **Details page — needs UI** (split pane exists; polish continued Sprint 4) started
- [ ] **Short bio — place to display** (card UI existed; save/display fixed Sprint 4) started

---
## Sprint 4 — Polish, E2E, docs (~May 26–Jun 1)

### Frontend

- [ ] Join workspace / pending invites flow started
- [ ] Issue details page UI started
- [x] Short bio on team card
- [ ] Tags dropdown/filter started
- [x] Responsive viewport / mobile layout
- [ ] Notifications for new issues (removed later) started
- [x] Pending invite notification indicator
- [ ] Allegro logo started
- [ ] Consistent topbar / navbar started
- [ ] List of notifications started
- [x] Valid tags only
- [x] Edit issue UI fix
- [x] Remove Views link
- [ ] Priority dropdown order started
- [ ] Sort by priority / updated started
- [ ] Team page polish started
- [ ] Team page refresh / avatars started

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
- [ ] Browser unsafe-site warning research 

### Documentation

- [ ] JSDoc / code comments started
- [ ] User documentation started
- [ ] Technical docs for maintainers started
- [ ] Changelog and semantic versioning docs started
- [ ] CLI `SKILL.md` updates started

---

## Sprint 5 — Hardening + final delivery (Jun 2+)

### Product

- [x] Remaining UI fixes from sprint review 
- [x] Expanded E2E coverage
- [ ] Code documentation complete
- [ ] User documentation complete
- [x] Formal backlog in repo
- [ ] Website security warning
- [ ] Final demo / status video

---    