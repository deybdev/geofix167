import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Context } from "hono";
import type { AppEnv } from "../types/env";
import { assertOrigin, audit, hash, identity, notify, POLICY_VERSION, randomToken, received, sourceThrottle, throttle } from "../services/registration-security";

const schema = z.object({
  first_name: z.string().trim().min(2).max(50), last_name: z.string().trim().min(2).max(50), middle_name: z.string().trim().max(50).optional(),
  email: z.email().transform(v => v.toLowerCase().trim()),
  barangay_identifier: z.string().trim().min(4).max(80),
  date_of_birth: z.iso.date().refine(v => v <= new Date().toISOString().slice(0, 10), "Invalid date of birth"),
  mobile_number: z.string().transform(v => v.trim().replace(/^\+63/, "0")).pipe(z.string().regex(/^09\d{9}$/)),
  password: z.string().min(8).max(72).refine(v => new TextEncoder().encode(v).length <= 72).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9\s]/).optional(),
  accepted_terms: z.literal(true), terms_version: z.literal(POLICY_VERSION), privacy_version: z.literal(POLICY_VERSION),
});
export const normalizeName = (v: string) => v.normalize("NFC").trim().replace(/\s+/g, " ").toUpperCase();

export async function registerResident(c: Context<AppEnv>) {
  assertOrigin(c);
  await sourceThrottle(c, "registration");
  const person = await identity(c);
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || (!person.subject && !parsed.data?.password)) return c.json({ error: "Check the required details, password, and policy acceptance." }, 400);
  const body = parsed.data;
  if (body.email !== person.email.toLowerCase()) return c.json({ error: "Use the same email address that you verified." }, 400);
  for (const [type, value] of [["email", person.email], ["mobile", body.mobile_number], ["id", body.barangay_identifier]] as const) {
    await throttle(c, `register:${type}`, value, 3, 86400);
  }
  const db = c.env.geofix167_db;
  // Do password work on all valid submissions, including conflicts.
  const passwordHash = await bcrypt.hash(body.password || randomToken(), 12);
  const master = await db.prepare("SELECT * FROM barangay_masterlist WHERE barangay_identifier = ?").bind(body.barangay_identifier).first<{
    masterlist_id: string; first_name: string; last_name: string; date_of_birth: string; is_active: number; card_valid_until: string | null;
  }>();
  const matched = !!master && master.is_active === 1 && (!master.card_valid_until || master.card_valid_until >= new Date().toISOString().slice(0, 10))
    && normalizeName(master.first_name) === normalizeName(body.first_name) && normalizeName(master.last_name) === normalizeName(body.last_name) && master.date_of_birth === body.date_of_birth;
  const userId = `usr_${crypto.randomUUID()}`;
  const verificationId = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  const now = new Date().toISOString();
  // A batch serializes claims. The approval only links an unclaimed resident
  // record, and identity/mobile collisions never overwrite an existing account.
  await db.batch([
    db.prepare(`INSERT INTO users (user_id, role_id, account_status_id, first_name, middle_name, last_name, mobile_number, email, email_verified_at, google_subject, password_hash)
      SELECT ?, 2, 2, ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS
      (SELECT 1 FROM users WHERE mobile_number = ? OR lower(email) = ? OR (? IS NOT NULL AND google_subject = ?))`)
      .bind(userId, body.first_name, body.middle_name || null, body.last_name, body.mobile_number, person.email, now, person.subject || null, passwordHash, body.mobile_number, person.email, person.subject || null, person.subject || null),
    db.prepare(`UPDATE users SET masterlist_id = ?, account_status_id = 1, approved_verification_id = ? WHERE user_id = ? AND ? = 1
      AND NOT EXISTS (SELECT 1 FROM users WHERE masterlist_id = ? AND user_id != ?)`)
      .bind(master?.masterlist_id || null, verificationId, userId, matched ? 1 : 0, master?.masterlist_id || null, userId),
    db.prepare(`INSERT INTO resident_verifications (verification_id, user_id, masterlist_id, barcode_value_hash, status, reviewed_at)
      SELECT ?, user_id, masterlist_id, ?, CASE WHEN account_status_id = 1 THEN 'APPROVED' ELSE 'NEEDS_CORRECTION' END,
      CASE WHEN account_status_id = 1 THEN ? ELSE NULL END FROM users WHERE user_id = ?`)
      .bind(verificationId, await hash(body.barangay_identifier), now, userId),
    db.prepare(`INSERT INTO registration_requests (request_id, user_id, verification_id, date_of_birth, terms_version, privacy_version, consent_at)
      SELECT ?, user_id, ?, ?, ?, ?, ? FROM users WHERE user_id = ?`)
      .bind(requestId, verificationId, body.date_of_birth, POLICY_VERSION, POLICY_VERSION, now, userId),
  ]);
  const created = await db.prepare("SELECT account_status_id FROM users WHERE user_id = ?").bind(userId).first<{ account_status_id: number }>();
  if (created) {
    await audit(c, userId, "REGISTRATION", created.account_status_id === 1 ? "AUTO_APPROVED" : "DOCUMENT_REQUIRED");
    await notify(c, userId, "GeoFix registration update", created.account_status_id === 1
      ? "Your resident verification is approved. You can now sign in to GeoFix."
      : "Please return to GeoFix registration, verify this email or continue with Google, and upload a Barangay ID or valid government ID for review. Your account is not yet active.");
  }
  return c.json(received, 202);
}

