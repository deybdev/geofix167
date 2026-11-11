CREATE TABLE hospitals_directory (
  hospital_id TEXT PRIMARY KEY,
  organization_id TEXT UNIQUE REFERENCES organizations(organization_id),
  name TEXT NOT NULL,
  contact_number TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hospital_capabilities (
  hospital_capability_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE hospital_capability_maps (
  hospital_id TEXT NOT NULL REFERENCES hospitals_directory(hospital_id) ON DELETE CASCADE,
  hospital_capability_id TEXT NOT NULL REFERENCES hospital_capabilities(hospital_capability_id) ON DELETE CASCADE,
  verified_at TEXT,
  verified_by_user_id TEXT REFERENCES users(user_id),
  PRIMARY KEY (hospital_id, hospital_capability_id)
);

CREATE TABLE incident_hospital_selections (
  incident_hospital_selection_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  hospital_id TEXT REFERENCES hospitals_directory(hospital_id),
  selected_by_user_id TEXT REFERENCES users(user_id),
  selection_source TEXT NOT NULL CHECK (selection_source IN ('SYSTEM_RECOMMENDATION', 'COMPANION', 'RESPONDER', 'MANUAL')),
  capability_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (capability_confirmed IN (0, 1)),
  selected_at TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT
);

CREATE INDEX idx_hospital_capability_maps_capability ON hospital_capability_maps(hospital_capability_id);
CREATE INDEX idx_incident_hospital_selections_incident ON incident_hospital_selections(incident_id, selected_at);
