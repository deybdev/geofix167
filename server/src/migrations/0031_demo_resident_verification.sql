-- Local development fixture only. Never deploy real resident information as seed data.
-- Resident login requires an APPROVED resident_verifications row linked through
-- users.approved_verification_id, so the demo resident ships with one pre-approved.
INSERT INTO resident_verifications (
  verification_id, user_id, masterlist_id, barcode_value_hash, status, reviewed_at
)
SELECT 'verify_demo_resident_001', 'usr_demo_resident_001', 'ml_demo_resident_001',
       'demo-fixture', 'APPROVED', datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM resident_verifications WHERE user_id = 'usr_demo_resident_001'
);

UPDATE users
SET approved_verification_id = 'verify_demo_resident_001'
WHERE user_id = 'usr_demo_resident_001' AND approved_verification_id IS NULL;
