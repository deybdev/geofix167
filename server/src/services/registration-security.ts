import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types/env";
import { sendEmail } from "./email.service";

export const POLICY_VERSION = "2026-11-13";
export const received = { status: "RECEIVED", message: "Your registration request has been received. Check your email or your registration status for the next step." };
export type Identity = { email: string; subject?: string; first_name?: string; last_name?: string };
export const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("");
export async function hash(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
export function cookie(c: Context<AppEnv>, name: string, value: string, maxAge: number) {
  setCookie(c, name, value, { httpOnly: true, sameSite: "Lax", secure: new URL(c.req.url).protocol === "https:", path: "/", maxAge });
}
export function assertOrigin(c: Context<AppEnv>) {
  if (c.req.header("Origin") !== c.env.FRONTEND_ORIGIN) throw new HTTPException(403, { message: "Invalid request origin." });
}
export async function flow(c: Context<AppEnv>, kind: string, payload: unknown, seconds: number) {
  const token = randomToken();
  await c.env.geofix167_db.prepare("INSERT INTO auth_flows (token_hash, kind, payload, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await hash(token), kind, JSON.stringify(payload), Date.now() + seconds * 1000).run();
  cookie(c, `geofix_${kind.toLowerCase()}`, token, seconds);
  return token;
}
export async function readFlow<T>(c: Context<AppEnv>, kind: string): Promise<{ key: string; payload: T; attempts: number } | null> {
  const token = getCookie(c, `geofix_${kind.toLowerCase()}`);
  if (!token) return null;
  const key = await hash(token);
  const row = await c.env.geofix167_db.prepare("SELECT payload, attempts FROM auth_flows WHERE token_hash = ? AND kind = ? AND expires_at > ?")
    .bind(key, kind, Date.now()).first<{ payload: string; attempts: number }>();
  return row ? { key, payload: JSON.parse(row.payload) as T, attempts: row.attempts } : null;
}
export async function identity(c: Context<AppEnv>) {
  const current = await readFlow<Identity>(c, "IDENTITY");
  if (!current) throw new HTTPException(401, { message: "Verify your email or continue with Google first." });
  return current.payload;
}

// Atomic UPSERT prevents concurrent requests from bypassing the counter.
// Keyed hashes keep guessable identifiers out of the limiter table.
export async function throttle(c: Context<AppEnv>, action: string, value: string, maximum: number, seconds: number) {
  if (!c.env.AUTH_HASH_SECRET) throw new HTTPException(503, { message: "Authentication configuration is incomplete." });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(c.env.AUTH_HASH_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const fingerprint = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, "0")).join("");
  const now = new Date().toISOString();
  const end = new Date(Date.now() + seconds * 1000).toISOString();
  const row = await c.env.geofix167_db.prepare(`INSERT INTO auth_rate_limits (rate_limit_key, action, window_started_at, attempt_count, blocked_until)
    VALUES (?, ?, ?, 1, ?) ON CONFLICT(rate_limit_key, action) DO UPDATE SET
    attempt_count = CASE WHEN blocked_until <= excluded.window_started_at THEN 1 ELSE attempt_count + 1 END,
    blocked_until = CASE WHEN blocked_until <= excluded.window_started_at THEN excluded.blocked_until ELSE blocked_until END,
    window_started_at = CASE WHEN blocked_until <= excluded.window_started_at THEN excluded.window_started_at ELSE window_started_at END
    RETURNING attempt_count, blocked_until`).bind(fingerprint, action, now, end).first<{ attempt_count: number; blocked_until: string }>();
  if (row && row.attempt_count > maximum) {
    const retry = Math.max(1, Math.ceil((Date.parse(row.blocked_until) - Date.now()) / 1000));
    throw new HTTPException(429, { res: new Response(JSON.stringify({ error: `Too many actions. Please try again in ${retry} seconds.`, retry_after: retry }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retry) } }) });
  }
}
export async function sourceThrottle(c: Context<AppEnv>, action: string, maximum = 30) {
  // Cloudflare overwrites this header in production. Local dev shares one source.
  await throttle(c, `${action}:source`, c.req.header("CF-Connecting-IP") || "local", maximum, 600);
}
export async function audit(c: Context<AppEnv>, userId: string, action: string, outcome: string) {
  await c.env.geofix167_db.prepare("INSERT INTO auth_audit_events (auth_audit_event_id, user_id, action, outcome) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, action, outcome).run();
}
export async function deliverNotification(c: Context<AppEnv>, notificationId: string) {
  if (!c.env.BREVO_API_URL || !c.env.BREVO_API_KEY) return;
  const claimed = await c.env.geofix167_db.prepare("UPDATE auth_notifications SET status = 'SENDING' WHERE notification_id = ? AND status IN ('PENDING', 'FAILED') RETURNING *")
    .bind(notificationId).first<{ user_id: string; subject: string; message: string }>();
  if (!claimed) return;
  try {
    const user = await c.env.geofix167_db.prepare("SELECT email FROM users WHERE user_id = ? AND email_verified_at IS NOT NULL").bind(claimed.user_id).first<{ email: string }>();
    if (!user) throw new Error("No verified recipient");
    await sendEmail(c.env.BREVO_API_URL, c.env.BREVO_API_KEY, { to: user.email, subject: claimed.subject, textContent: claimed.message });
    await c.env.geofix167_db.prepare("UPDATE auth_notifications SET status = 'SENT', sent_at = datetime('now') WHERE notification_id = ?").bind(notificationId).run();
  } catch (error) {
    console.error("Registration email delivery failed", {
      notificationId,
      message: error instanceof Error ? error.message : "Unknown email provider error",
    });
    await c.env.geofix167_db.prepare("UPDATE auth_notifications SET status = 'FAILED' WHERE notification_id = ?").bind(notificationId).run();
  }
}
export async function notify(c: Context<AppEnv>, userId: string, subject: string, message: string) {
  const notificationId = crypto.randomUUID();
  await c.env.geofix167_db.prepare("INSERT INTO auth_notifications (notification_id, user_id, subject, message) VALUES (?, ?, ?, ?)").bind(notificationId, userId, subject, message).run();
  c.executionCtx.waitUntil(deliverNotification(c, notificationId));
}
