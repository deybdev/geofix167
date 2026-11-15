ALTER TABLE incident_reports ADD COLUMN accuracy_meters REAL
  CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0);
ALTER TABLE incident_reports ADD COLUMN within_barangay_boundary INTEGER
  CHECK (within_barangay_boundary IS NULL OR within_barangay_boundary IN (0, 1));
ALTER TABLE incident_reports ADD COLUMN assigned_team TEXT;

UPDATE incident_reports
SET assigned_team = CASE WHEN is_emergency = 1 THEN 'BDRRMO Response' ELSE 'Maintenance Team A' END
WHERE assigned_team IS NULL;

CREATE TABLE incident_report_references (
  reference_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL UNIQUE REFERENCES incident_reports(incident_id) ON DELETE CASCADE
);

INSERT INTO incident_report_references (reference_sequence, incident_id)
SELECT ROW_NUMBER() OVER (ORDER BY submitted_at, incident_id) + 7, incident_id
FROM incident_reports;

CREATE INDEX idx_incident_report_references_incident
  ON incident_report_references(incident_id);

-- GF-001 through GF-007 are the existing admin demonstration rows.
-- Start real report references after those fixture IDs to avoid masking them.
UPDATE sqlite_sequence
SET seq = MAX(seq, 7)
WHERE name = 'incident_report_references';
INSERT INTO sqlite_sequence (name, seq)
SELECT 'incident_report_references', 7
WHERE NOT EXISTS (
  SELECT 1 FROM sqlite_sequence WHERE name = 'incident_report_references'
);
