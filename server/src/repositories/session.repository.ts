
import type { AppEnv, AuthUser } from "../types/env";

type Database = AppEnv["Bindings"]["geofix167_db"];

export async function createSession(
  db: Database,
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .prepare(
       `INSERT INTO user_sessions_and_devices (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
    )
    .bind(userId, tokenHash, expiresAt.toISOString())
    .run();
}

export async function findUserBySession(
  db: Database,
  tokenHash: string,
): Promise<AuthUser | null> {
  return db
    .prepare(
       `SELECT
          u.user_id AS id,
          trim(u.first_name || ' ' || u.last_name) AS full_name,
          u.mobile_number,
          r.code AS role
        FROM user_sessions_and_devices AS s
        INNER JOIN users AS u ON u.user_id = s.user_id
        INNER JOIN roles AS r ON r.role_id = u.role_id
        INNER JOIN account_statuses AS account_status
          ON account_status.status_id = u.account_status_id
        WHERE s.token_hash = ?
          AND s.expires_at > ?
          AND account_status.status_code = 'ACTIVE'
        LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<AuthUser>();
}

export async function deleteSession(
  db: Database,
  tokenHash: string,
): Promise<void> {
  await db
     .prepare("DELETE FROM user_sessions_and_devices WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}
