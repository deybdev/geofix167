-- Seed mobile responder accounts for police and fire protection.
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
VALUES
  (
    'usr_police_efren_dave_cahilig',
    5,
    1,
    'Efren Dave',
    'Cahilig',
    '09171258364',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.'
  ),
  (
    'usr_fire_john_kyle_paroni',
    6,
    1,
    'John Kyle',
    'Paroni',
    '09284571603',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.'
  );
