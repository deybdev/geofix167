CREATE TABLE mobile_oauth_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mobile_oauth_tickets_expiry
  ON mobile_oauth_tickets(expires_at);
