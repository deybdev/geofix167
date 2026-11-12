PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- Preserve the existing tables before replacing them.
ALTER TABLE users RENAME TO users_legacy;
ALTER TABLE sessions RENAME TO sessions_legacy;

CREATE TABLE roles (
  role_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 2 AND 40),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  description TEXT CHECK (description IS NULL OR length(description) <= 500)
);

INSERT INTO roles (role_id, code, display_name)
VALUES
  (1, 'admin', 'Administrator'),
  (2, 'resident', 'Resident'),
  (3, 'tanod', 'Tanod'),
  (4, 'bdrrmo', 'BDRRMO'),
  (5, 'police', 'Police'),
  (6, 'fire', 'Fire');

CREATE TABLE account_statuses (
  status_id INTEGER PRIMARY KEY,
  status_code TEXT NOT NULL UNIQUE CHECK (length(status_code) BETWEEN 2 AND 40),
  status_label TEXT NOT NULL CHECK (length(status_label) BETWEEN 1 AND 80),
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0,1))
);

INSERT INTO account_statuses (status_id, status_code, status_label, is_terminal)
VALUES
  (1, 'ACTIVE', 'Active', 0),
  (2, 'UNVERIFIED', 'Unverified', 0),
  (3, 'DEACTIVATED', 'Deactivated', 1);

CREATE TABLE users (
  user_id TEXT PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 64),
  role_id INTEGER NOT NULL REFERENCES roles(role_id),
  account_status_id INTEGER NOT NULL REFERENCES account_statuses(status_id),
  masterlist_id TEXT,
  approved_verification_id TEXT,
  first_name TEXT NOT NULL CHECK (length(first_name) BETWEEN 1 AND 80),
  middle_name TEXT NULL CHECK (middle_name IS NULL OR length(middle_name) <= 80),
  last_name TEXT NOT NULL CHECK (length(last_name) BETWEEN 1 AND 80),
  suffix TEXT NULL CHECK (suffix IS NULL OR length(suffix) <= 20),
  mobile_number TEXT UNIQUE NOT NULL CHECK (length(mobile_number) BETWEEN 7 AND 20),
  email TEXT UNIQUE NULL CHECK (email IS NULL OR length(email) BETWEEN 5 AND 254),
  password_hash TEXT NOT NULL CHECK (length(password_hash) BETWEEN 40 AND 255),
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (length(preferred_language) BETWEEN 2 AND 10),
  accessibility_high_contrast INTEGER NOT NULL DEFAULT 0 CHECK (accessibility_high_contrast IN (0,1)),
  mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mfa_enabled IN (0,1)),
  mfa_method TEXT NULL CHECK (mfa_method IS NULL OR length(mfa_method) <= 30),
  last_otp_verified_at TEXT NULL,
  next_reverify_due_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deactivated_at TEXT NULL
);

-- The three legacy demo users are normalized to their approved test names.
-- Other legacy full names are split without losing the original value:
-- the first word becomes first_name and the remaining words become last_name.
-- A one-word legacy name receives the explicit last-name fallback "Unknown"
-- because the new schema requires both a first and last name.
INSERT INTO users (
  user_id, role_id, account_status_id, first_name, middle_name, last_name,
  mobile_number, password_hash, created_at, updated_at
)
SELECT
  public_id,
  CASE lower(role)
    WHEN 'admin' THEN 1
    WHEN 'responder' THEN 3
    WHEN 'tanod' THEN 3
    WHEN 'bdrrmo' THEN 4
    WHEN 'police' THEN 5
    WHEN 'fire' THEN 6
    ELSE 2
  END,
  CASE WHEN is_verified = 1 THEN 1 ELSE 2 END,
  CASE public_id
    WHEN 'usr_demo_admin_001' THEN 'Louise'
    WHEN 'usr_demo_resident_001' THEN 'Neo'
    WHEN 'usr_demo_responder_001' THEN 'Renus'
    ELSE trim(substr(full_name, 1, instr(trim(full_name) || ' ', ' ') - 1))
  END,
  NULL,
  CASE public_id
    WHEN 'usr_demo_admin_001' THEN 'Moreno'
    WHEN 'usr_demo_resident_001' THEN 'Herminigildo'
    WHEN 'usr_demo_responder_001' THEN 'Manipon'
    WHEN instr(trim(full_name), ' ') > 0
      THEN trim(substr(trim(full_name), instr(trim(full_name) || ' ', ' ') + 1))
    ELSE 'Unknown'
  END,
  mobile_number,
  password,
  created_at,
  updated_at
FROM users_legacy;

-- Additional migration test accounts. All use the existing demo password hash
-- for the password "password". Replace or remove these before production use.
INSERT INTO users (
  user_id, role_id, account_status_id, first_name, last_name,
  mobile_number, password_hash
)
VALUES
  (
    'usr_demo_bdrrmo_001', 4, 1, 'Ramon', 'Villanueva',
    '09412345671', '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.'
  ),
  (
    'usr_demo_police_001', 5, 1, 'Carlo', 'Mendoza',
    '09412345672', '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.'
  ),
  (
    'usr_demo_fire_001', 6, 1, 'Angela', 'Cruz',
    '09412345673', '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.'
  );

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) BETWEEN 40 AND 255),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
SELECT
  s.id,
  u.public_id,
  s.token_hash,
  s.expires_at,
  s.created_at
FROM sessions_legacy AS s
JOIN users_legacy AS u ON u.id = s.user_id;

CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_status ON users(account_status_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);

COMMIT;

PRAGMA foreign_keys = ON;
