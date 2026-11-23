CREATE TABLE responder_messages (
  responder_message_id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('bdrrmo', 'police', 'fire')),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_responder_messages_channel
  ON responder_messages(recipient_role, sent_at);
