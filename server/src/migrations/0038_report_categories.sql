ALTER TABLE incident_reports ADD COLUMN categories TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(categories) AND json_type(categories) = 'array');
UPDATE incident_reports SET categories = json_array(category) WHERE category IS NOT NULL;
