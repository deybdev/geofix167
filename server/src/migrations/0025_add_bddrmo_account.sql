-- Seed the BDRRMO account used by the mobile responder workflow.
-- The password hash is the existing development hash for "password".
INSERT OR IGNORE INTO users (
  user_id,
  role_id,
  account_status_id,
  first_name,
  last_name,
  mobile_number,
  password_hash
)
VALUES (
  'usr_bddrmo_marvin_navarette',
  4,
  1,
  'Marvin',
  'Navarette',
  '09947833417',
  '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.'
);

INSERT OR IGNORE INTO organization_members (
  organization_member_id,
  organization_id,
  user_id,
  member_role
)
VALUES (
  'orgmem_usr_bddrmo_marvin_navarette',
  'org_brgy167_drrmo',
  'usr_bddrmo_marvin_navarette',
  'DISPATCHER'
);
