-- Restore the README demo credential for seeded demo accounts.
UPDATE users
SET password_hash = '$2b$12$OaVaaFFZi3qDnqV8m5GqbOGanK9z9g4agS6qHHsdNfXFXU6AEVY66',
    updated_at = datetime('now')
WHERE user_id LIKE 'usr_demo_%';
