
import type { AppEnv } from "../types/env";

export type UserRecord = {
  user_id: string;
  first_name: string;
  last_name: string;
  mobile_number: string;
  password_hash: string;
  role: "admin" | "resident" | "tanod" | "bdrrmo" | "police" | "fire";
  account_status: "ACTIVE" | "UNVERIFIED" | "DEACTIVATED";
  resident_verification: "APPROVED" | "NOT_REQUIRED" | "NOT_APPROVED";
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
           account_status.status_code AS account_status,
           CASE
             WHEN r.code != 'resident' THEN 'NOT_REQUIRED'
             WHEN EXISTS (
               SELECT 1 FROM resident_verifications v
               WHERE v.user_id = u.user_id
                 AND v.verification_id = u.approved_verification_id
                 AND v.status = 'APPROVED'
             ) THEN 'APPROVED'
             ELSE 'NOT_APPROVED'
           END AS resident_verification
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
