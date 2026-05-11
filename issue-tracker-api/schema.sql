--------------------------------- EXAMPLES ---------------------------------
-- users table
-- CREATE TABLE users (
--   id INTEGER PRIMARY KEY,
--   username TEXT NOT NULL
-- );

-- teams table
-- CREATE TABLE teams (
--   id INTEGER PRIMARY KEY,
--   team_name TEXT NOT NULL
-- );
----------------------------------------------------------------------------

--------------------------------- INVITES TABLE ---------------------------------
CREATE TABLE invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    team_id INTEGER NOT NULL, 
    inviter_user_id INTEGER NOT NULL,
    invited_user_id INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'declined')),
    
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);