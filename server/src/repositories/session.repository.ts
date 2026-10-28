
import type { AppEnv, AuthUser } from "../types/env";

type Database = AppEnv["Bindings"]["geofix167_db"];

export async function createSession(
  db: Database,
  userId: number,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
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
      `SELECT u.id, u.public_id, u.full_name, u.email, u.role
       FROM sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?
         AND s.expires_at > ?
         AND u.is_verified = 1
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
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}
