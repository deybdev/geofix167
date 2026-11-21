CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  details TEXT NOT NULL CHECK (length(trim(details)) BETWEEN 1 AND 10000),
  category TEXT NOT NULL CHECK (category IN ('Clean & Green', 'BDRRMO Advisory', 'Event', 'Health', 'General')),
  event_date TEXT,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_announcements_public_feed
  ON announcements(status, published_at DESC);
CREATE INDEX idx_announcements_category
  ON announcements(category, status, published_at DESC);
