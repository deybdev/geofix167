-- Admin dispatch support reuses responder_resources, tanod_assignments,
-- external_support_requests, and the existing incident status event history.
ALTER TABLE responder_resources
  ADD COLUMN responder_user_id TEXT REFERENCES users(user_id);

CREATE UNIQUE INDEX idx_responder_resources_user
  ON responder_resources(responder_user_id)
  WHERE responder_user_id IS NOT NULL;

INSERT OR IGNORE INTO incident_statuses
  (incident_status_id, code, display_name, is_terminal)
VALUES
  (13, 'DISPATCHED', 'Dispatched', 0),
  (14, 'AWAITING_DRRMO_SUPPORT', 'Awaiting DRRMO Support', 0);

INSERT OR IGNORE INTO organizations
  (organization_id, code, name, organization_type, is_active)
VALUES
  ('org_brgy167_drrmo', 'BRGY167_DRRMO', 'Barangay 167 BDRRMO', 'BDRRMO', 1),
  ('org_caloocan_city_drrmo', 'CALOOCAN_CITY_DRRMO', 'Caloocan City DRRMO', 'BDRRMO', 1);

-- Local demo responders use the README demo password. The primary demo responder
-- already exists from earlier migrations; add two units so exhaustion is demoable.
INSERT OR IGNORE INTO users (
  user_id, role_id, account_status_id, first_name, last_name, mobile_number, password_hash
)
VALUES
  ('usr_demo_responder_002', 3, 1, 'Maya', 'Santos', '09369369370', '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.'),
  ('usr_demo_responder_003', 3, 1, 'Carlo', 'Reyes', '09369369371', '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.');

INSERT OR IGNORE INTO organization_members
  (organization_member_id, organization_id, user_id, member_role)
SELECT 'orgmem_' || user_id, 'org_brgy167_drrmo', user_id, 'RESPONDER'
FROM users
WHERE user_id IN ('usr_demo_responder_001', 'usr_demo_responder_002', 'usr_demo_responder_003');

INSERT OR IGNORE INTO responder_resources
  (responder_resource_id, organization_id, resource_type, display_name, availability_status, responder_user_id)
SELECT 'unit_' || user_id, 'org_brgy167_drrmo', 'TANOD',
       trim(first_name || ' ' || last_name), 'AVAILABLE', user_id
FROM users
WHERE user_id IN ('usr_demo_responder_001', 'usr_demo_responder_002', 'usr_demo_responder_003');
