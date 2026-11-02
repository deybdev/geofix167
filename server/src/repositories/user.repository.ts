
import type { AppEnv } from "../types/env";

export type UserRecord = {
  id: number;
  public_id: string;
  full_name: string;
  mobile_number: string;
  password: string;
  role: "admin" | "responder" | "resident";
  is_verified: number;
};

export async function findUserByMobileNumber(
  db: AppEnv["Bindings"]["geofix167_db"],
  mobileNumber: string,
): Promise<UserRecord | null> {
  return db
    .prepare(
      `SELECT id, public_id, full_name, mobile_number, password, role, is_verified
       FROM users
       WHERE mobile_number = ?
       LIMIT 1`,
    )
    .bind(mobileNumber.trim())
    .first<UserRecord>();
}
