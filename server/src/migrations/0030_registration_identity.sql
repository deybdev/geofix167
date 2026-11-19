ALTER TABLE users ADD COLUMN google_subject TEXT;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
CREATE UNIQUE INDEX idx_users_google_subject ON users(google_subject) WHERE google_subject IS NOT NULL;
ALTER TABLE resident_verifications ADD COLUMN review_operation_id TEXT;

CREATE TABLE auth_flows (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('OAUTH', 'EMAIL', 'IDENTITY')),
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_auth_flows_expiry ON auth_flows(expires_at);

CREATE TABLE registration_requests (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id),
  verification_id TEXT NOT NULL UNIQUE REFERENCES resident_verifications(verification_id),
  date_of_birth TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  document_key TEXT,
  document_type TEXT,
  document_size INTEGER,
  document_uploaded_at TEXT
);

CREATE TABLE auth_notifications (
  notification_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);
