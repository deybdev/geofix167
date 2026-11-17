-- Normalize retired maintenance labels while preserving each report's saved priority.
UPDATE incident_reports
SET category = CASE
  WHEN category = 'Road Damage' THEN 'Road Damage / Pothole'
  WHEN category = 'Electrical' THEN 'Electrical / Power Hazard'
  WHEN category = 'Water / Power Hazard'
    AND (lower(coalesce(description_original, '')) LIKE '%power%'
      OR lower(coalesce(description_original, '')) LIKE '%electric%') THEN 'Electrical / Power Hazard'
  WHEN category = 'Water / Power Hazard' THEN 'Water Hazard / Leak'
  WHEN category IN ('Sanitation', 'Garbage Collection') THEN 'Sanitation / Garbage Collection'
  ELSE category
END
WHERE category IN ('Road Damage', 'Electrical', 'Water / Power Hazard', 'Sanitation', 'Garbage Collection');
