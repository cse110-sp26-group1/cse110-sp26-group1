--------------------------------- USERS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);


--------------------------------- TEAMS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);


--------------------------------- TEAM_MEMBERS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'dev',
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);


--------------------------------- ISSUES TABLE ---------------------------------
-- -- Will discuss which ones will be required (not null)
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  assigned_to INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  summary TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT,
  category TEXT,
  tags TEXT,
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
  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);


--------------------------------- AGENT_ATTEMPTS TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS agent_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  agent_attempted_at TEXT DEFAULT (datetime('now')),
  total_token_usage INTEGER,
  attempt_number INTEGER,
  result TEXT,
  notes TEXT,
  token_usage INTEGER,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);


--------------------------------- INVITES TABLE ---------------------------------
CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  team_id INTEGER NOT NULL,
  inviter_user_id INTEGER NOT NULL,
  invited_user_id INTEGER NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (team_id) REFERENCES teams(id),
  FOREIGN KEY (inviter_user_id) REFERENCES users(id),
  FOREIGN KEY (invited_user_id) REFERENCES users(id)
);
