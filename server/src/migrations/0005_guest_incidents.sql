CREATE TABLE guest_sessions (
  guest_session_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  access_token_hash TEXT NOT NULL UNIQUE,
  recovery_code_hash TEXT UNIQUE,
  contact_mobile_number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_accessed_at TEXT,
  expires_at TEXT,
  ended_at TEXT
);

CREATE TABLE incident_statuses (
  incident_status_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0, 1))
);

INSERT INTO incident_statuses (incident_status_id, code, display_name, is_terminal) VALUES
  (1, 'SUBMITTED', 'Submitted', 0),
  (2, 'UNDER_REVIEW', 'Under Front Desk Review', 0),
  (3, 'NEEDS_CLARIFICATION', 'Needs Clarification', 0),
  (4, 'VERIFIED', 'Verified', 0),
  (5, 'FORWARDED_TO_BDRRMO', 'Forwarded to BDRRMO', 0),
  (6, 'ASSIGNED', 'Assigned', 0),
  (7, 'EN_ROUTE', 'En Route', 0),
  (8, 'ON_SCENE', 'On Scene', 0),
  (9, 'FOR_CLOSURE_REVIEW', 'For Closure Review', 0),
  (10, 'CLOSED', 'Closed', 1),
  (11, 'REJECTED', 'Rejected', 1),
  (12, 'LINKED_DUPLICATE', 'Linked Duplicate', 1);

CREATE TABLE incident_reports (
  incident_id TEXT PRIMARY KEY,
  reported_by_user_id TEXT REFERENCES users(user_id),
  guest_session_id TEXT REFERENCES guest_sessions(guest_session_id),
  incident_status_id INTEGER NOT NULL REFERENCES incident_statuses(incident_status_id),
  category TEXT,
  priority_code TEXT CHECK (priority_code IN ('P1', 'P2', 'P3', 'P4')),
  is_emergency INTEGER NOT NULL DEFAULT 0 CHECK (is_emergency IN (0, 1)),
  title TEXT NOT NULL,
  description_original TEXT NOT NULL,
  description_sanitized TEXT,
  callback_mobile_number TEXT,
  latitude REAL,
  longitude REAL,
  location_description TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  closed_by_user_id TEXT REFERENCES users(user_id),
  parent_incident_id TEXT REFERENCES incident_reports(incident_id),
  CHECK (
    (reported_by_user_id IS NOT NULL AND guest_session_id IS NULL)
    OR (reported_by_user_id IS NULL AND guest_session_id IS NOT NULL)
  )
);

CREATE TABLE incident_status_events (
  incident_status_event_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  from_incident_status_id INTEGER REFERENCES incident_statuses(incident_status_id),
  to_incident_status_id INTEGER NOT NULL REFERENCES incident_statuses(incident_status_id),
  changed_by_user_id TEXT REFERENCES users(user_id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE incident_media (
  incident_media_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  uploaded_by_user_id TEXT REFERENCES users(user_id),
  uploaded_by_guest_session_id TEXT REFERENCES guest_sessions(guest_session_id),
  media_type TEXT NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT')),
  storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  captured_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    uploaded_by_user_id IS NOT NULL OR uploaded_by_guest_session_id IS NOT NULL
  )
);

CREATE INDEX idx_incident_reports_status_priority ON incident_reports(incident_status_id, priority_code, submitted_at);
CREATE INDEX idx_incident_reports_reporter ON incident_reports(reported_by_user_id, submitted_at);
CREATE INDEX idx_incident_status_events_incident ON incident_status_events(incident_id, created_at);
CREATE INDEX idx_incident_media_incident ON incident_media(incident_id);
