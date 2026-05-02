# Scaffolding Research

## General Flow (Architecture)

1. User
2. Frontend (UI)
3. Cloudflare Worker (backend)
4. LLM API
5. Back to Cloudflare Worker
6. Back to Frontend (UI)
7. Save issue to localStorage
   *(can later be updated to Cloudflare D1 database)*
8. User sees final result

---

## Getting Started

### 1. Repository Structure

Inside `cse110-sp26-group1/source`:

```
frontend/
worker/
docs/
tests/
```

**Purpose:**

- `frontend/` → user interface and client-side logic
- `worker/` → backend implemented using a Cloudflare Worker
- `docs/` → architectural decisions, planning, and meeting notes
- `tests/` → unit and end-to-end testing

---

### 2. Frontend Setup

Inside `frontend/`:

**Roles:**

- `index.html` → page structure
- `style.css` → visual styling
- `app.js` → application logic
- `storage.js` → centralized data operations (get, save, update, delete)

---

## Core Features

### Non-AI (CRUD)

- Create issue
- View issues
- Edit issue
- Delete issue

---

### AI Features

The system will incorporate AI to assist with:

- Generating descriptions
- Suggesting priority and tags
- Summarizing descriptions

---

### AI Interaction Design

A hybrid approach may be used:

- Description generation may occur automatically after the user enters a title
- Priority and tags may be suggested automatically or triggered by the user
- Summarization may be triggered when needed

---

## Issue Data Model (Schema)

Each issue contains the following fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique identifier |
| `title` | string | Short task name |
| `description` | string | Detailed explanation |
| `priority` | string | Urgency level (`low` / `medium` / `high`) |
| `tags` | array | Labels used for categorization |
| `status` | string | Progress state (`todo` / `in-progress` / `done`) |
| `createdAt` | string | Timestamp of creation |
| `updatedAt` | string | Timestamp of last modification |

### Example Issue

```json
{
  "id": 1,
  "title": "Fix login bug",
  "description": "Users cannot log in due to session timeout...",
  "priority": "high",
  "tags": ["bug", "authentication"],
  "status": "todo",
  "createdAt": "2026-05-02T10:30:00",
  "updatedAt": "2026-05-02T10:30:00"
}
```

---

## Storage Strategy

### Phase 1

Use **localStorage**

**Rationale:**
- Simple implementation
- No backend storage required
- Sufficient for demonstrating CRUD functionality

### Phase 2

Can later be updated to **Cloudflare D1 database**

**Rationale:**
- Persistent cloud storage
- Supports scalability
- Aligns with real-world architecture

---

## UI Requirements

### Inputs

- Title input
- Description textarea

### AI Interaction

- Automatic generation where appropriate
- User-triggered actions where needed

### Display Fields

- Priority
- Tags

### Issue List

- Display all saved issues

### User Actions

- Save
- Edit
- Delete

---

## Backend Design (Cloudflare Worker)

The backend is implemented using a Cloudflare Worker, which acts as an intermediary between the frontend and the LLM API.

**Flow:**

```
Frontend → Cloudflare Worker → LLM API → Cloudflare Worker → Frontend
```

### Endpoints

| Endpoint | Method |
|----------|--------|
| `/generate-description` | POST |
| `/suggest-metadata` | POST |
| `/summarize` | POST |

### Responsibilities

**Generate Description**
- Input: `title`
- Output: `description`

**Suggest Metadata**
- Input: `title` and `description`
- Output: `priority` and `tags`

**Summarize**
- Input: long `description`
- Output: shortened version

---

## Development Strategy

### Phase 1: Scaffolding

- Establish project structure
- Define UI layout
- Define data model
- Set up Cloudflare Worker

### Phase 2: Core Features

- Implement CRUD functionality
- Integrate localStorage

### Phase 3: AI Integration

- Connect Cloudflare Worker to LLM API
- Integrate AI into the UI workflow

### Phase 4: Enhancements

- Refine UI
- Add testing
- Explore Cloudflare D1 integration

### Phase 5: Designing for Easy Upgrade to Cloudflare D1

#### Core Idea

Separate **what your app does** from **how data is stored**.

If done right, switching from localStorage to D1 later is a small change, not a full rewrite.

#### The Key Rules

**1. Use `storage.js` for all data operations**
Never call `localStorage` directly in your UI. Always go through the four functions in `storage.js`:
- `getIssues()` — load all issues
- `saveIssue(issue)` — add a new issue
- `updateIssue(issue)` — edit an existing issue
- `deleteIssue(id)` — remove an issue

When you upgrade to D1, you only rewrite `storage.js`. Nothing else changes.

**2. Don't change the issue schema**
Keep the same fields throughout the project — `id`, `title`, `description`, `priority`, `tags`, `status`, `createdAt`, `updatedAt`. Changing the structure later breaks both localStorage and the database.

**3. Always use `issue.id` to identify issues**
Never use array positions like `issues[0]`. Databases rely on IDs, not positions.

#### Upgrade Flow

```
Before: UI → storage.js → localStorage
After:  UI → storage.js → Worker → D1
```

Only `storage.js` changes. The UI stays the same.

---

## Summary

- Build a custom issue tracker
- Use a Cloudflare Worker as the backend for AI functionality
- Use AI to enhance issue creation and management
- Begin with localStorage for persistence
- Transition to Cloudflare D1 if needed


[D1 Cloudfare](https://developers.cloudflare.com/d1/)