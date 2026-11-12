import bcrypt from "bcryptjs";
import type { Context } from "hono";
import type { AppEnv } from "../types/env";

const OTP_TTL_MS = 10 * 60 * 1000;

const id = (prefix: string) =>
  `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();

export async function registerResident(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null) as Record<string, string> | null;
  if (!body || !body.barangay_identifier || !body.first_name || !body.last_name || !body.date_of_birth || !body.mobile_number || !body.password) {
    return c.json({ error: "Complete the required registration details." }, 400);
  }

  const master = await c.env.geofix167_db.prepare(
    `SELECT * FROM barangay_masterlist WHERE barangay_identifier = ? LIMIT 1`,
  ).bind(body.barangay_identifier.trim()).first<Record<string, unknown>>();
  const existing = await c.env.geofix167_db.prepare(
    `SELECT user_id FROM users WHERE mobile_number = ? LIMIT 1`,
  ).bind(body.mobile_number.trim()).first();
  if (existing) {
    return c.json(
      {
        code: "MOBILE_ALREADY_REGISTERED",
        error: "This mobile number already has a GeoFix account. Log in or use Forgot Password.",
      },
      409,
    );
  }

  if (!master) {
    return c.json(
      {
        code: "ID_NOT_FOUND",
        error: "We could not find this Barangay ID in the masterlist. Your request was not submitted. Please check the number or use Need Help.",
      },
      404,
    );
  }

  if (master.is_active !== 1) {
    return c.json(
      {
        code: "ID_INACTIVE",
        error: "This Barangay ID is inactive. Please contact the Front Desk for review.",
      },
      403,
    );
  }

  if (master.card_valid_until && String(master.card_valid_until) < new Date().toISOString().slice(0, 10)) {
    return c.json(
      {
        code: "ID_EXPIRED",
        error: "This Barangay ID has expired. Please contact the Front Desk for renewal or review.",
      },
      403,
    );
  }

  const matched = normalized(String(master.first_name)) === normalized(body.first_name)
    && normalized(String(master.last_name)) === normalized(body.last_name)
    && String(master.date_of_birth) === body.date_of_birth;
  const userId = id("usr");
  await c.env.geofix167_db.prepare(
    `INSERT INTO users (user_id, role_id, account_status_id, masterlist_id, first_name, middle_name, last_name, mobile_number, password_hash)
     VALUES (?, 2, 2, ?, ?, ?, ?, ?, ?)`,
  ).bind(userId, matched ? master.masterlist_id : null, body.first_name.trim(), body.middle_name?.trim() || null, body.last_name.trim(), body.mobile_number.trim(), await bcrypt.hash(body.password, 12)).run();
  await c.env.geofix167_db.prepare(
    `INSERT INTO resident_verifications (verification_id, user_id, masterlist_id, barcode_value_hash, status)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id("verify"), userId, matched ? master.masterlist_id : null, await sha256(body.barangay_identifier.trim()), matched ? "PENDING" : "NEEDS_CORRECTION").run();
  if (!matched) {
    return c.json({
      status: "PENDING_REVIEW",
      code: "DETAILS_DO_NOT_MATCH",
      message: "Your name or date of birth does not match the masterlist. Your request was sent to the Front Desk for review.",
    }, 202);
  }

  return issueOtp(c, userId, body.mobile_number.trim(), "REGISTRATION");
}

export async function issueOtp(c: Context<AppEnv>, userId: string, mobile: string, purpose: "REGISTRATION" | "PASSWORD_RESET") {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await c.env.geofix167_db.prepare(
    `INSERT INTO otp_challenges (otp_challenge_id, user_id, mobile_number, purpose, code_hash, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(id("otp"), userId, mobile, purpose, await sha256(code), new Date(Date.now() + OTP_TTL_MS).toISOString()).run();
  console.info(`[LOCAL OTP] ${purpose} for ${mobile}: ${code}`);
  return c.json({ status: "OTP_SENT", message: "A verification code was sent to your mobile number." }, 201);
}

export async function verifyRegistrationOtp(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null) as { mobile_number?: string; code?: string } | null;
  if (!body?.mobile_number || !/^\d{6}$/.test(body.code ?? "")) {
    return c.json({ error: "Enter the six-digit verification code." }, 400);
  }

  const challenge = await c.env.geofix167_db.prepare(
    `SELECT * FROM otp_challenges
     WHERE mobile_number = ? AND purpose = 'REGISTRATION'
       AND verified_at IS NULL AND invalidated_at IS NULL
     ORDER BY sent_at DESC LIMIT 1`,
  ).bind(body.mobile_number.trim()).first<Record<string, unknown>>();
  if (!challenge || String(challenge.expires_at) <= new Date().toISOString()) {
    return c.json({ error: "This code has expired. Request a new code." }, 400);
  }
  if (Number(challenge.attempt_count) >= Number(challenge.max_attempts)) {
    return c.json({ error: "Too many attempts. Request a new verification code." }, 429);
  }
  if (await sha256(body.code) !== challenge.code_hash) {
    await c.env.geofix167_db.prepare(
      `UPDATE otp_challenges SET attempt_count = attempt_count + 1 WHERE otp_challenge_id = ?`,
    ).bind(challenge.otp_challenge_id).run();
    return c.json({ error: "That verification code is incorrect." }, 400);
  }

  await c.env.geofix167_db.batch([
    c.env.geofix167_db.prepare(
      `UPDATE otp_challenges SET verified_at = ? WHERE otp_challenge_id = ?`,
    ).bind(new Date().toISOString(), challenge.otp_challenge_id),
    c.env.geofix167_db.prepare(
      `UPDATE users SET account_status_id = 1, last_otp_verified_at = ? WHERE user_id = ?`,
    ).bind(new Date().toISOString(), challenge.user_id),
    c.env.geofix167_db.prepare(
      `UPDATE resident_verifications SET status = 'APPROVED', reviewed_at = ? WHERE user_id = ? AND status = 'PENDING'`,
    ).bind(new Date().toISOString(), challenge.user_id),
  ]);
  return c.json({ status: "VERIFIED", message: "Your account is verified. You can now sign in." });
}
