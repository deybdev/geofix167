-- Normalize existing guest pathway urgency to the shared intake mapping.
-- P2 is displayed as High and P3 as Medium by the admin reporting tools.
UPDATE incident_reports
SET priority_code = CASE
  WHEN is_emergency = 1 THEN 'P2'
  WHEN category IN ('Road Damage / Pothole', 'Water / Power Hazard', 'Streetlight', 'Electrical') THEN 'P2'
  ELSE 'P3'
END
WHERE guest_session_id IS NOT NULL;
