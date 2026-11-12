-- Authentication and user-verification extensions.
-- Preserve the session data created by 0003 while giving the table its domain name.
ALTER TABLE sessions RENAME TO user_sessions_and_devices;
ALTER TABLE user_sessions_and_devices ADD COLUMN device_id TEXT;
ALTER TABLE user_sessions_and_devices ADD COLUMN device_name TEXT;
ALTER TABLE user_sessions_and_devices ADD COLUMN user_agent TEXT;
ALTER TABLE user_sessions_and_devices ADD COLUMN last_seen_at TEXT;
ALTER TABLE user_sessions_and_devices ADD COLUMN revoked_at TEXT;

CREATE TABLE barangay_masterlist (
  masterlist_id TEXT PRIMARY KEY,
  barangay_identifier TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  mobile_number TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE resident_verifications (
  verification_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  masterlist_id TEXT REFERENCES barangay_masterlist(masterlist_id),
  barcode_value_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION')),
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by_user_id TEXT REFERENCES users(user_id),
  reviewed_at TEXT,
  review_reason TEXT
);

CREATE TABLE otp_challenges (
  otp_challenge_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  mobile_number TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('REGISTRATION', 'PASSWORD_RESET', 'MOBILE_CHANGE', 'MFA')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  verified_at TEXT,
  invalidated_at TEXT
);

CREATE TABLE staff_mfa_credentials (
  staff_mfa_credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('TOTP', 'SMS')),
  secret_encrypted TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  disabled_at TEXT
);

CREATE INDEX idx_sessions_devices_user ON user_sessions_and_devices(user_id);
CREATE INDEX idx_resident_verifications_user ON resident_verifications(user_id, status);
CREATE INDEX idx_otp_challenges_mobile ON otp_challenges(mobile_number, purpose, expires_at);
