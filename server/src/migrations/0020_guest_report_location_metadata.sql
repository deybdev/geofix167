ALTER TABLE incident_reports ADD COLUMN pin_manually_adjusted INTEGER NOT NULL DEFAULT 0
  CHECK (pin_manually_adjusted IN (0, 1));

ALTER TABLE incident_reports ADD COLUMN address_geocoded_at TEXT;
