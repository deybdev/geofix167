CREATE TABLE community_feed_posts (
  community_feed_post_id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incident_reports(incident_id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  published_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE barangay_announcements (
  announcement_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  published_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE announcement_revisions (
  announcement_revision_id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL REFERENCES barangay_announcements(announcement_id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  revised_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (announcement_id, revision_number)
);

CREATE TABLE audit_logs (
  audit_log_id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  incident_id TEXT REFERENCES incident_reports(incident_id) ON DELETE SET NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_community_feed_posts_published ON community_feed_posts(published_at);
CREATE INDEX idx_barangay_announcements_status ON barangay_announcements(status, published_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_logs_incident ON audit_logs(incident_id, created_at);
