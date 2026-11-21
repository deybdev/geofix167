ALTER TABLE barangay_masterlist ADD COLUMN date_of_birth TEXT;
ALTER TABLE barangay_masterlist ADD COLUMN card_valid_until TEXT;
ALTER TABLE barangay_masterlist ADD COLUMN source_reference TEXT;

CREATE TABLE auth_rate_limits (
  rate_limit_key TEXT NOT NULL,
  action TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT,
  PRIMARY KEY (rate_limit_key, action)
);

CREATE TABLE auth_audit_events (
  auth_audit_event_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  request_ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Local development fixture only. It contains no real resident information.
INSERT OR IGNORE INTO barangay_masterlist (
  masterlist_id, barangay_identifier, first_name, last_name, date_of_birth,
  mobile_number, address, card_valid_until, is_active, source_reference
) VALUES (
  'ml_demo_resident_001', 'DEMO-167-0001', 'Demo', 'Resident', '2000-01-01',
  '09999999999', 'Demo address, Barangay 167', '2030-12-31', 1, 'local-fixture'
);
