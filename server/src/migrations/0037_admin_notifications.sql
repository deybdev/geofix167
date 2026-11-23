CREATE TABLE notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('admin','responder','resident','bdrrmo')),
  recipient_user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  report_id TEXT,
  assignment_id TEXT,
  link_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  read_at TEXT,
  dedupe_key TEXT UNIQUE
);
CREATE INDEX idx_notifications_inbox ON notifications(recipient_role, recipient_user_id, read_at, created_at);

-- Hospital acceptance may be written by the receiver outside this Worker.
CREATE TRIGGER notify_hospital_acknowledgment AFTER UPDATE OF qr_status_id, accepted_at ON qr_handovers
WHEN NEW.qr_status_id = 3 AND (OLD.qr_status_id != 3 OR OLD.accepted_at IS NULL)
  AND (json_extract(CASE WHEN json_valid(NEW.receiving_remarks) THEN NEW.receiving_remarks END, '$.hospital_name') IS NOT NULL
    OR EXISTS (SELECT 1 FROM organizations o WHERE o.organization_id = NEW.receiving_organization_id AND o.organization_type = 'HOSPITAL'))
BEGIN
  INSERT INTO notifications (recipient_role, recipient_user_id, type, title, body, report_id, link_path, dedupe_key)
  SELECT 'admin', u.user_id, 'hospital_acknowledged', 'Hospital acknowledged handover',
    'The receiving hospital acknowledged the handover.', NEW.incident_id,
    '/admin/incident-reports?queue=dispatch-tracking', 'hospital_acknowledged:' || NEW.qr_handover_id || ':' || u.user_id
  FROM users u JOIN roles r ON r.role_id = u.role_id
  WHERE r.code = 'admin' AND u.user_id IS NOT NEW.received_by_user_id
  ON CONFLICT(dedupe_key) DO NOTHING;
END;
