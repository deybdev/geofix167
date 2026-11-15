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
    'Louise Moreno',
    'usr_demo_admin_001',
    '09123123123',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.',
    'admin',
    1
),
(
    'usr_demo_resident_001',
    'Neo Herminigildo',
    '09246246246',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oex
    1k8LiDdRuEbYB5JR4RohAYLl5Kg.',
    'resident',
),
(
    'usr_demo_responder_001',
    'Renus Manipon',
    '09369369369',
    '$2b$12$JR1vp6bRLpq3RWPYfEbXoO8oexk8LiDdRuEbYB5JR4RohAYLl5Kg.',
    'responder',
    1
);
