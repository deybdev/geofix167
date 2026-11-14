-- Local development fixture only. Never deploy real resident information as seed data.
INSERT OR IGNORE INTO barangay_masterlist (
  masterlist_id, barangay_identifier, first_name, last_name, date_of_birth,
  mobile_number, address, card_valid_until, is_active, source_reference
) VALUES (
  'ml_demo_resident_002', 'DEMO-167-0002', 'Test', 'Applicant', '1998-05-20',
  '09999999998', 'Second demo address, Barangay 167', '2030-12-31', 1, 'local-fixture'
);
