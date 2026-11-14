-- Media bytes remain in R2. Keep the existing incident_media table.
ALTER TABLE incident_media ADD COLUMN original_filename TEXT;
ALTER TABLE incident_media ADD COLUMN upload_key TEXT;
ALTER TABLE incident_media ADD COLUMN content_sha256 TEXT;
ALTER TABLE incident_media ADD COLUMN media_url TEXT;

CREATE UNIQUE INDEX idx_incident_media_upload_key
  ON incident_media(incident_id, upload_key);
