CREATE TABLE announcement_media (
  media_id TEXT PRIMARY KEY,
  announcement_id TEXT NOT NULL REFERENCES announcements(id),
  storage_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('PHOTO', 'VIDEO')),
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  original_filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_announcement_media_announcement
  ON announcement_media(announcement_id, created_at, media_id);
