CREATE TABLE false_report_actions_and_appeals (
  false_report_action_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  subject_user_id TEXT REFERENCES users(user_id),
  subject_guest_session_id TEXT REFERENCES guest_sessions(guest_session_id),
  action_type TEXT NOT NULL CHECK (action_type IN ('WARNING', 'RESTRICTION', 'APPEAL', 'APPEAL_DECISION')),
  decision TEXT,
  reason TEXT NOT NULL,
  decided_by_user_id TEXT REFERENCES users(user_id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  CHECK (subject_user_id IS NOT NULL OR subject_guest_session_id IS NOT NULL)
);

CREATE TABLE privacy_notices_and_consents (
  privacy_consent_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  guest_session_id TEXT REFERENCES guest_sessions(guest_session_id) ON DELETE SET NULL,
  notice_version TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  withdrawn_at TEXT,
  CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
);

CREATE TABLE privacy_rights_requests (
  privacy_rights_request_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  guest_session_id TEXT REFERENCES guest_sessions(guest_session_id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('ACCESS', 'CORRECTION', 'ERASURE', 'EXPORT', 'OBJECTION')),
  status TEXT NOT NULL CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'COMPLETED', 'REJECTED')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by_user_id TEXT REFERENCES users(user_id),
  notes TEXT,
  CHECK (user_id IS NOT NULL OR guest_session_id IS NOT NULL)
);

CREATE TABLE continuity_and_backup_logs (
  continuity_backup_log_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('BACKUP', 'RESTORE_TEST', 'DISASTER_RECOVERY_TEST')),
  status TEXT NOT NULL CHECK (status IN ('STARTED', 'SUCCEEDED', 'FAILED')),
  storage_reference TEXT,
  performed_by_user_id TEXT REFERENCES users(user_id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  detail TEXT
);

CREATE TABLE security_incidents (
  security_incident_id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CONTAINED', 'RESOLVED')),
  summary TEXT NOT NULL,
  reported_by_user_id TEXT REFERENCES users(user_id),
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolution_note TEXT
);

CREATE INDEX idx_false_report_actions_incident ON false_report_actions_and_appeals(incident_id, created_at);
CREATE INDEX idx_privacy_rights_requests_status ON privacy_rights_requests(status, requested_at);
