CREATE TABLE qr_statuses (
  qr_status_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0, 1))
);

INSERT INTO qr_statuses (qr_status_id, code, display_name, is_terminal) VALUES
  (1, 'DRAFT', 'Draft', 0), (2, 'PENDING_ACCEPTANCE', 'Pending Acceptance', 0),
  (3, 'ACCEPTED', 'Accepted', 1), (4, 'NEEDS_CORRECTION', 'Needs Correction', 0),
  (5, 'DECLINED', 'Declined', 1), (6, 'CANCELLED', 'Cancelled', 1), (7, 'EXPIRED', 'Expired', 1);

CREATE TABLE qr_handovers (
  qr_handover_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  qr_status_id INTEGER NOT NULL REFERENCES qr_statuses(qr_status_id),
  created_by_tanod_user_id TEXT NOT NULL REFERENCES users(user_id),
  receiving_organization_id TEXT REFERENCES organizations(organization_id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  receiving_officer_name TEXT,
  received_by_user_id TEXT REFERENCES users(user_id),
  receiving_remarks TEXT,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_qr_handovers_incident ON qr_handovers(incident_id, qr_status_id);
