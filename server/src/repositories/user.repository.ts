
import type { AppEnv } from "../types/env";

export type UserRecord = {
  user_id: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  password_hash: string;
  role: "admin" | "resident" | "tanod" | "bdrrmo" | "police" | "fire";
  account_status: "ACTIVE" | "UNVERIFIED" | "DEACTIVATED";
};

export async function findUserByMobileNumber(
  db: AppEnv["Bindings"]["geofix167_db"],
  mobileNumber: string,
): Promise<UserRecord | null> {
  return db
    .prepare(
       `SELECT
          u.user_id,
          u.first_name,
          u.last_name,
          u.mobile_number,
          u.password_hash,
          r.code AS role,
          account_status.status_code AS account_status
        FROM users AS u
        INNER JOIN roles AS r ON r.role_id = u.role_id
        INNER JOIN account_statuses AS account_status
          ON account_status.status_id = u.account_status_id
        WHERE u.mobile_number = ?
        LIMIT 1`,
    )
    .bind(mobileNumber.trim())
    .first<UserRecord>();
}
