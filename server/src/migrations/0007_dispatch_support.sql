CREATE TABLE organizations (
  organization_id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('BARANGAY', 'BDRRMO', 'POLICE', 'FIRE', 'HOSPITAL', 'OTHER')),
  contact_number TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE organization_members (
  organization_member_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(organization_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  member_role TEXT,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  left_at TEXT,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE responder_resources (
  responder_resource_id TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(organization_id),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('TANOD', 'VEHICLE', 'EQUIPMENT')),
  display_name TEXT NOT NULL,
  availability_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (availability_status IN ('AVAILABLE', 'BUSY', 'UNAVAILABLE', 'OUT_OF_SERVICE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE assignment_statuses (
  assignment_status_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0, 1))
);

INSERT INTO assignment_statuses (assignment_status_id, code, display_name, is_terminal) VALUES
  (1, 'OFFERED', 'Offered', 0), (2, 'ACCEPTED', 'Accepted', 0),
  (3, 'DECLINED', 'Declined', 1), (4, 'EN_ROUTE', 'En Route', 0),
  (5, 'ON_SCENE', 'On Scene', 0), (6, 'COMPLETED', 'Completed', 1),
  (7, 'CANCELLED', 'Cancelled', 1);

CREATE TABLE tanod_assignments (
  tanod_assignment_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  tanod_user_id TEXT NOT NULL REFERENCES users(user_id),
  responder_resource_id TEXT REFERENCES responder_resources(responder_resource_id),
  assignment_status_id INTEGER NOT NULL REFERENCES assignment_statuses(assignment_status_id),
  assigned_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  completed_at TEXT,
  notes TEXT
);

CREATE TABLE tanod_assignment_events (
  tanod_assignment_event_id TEXT PRIMARY KEY,
  tanod_assignment_id TEXT NOT NULL REFERENCES tanod_assignments(tanod_assignment_id) ON DELETE CASCADE,
  assignment_status_id INTEGER NOT NULL REFERENCES assignment_statuses(assignment_status_id),
  changed_by_user_id TEXT REFERENCES users(user_id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE support_request_statuses (
  support_request_status_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_terminal INTEGER NOT NULL DEFAULT 0 CHECK (is_terminal IN (0, 1))
);

INSERT INTO support_request_statuses (support_request_status_id, code, display_name, is_terminal) VALUES
  (1, 'REQUESTED', 'Requested', 0), (2, 'ACCEPTED', 'Accepted', 0),
  (3, 'DECLINED', 'Declined', 1), (4, 'UNAVAILABLE', 'Unavailable', 1),
  (5, 'EN_ROUTE', 'En Route', 0), (6, 'ON_SCENE', 'On Scene', 0),
  (7, 'COMPLETED', 'Completed', 1), (8, 'CANCELLED', 'Cancelled', 1);

CREATE TABLE external_support_requests (
  external_support_request_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  requested_organization_id TEXT NOT NULL REFERENCES organizations(organization_id),
  support_request_status_id INTEGER NOT NULL REFERENCES support_request_statuses(support_request_status_id),
  requested_by_user_id TEXT NOT NULL REFERENCES users(user_id),
  accepted_by_user_id TEXT REFERENCES users(user_id),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  completed_at TEXT,
  request_reason TEXT,
  response_note TEXT
);

CREATE TABLE support_request_events (
  support_request_event_id TEXT PRIMARY KEY,
  external_support_request_id TEXT NOT NULL REFERENCES external_support_requests(external_support_request_id) ON DELETE CASCADE,
  support_request_status_id INTEGER NOT NULL REFERENCES support_request_statuses(support_request_status_id),
  changed_by_user_id TEXT REFERENCES users(user_id),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE responder_location_logs (
  responder_location_log_id TEXT PRIMARY KEY,
  incident_id TEXT REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(user_id),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_meters REAL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tanod_assignments_incident ON tanod_assignments(incident_id, assignment_status_id);
CREATE INDEX idx_support_requests_incident ON external_support_requests(incident_id, support_request_status_id);
CREATE INDEX idx_responder_locations_incident ON responder_location_logs(incident_id, recorded_at);
