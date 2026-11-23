CREATE TABLE tracking_links (
  tracking_link_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL UNIQUE REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_viewed_at TEXT
);

CREATE INDEX idx_tracking_links_expiry ON tracking_links(expires_at);

CREATE TABLE responder_locations (
  assignment_id TEXT PRIMARY KEY,
  responder_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  lat REAL NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lng REAL NOT NULL CHECK (lng >= -180 AND lng <= 180),
  accuracy REAL CHECK (accuracy IS NULL OR accuracy >= 0),
  heading REAL CHECK (heading IS NULL OR (heading >= 0 AND heading < 360)),
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_responder_locations_updated ON responder_locations(updated_at);