const route = new Hono<AppEnv>();
route.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  if (c.req.method !== "GET") assertOrigin(c);
  await next();
});
route.get("/status", async c => {
  const person = await identity(c);
  const request = await c.env.geofix167_db.prepare(`SELECT q.request_id, v.status, q.document_uploaded_at FROM registration_requests q
    JOIN users u ON u.user_id = q.user_id JOIN resident_verifications v ON v.verification_id = q.verification_id
    WHERE lower(u.email) = ? AND (? IS NULL OR u.google_subject = ?)`).bind(person.email, person.subject || null, person.subject || null).first();
  return c.json({ request });
});
route.post("/document", async c => {
  await sourceThrottle(c, "document");
  const person = await identity(c);
  await throttle(c, "document", person.email, 5, 600);
  const request = await c.env.geofix167_db.prepare(`SELECT q.request_id, q.document_key, q.user_id, q.verification_id FROM registration_requests q
    JOIN users u ON u.user_id = q.user_id JOIN resident_verifications v ON v.verification_id = q.verification_id
    WHERE lower(u.email) = ? AND (? IS NULL OR u.google_subject = ?) AND v.status = 'NEEDS_CORRECTION'`)
    .bind(person.email, person.subject || null, person.subject || null).first<{ request_id: string; document_key: string | null; user_id: string; verification_id: string }>();
  if (!request) return c.json({ error: "No document upload is available for this registration." }, 409);
  // Bound the actual stream, not just the caller-controlled Content-Length.
  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.json({ error: "Select an ID image or PDF." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 5 * 1024 * 1024) { await reader.cancel(); return c.json({ error: "The file must be 5 MB or smaller." }, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const starts = (...signature: number[]) => signature.every((v, i) => bytes[i] === v);
  const mime = starts(0xff, 0xd8, 0xff) ? "image/jpeg" : starts(137, 80, 78, 71, 13, 10, 26, 10) ? "image/png" : starts(37, 80, 68, 70, 45) ? "application/pdf" : null;
  if (!mime || mime !== c.req.header("Content-Type")) return c.json({ error: "Upload a valid JPEG, PNG, or PDF." }, 400);
  const key = `registration-ids/${crypto.randomUUID()}`;
  await c.env.geofix167_uploads.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    const result = await c.env.geofix167_db.batch([
      c.env.geofix167_db.prepare(`UPDATE registration_requests SET document_key = ?, document_type = ?, document_size = ?, document_uploaded_at = ?
        WHERE request_id = ? AND EXISTS (SELECT 1 FROM resident_verifications WHERE verification_id = ? AND status = 'NEEDS_CORRECTION')`)
        .bind(key, mime, size, new Date().toISOString(), request.request_id, request.verification_id),
      c.env.geofix167_db.prepare(`UPDATE resident_verifications SET status = 'PENDING', review_reason = NULL WHERE verification_id = ? AND status = 'NEEDS_CORRECTION'
        AND EXISTS (SELECT 1 FROM registration_requests WHERE request_id = ? AND document_key = ?)`)
        .bind(request.verification_id, request.request_id, key),
    ]);
    if (!result[0]?.meta.changes) { await c.env.geofix167_uploads.delete(key); return c.json({ error: "Registration status changed. Refresh and try again." }, 409); }
  } catch (error) { await c.env.geofix167_uploads.delete(key); throw error; }
  if (request.document_key) await c.env.geofix167_uploads.delete(request.document_key);
  await audit(c, request.user_id, "DOCUMENT_UPLOADED", "PENDING");
  await notify(c, request.user_id, "GeoFix registration received", "Your identity document has been received and is awaiting administrator review. We will email you when its status changes.");
  return c.json(received, 202);
});
export default route;
