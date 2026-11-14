CREATE TABLE incident_chat_threads (
  incident_chat_thread_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('INCIDENT_GROUP', 'DIRECT_SUPPORT')),
  created_by_user_id TEXT REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE TABLE incident_chat_messages (
  incident_chat_message_id TEXT PRIMARY KEY,
  incident_chat_thread_id TEXT NOT NULL REFERENCES incident_chat_threads(incident_chat_thread_id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(user_id),
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_incident_chat_threads_incident ON incident_chat_threads(incident_id, archived_at);
CREATE INDEX idx_incident_chat_messages_thread ON incident_chat_messages(incident_chat_thread_id, sent_at);
