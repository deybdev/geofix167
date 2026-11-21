CREATE TABLE responder_dispatches (
  responder_dispatch_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  incident_title TEXT NOT NULL,
  incident_category TEXT NOT NULL,
  incident_location TEXT,
  dispatched_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  target_role TEXT NOT NULL CHECK (target_role IN ('bdrrmo', 'police', 'fire')),
  urgency TEXT NOT NULL CHECK (urgency IN ('Critical', 'High', 'Medium', 'Low')),
  vehicle_name TEXT,
  status TEXT NOT NULL DEFAULT 'DISPATCHED',
  dispatched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_responder_dispatches_role
  ON responder_dispatches(target_role, dispatched_at);
