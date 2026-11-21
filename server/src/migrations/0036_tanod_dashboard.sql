-- Normalize any accounts and organization memberships left with the legacy
-- responder label so Tanod accounts consistently use the Tanod dashboard role.
UPDATE users
SET role_id = (SELECT role_id FROM roles WHERE code = 'tanod')
WHERE role_id = (SELECT role_id FROM roles WHERE code = 'responder')
  AND EXISTS (SELECT 1 FROM roles WHERE code = 'tanod');

UPDATE organization_members
SET member_role = 'TANOD'
WHERE upper(member_role) = 'RESPONDER'
  AND user_id IN (
    SELECT user_id FROM users
    WHERE role_id = (SELECT role_id FROM roles WHERE code = 'tanod')
  );
