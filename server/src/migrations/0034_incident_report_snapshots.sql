CREATE TABLE incident_report_snapshots (
  incident_id TEXT PRIMARY KEY REFERENCES incident_reports(incident_id),
  generated_at TEXT NOT NULL,
  generated_by_user_id TEXT REFERENCES users(user_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json))
);

CREATE TRIGGER incident_report_snapshots_no_update
BEFORE UPDATE ON incident_report_snapshots
BEGIN
  SELECT RAISE(ABORT, 'Incident report snapshots are immutable');
END;

CREATE TRIGGER incident_report_snapshots_no_delete
BEFORE DELETE ON incident_report_snapshots
BEGIN
  SELECT RAISE(ABORT, 'Incident report snapshots are immutable');
END;
