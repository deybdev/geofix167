-- Preserve existing web flows and mobile token hashes/expiration times.
CREATE TABLE auth_flows_next (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('OAUTH', 'EMAIL', 'IDENTITY', 'MOBILE_EMAIL', 'MOBILE_OAUTH_TICKET', 'MOBILE_REGISTRATION_TICKET', 'MOBILE_IDENTITY')),
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

INSERT INTO auth_flows_next SELECT token_hash, kind, payload, expires_at, attempts FROM auth_flows;
INSERT INTO auth_flows_next (token_hash, kind, payload, expires_at)
SELECT ticket_hash, 'MOBILE_OAUTH_TICKET', json_object('user_id', user_id, 'code_challenge', code_challenge), expires_at FROM mobile_oauth_tickets;
INSERT INTO auth_flows_next (token_hash, kind, payload, expires_at)
SELECT ticket_hash, 'MOBILE_REGISTRATION_TICKET', json_object('identity', json(identity_payload), 'code_challenge', code_challenge), expires_at FROM mobile_registration_tickets;
INSERT INTO auth_flows_next (token_hash, kind, payload, expires_at)
SELECT token_hash, 'MOBILE_IDENTITY', identity_payload, expires_at FROM mobile_registration_identities;

-- These tables are retained snapshots, not a live rollback mechanism.
ALTER TABLE mobile_oauth_tickets RENAME TO mobile_oauth_tickets_old;
ALTER TABLE mobile_registration_tickets RENAME TO mobile_registration_tickets_old;
ALTER TABLE mobile_registration_identities RENAME TO mobile_registration_identities_old;
-- auth_flows records were copied above; users and sessions are unchanged.
DROP TABLE auth_flows;
ALTER TABLE auth_flows_next RENAME TO auth_flows;
CREATE INDEX idx_auth_flows_expiry ON auth_flows(expires_at);
