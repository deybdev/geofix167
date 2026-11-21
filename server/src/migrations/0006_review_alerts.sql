CREATE TABLE language_flags (
  language_flag_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  detected_term_hash TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONFIRMED', 'DISMISSED')),
  reviewed_by_user_id TEXT REFERENCES users(user_id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE incident_reviews_and_escalations (
  incident_review_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  review_type TEXT NOT NULL CHECK (review_type IN ('FRONT_DESK_REVIEW', 'BDRRMO_ESCALATION', 'CLARIFICATION', 'REJECTION', 'CLOSURE_REVIEW')),
  decision TEXT CHECK (decision IN ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'NEEDS_CLARIFICATION')),
  assigned_to_user_id TEXT REFERENCES users(user_id),
  decided_by_user_id TEXT REFERENCES users(user_id),
  reason TEXT,
  due_at TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE alert_deliveries (
  alert_delivery_id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  recipient_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  recipient_guest_session_id TEXT REFERENCES guest_sessions(guest_session_id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'SMS', 'EMAIL', 'PUSH')),
  template_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED')),
  provider_reference TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  CHECK (recipient_user_id IS NOT NULL OR recipient_guest_session_id IS NOT NULL)
);

CREATE INDEX idx_language_flags_incident ON language_flags(incident_id, status);
CREATE INDEX idx_incident_reviews_incident ON incident_reviews_and_escalations(incident_id, created_at);
CREATE INDEX idx_alert_deliveries_recipient ON alert_deliveries(recipient_user_id, status, created_at);
