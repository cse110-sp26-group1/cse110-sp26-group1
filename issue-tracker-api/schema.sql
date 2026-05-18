--------------------------------- USERS TABLE ---------------------------------
-- discuss on additional fields for user profile info
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL, --- i'm assuming we keep this
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

--------------------------------- TEAMS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

--------------------------------- TEAM MEMBERS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  PRIMARY KEY (team_id, user_id),

  -- delete row if team_id/user_id gets deleted
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

--------------------------------- ISSUES TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,

  assigned_to INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  summary TEXT,
  status TEXT DEFAULT 'Open',
  priority TEXT DEFAULT 'Medium',
  difficulty TEXT DEFAULT 'unknown',
  category TEXT DEFAULT 'Bug',
  tags TEXT DEFAULT '[]',

  entry_point TEXT,
  error_type TEXT,
  error_message TEXT,
  stack_trace TEXT,
  affected_files TEXT,

  expected_behavior TEXT,
  actual_behavior TEXT,
  missing_information TEXT,
  steps_to_reproduce TEXT,
  hypothesis TEXT,

  token_usage INTEGER,
  resolution_notes TEXT,

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

--------------------------------- AGENTS TABLE ---------------------------------e
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  token TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

--------------------------------- AGENT ATTEMPTS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS agent_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,

  --- maybe have a user_id field -> which user authorized this agent to work
  --- on this issue
  agent_id INTEGER NOT NULL, --- prob remove this 
  agent_attempted_at TEXT DEFAULT (datetime('now')), --- may be unnecessary
  attempt_number INTEGER,
  result TEXT,
  notes TEXT,
  token_usage INTEGER,

  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id), --- remove this
  UNIQUE(issue_id, agent_id, attempt_number) --- change this
);

--------------------------------- INVITES TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  inviter_user_id INTEGER NOT NULL,
  invited_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT DEFAULT (datetime('now')),

  UNIQUE(team_id, inviter_user_id, invited_user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY (inviter_user_id) REFERENCES users(id),
  FOREIGN KEY (invited_user_id) REFERENCES users(id)
);

--------------------------------- SESSIONS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

--------------------------------- INDEXES ---------------------------------

CREATE INDEX idx_issues_team_id --- all issues in a team
ON issues(team_id);

CREATE INDEX idx_issues_assigned_to -- all issues assigned to user 
ON issues(assigned_to);

CREATE INDEX idx_team_members_user_id --- all teams a user is in
ON team_members(user_id);
