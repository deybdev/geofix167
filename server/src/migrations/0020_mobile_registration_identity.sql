CREATE TABLE mobile_registration_tickets (
  ticket_hash TEXT PRIMARY KEY,
  identity_payload TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE mobile_registration_identities (
  token_hash TEXT PRIMARY KEY,
  identity_payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_mobile_registration_tickets_expiry ON mobile_registration_tickets(expires_at);
CREATE INDEX idx_mobile_registration_identities_expiry ON mobile_registration_identities(expires_at);
