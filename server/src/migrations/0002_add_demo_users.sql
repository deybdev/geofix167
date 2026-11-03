INSERT OR IGNORE INTO users (
    public_id,
    full_name,
    mobile_number,
    password,
    role,
    is_verified
)
VALUES
(
    'usr_demo_admin_001',
    'Admin',
    '09170000001',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.',
    'admin',
    1
),
(
    'usr_demo_resident_001',
    'Resident',
    '09170000002',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.',
    'resident',
    1
),
(
    'usr_demo_responder_001',
    'Responder',
    '09170000003',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.',
    'responder',
    1
);

UPDATE users
SET
    mobile_number = CASE id
        WHEN 4 THEN '09123123123'
        WHEN 5 THEN '09246246246'
        WHEN 6 THEN '09369369369'
    END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id IN (4, 5, 6);