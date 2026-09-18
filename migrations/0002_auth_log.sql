-- Sign-in log: an append-only audit of every unlock attempt (success and
-- failure), plus "log out all devices". Kept bounded to the most recent 500 rows
-- by the Worker. See docs/specs.md §7.

CREATE TABLE auth_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,  -- also the chronological order
  at         INTEGER NOT NULL,          -- ms epoch
  kind       TEXT NOT NULL,             -- 'setup' | 'unlock' | 'logout-all'
  ok         INTEGER NOT NULL,          -- 1 success, 0 failure
  user_agent TEXT,                      -- raw UA string, parsed for display client-side
  ip         TEXT                       -- CF-Connecting-IP when present
);
