import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types/env";
import { createSession } from "../repositories/session.repository";
import { sendEmail } from "../services/email.service";
import { assertOrigin, cookie, flow, hash, randomToken, readFlow, sourceThrottle, throttle, type Identity } from "../services/registration-security";

const route = new Hono<AppEnv>();
route.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  if (c.req.method === "POST") assertOrigin(c);
  await next();
});
route.get("/registration/identity", async c => {
  const current = await readFlow<Identity>(c, "IDENTITY");
  return c.json({ identity: current ? { email: current.payload.email, first_name: current.payload.first_name, last_name: current.payload.last_name, google: !!current.payload.subject } : null });
});
route.post("/registration/email/start", async c => {
  await sourceThrottle(c, "email");
  const result = z.object({ email: z.email().max(254).transform(v => v.toLowerCase().trim()) }).safeParse(await c.req.json().catch(() => null));
  if (!result.success) return c.json({ error: "Enter a valid email address." }, 400);
  const email = result.data.email;
  await throttle(c, "email:resend", email, 1, 60);
  await throttle(c, "email:daily", email, 10, 86400);
  if (!c.env.BREVO_API_URL || !c.env.BREVO_API_KEY) return c.json({ error: "Email delivery is not configured. Please contact the administrator." }, 503);
  // Rejection sampling avoids modulo bias in six-digit codes.
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]!; } while (value >= 4294000000);
  const code = String(value % 1000000).padStart(6, "0");
  const old = await readFlow(c, "EMAIL");
  if (old) await c.env.geofix167_db.prepare("DELETE FROM auth_flows WHERE token_hash = ?").bind(old.key).run();
  const salt = randomToken();
  await flow(c, "EMAIL", { email, code_hash: await hash(salt + code), salt }, 600);
  try {
    await sendEmail(c.env.BREVO_API_URL, c.env.BREVO_API_KEY, { to: email, subject: "Verify your GeoFix email", textContent: `Your GeoFix verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.` });
  } catch {
    return c.json({ error: "Email could not be delivered. Please try again later." }, 503);
  }
  return c.json({ message: "Check your email for a verification code.", retry_after: 60 });
});
route.post("/registration/email/verify", async c => {
  await sourceThrottle(c, "email-verify");
  const body = z.object({ code: z.string().regex(/^\d{6}$/) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Enter the six-digit code." }, 400);
  const current = await readFlow<{ email: string; salt: string; code_hash: string }>(c, "EMAIL");
  if (!current) return c.json({ error: "Code expired. Request a new code." }, 400);
  const attempt = await c.env.geofix167_db.prepare("UPDATE auth_flows SET attempts = attempts + 1 WHERE token_hash = ? AND attempts < 5 RETURNING token_hash").bind(current.key).first();
  if (!attempt) return c.json({ error: "Too many attempts. Request a new code." }, 429);
  if (await hash(current.payload.salt + body.data.code) !== current.payload.code_hash) return c.json({ error: "Incorrect or expired code." }, 400);
  const consumed = await c.env.geofix167_db.prepare("DELETE FROM auth_flows WHERE token_hash = ? RETURNING token_hash").bind(current.key).first();
  if (!consumed) return c.json({ error: "Code already used. Request a new code." }, 400);
  await flow(c, "IDENTITY", { email: current.payload.email }, 3600);
  return c.json({ identity: { email: current.payload.email, google: false } });
});

route.get("/google/start", async c => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET || !c.env.GOOGLE_REDIRECT_URI) return c.redirect(`${c.env.FRONTEND_ORIGIN}/register?auth_error=configuration`);
  await sourceThrottle(c, "google");
  const verifier = randomToken();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const state = await flow(c, "OAUTH", { verifier }, 600);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID, redirect_uri: c.env.GOOGLE_REDIRECT_URI, response_type: "code", scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" }).toString();
  return c.redirect(url.toString());
});
route.get("/google/callback", async c => {
  const failed = () => c.redirect(`${c.env.FRONTEND_ORIGIN}/register?auth_error=google`);
  const current = await readFlow<{ verifier: string }>(c, "OAUTH");
  if (!current || !c.req.query("state") || await hash(c.req.query("state")!) !== current.key) return failed();
  const consumed = await c.env.geofix167_db.prepare("DELETE FROM auth_flows WHERE token_hash = ? RETURNING token_hash").bind(current.key).first();
  cookie(c, "geofix_oauth", "", 0);
  if (!consumed || !c.req.query("code") || c.req.query("error")) return failed();
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID!, client_secret: c.env.GOOGLE_CLIENT_SECRET!, redirect_uri: c.env.GOOGLE_REDIRECT_URI!, code: c.req.query("code")!, grant_type: "authorization_code", code_verifier: current.payload.verifier }) });
    if (!response.ok) return failed();
    const tokens = await response.json() as { access_token?: string };
    if (!tokens.access_token) return failed();
    // Fetch identity directly from Google using this code exchange's access token.
    // Never trust decoded, unverified ID-token claims or browser-supplied email.
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!profileResponse.ok) return failed();
    const profile = z.object({ sub: z.string().min(1), email: z.email(), email_verified: z.literal(true), given_name: z.string().optional(), family_name: z.string().optional() }).safeParse(await profileResponse.json());
    if (!profile.success) return failed();
    const p = profile.data;
    await flow(c, "IDENTITY", { email: p.email.toLowerCase(), subject: p.sub, first_name: p.given_name, last_name: p.family_name }, 3600);
    // Link only by Google subject. Matching an existing email must never attach
    // a provider to an account without authenticating that account first.
    const user = await c.env.geofix167_db.prepare(`SELECT u.user_id FROM users u JOIN account_statuses s ON s.status_id = u.account_status_id JOIN roles r ON r.role_id = u.role_id
      WHERE u.google_subject = ? AND s.status_code = 'ACTIVE' AND r.code = 'resident'
        AND EXISTS (
          SELECT 1 FROM resident_verifications v
          WHERE v.user_id = u.user_id
            AND v.verification_id = u.approved_verification_id
            AND v.status = 'APPROVED'
        )`).bind(p.sub).first<{ user_id: string }>();
    if (user) {
      const token = randomToken();
      await createSession(c.env.geofix167_db, user.user_id, await hash(token), new Date(Date.now() + 604800000));
      cookie(c, "geofix_session", token, 604800);
      return c.redirect(`${c.env.FRONTEND_ORIGIN}/resident`);
    }
    return c.redirect(`${c.env.FRONTEND_ORIGIN}/register`);
  } catch {
    return failed();
  }
});
export default route;
