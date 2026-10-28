
import type { AppEnv } from "../types/env";

export type UserRecord = {
  id: number;
  public_id: string;
  full_name: string;
  email: string;
  password: string;
  role: "admin" | "responder" | "resident";
  is_verified: number;
};

export async function findUserByEmail(
  db: AppEnv["Bindings"]["geofix167_db"],
  email: string,
): Promise<UserRecord | null> {
  return db
    .prepare(
      `SELECT id, public_id, full_name, email, password, role, is_verified
       FROM users
       WHERE email = ? COLLATE NOCASE
       LIMIT 1`,
    )
    .bind(email.trim())
    .first<UserRecord>();
}
