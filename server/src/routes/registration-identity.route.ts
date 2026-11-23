import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types/env";
import { createSession } from "../repositories/session.repository";
import { findUserBySession } from "../repositories/session.repository";
import { createMobileSession, hashToken } from "../services/auth.service";
import { sendEmail } from "../services/email.service";
import { assertOrigin, cookie, flow, hash, randomToken, readFlow, sourceThrottle, throttle, type Identity } from "../services/registration-security";

const route = new Hono<AppEnv>();
type OAuthFlow = { verifier: string; client?: "mobile"; return_uri?: string; code_challenge?: string; google_redirect_uri?: string };

function mobileReturnUri(c: Context<AppEnv>, value: string | undefined) {
  if (!value) return null;
  const allowed = (c.env.MOBILE_OAUTH_RETURN_URIS ?? "geofix167://auth")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  if (allowed.includes(value)) return value;
  try {
    const url = new URL(value);
    const privateExpoHost = url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || /^192\.168\./.test(url.hostname)
      || /^10\./.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);
    if (url.protocol === "exp:" && privateExpoHost && url.pathname === "/--/auth") return value;
  } catch {
    // Invalid URLs are rejected below.
  }
  return null;
}

function redirectWithParams(uri: string, params: Record<string, string>) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
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
route.post("/mobile/registration/email/start", async c => {
  await sourceThrottle(c, "mobile-email");
  const result = z.object({ email: z.email().max(254).transform(v => v.toLowerCase().trim()) }).safeParse(await c.req.json().catch(() => null));
  if (!result.success) return c.json({ error: "Enter a valid email address." }, 400);
  if (!c.env.BREVO_API_URL || !c.env.BREVO_API_KEY) return c.json({ error: "Email delivery is not configured." }, 503);
  await throttle(c, "email:resend", result.data.email, 1, 60);
  await throttle(c, "email:daily", result.data.email, 10, 86400);
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]!; } while (value >= 4294000000);
  const code = String(value % 1000000).padStart(6, "0");
  const salt = randomToken();
  const token = randomToken();
  await c.env.geofix167_db.prepare("INSERT INTO auth_flows (token_hash, kind, payload, expires_at) VALUES (?, 'MOBILE_EMAIL', ?, ?)")
    .bind(await hash(token), JSON.stringify({ email: result.data.email, code_hash: await hash(salt + code), salt }), Date.now() + 600000).run();
  try {
    await sendEmail(c.env.BREVO_API_URL, c.env.BREVO_API_KEY, { to: result.data.email, subject: "Verify your GeoFix email", textContent: `Your GeoFix verification code is ${code}. It expires in 10 minutes.` });
  } catch {
    await c.env.geofix167_db.prepare("DELETE FROM auth_flows WHERE token_hash = ? AND kind = 'MOBILE_EMAIL'").bind(await hash(token)).run();
    return c.json({ error: "Email could not be delivered. Please try again later." }, 503);
  }
  return c.json({ email_token: token, message: "Check your email for a verification code.", retry_after: 60 });
});
route.post("/mobile/registration/email/verify", async c => {
  await sourceThrottle(c, "mobile-email-verify");
  const body = z.object({ email_token: z.string().min(20), code: z.string().regex(/^\d{6}$/) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Enter the six-digit code." }, 400);
  const key = await hash(body.data.email_token);
  const row = await c.env.geofix167_db.prepare("SELECT payload, attempts FROM auth_flows WHERE token_hash = ? AND kind = 'MOBILE_EMAIL' AND expires_at > ?")
    .bind(key, Date.now()).first<{ payload: string; attempts: number }>();
  if (!row) return c.json({ error: "Code expired. Request a new code." }, 400);
  const payload = JSON.parse(row.payload) as { email: string; salt: string; code_hash: string };
  const attempt = await c.env.geofix167_db.prepare("UPDATE auth_flows SET attempts = attempts + 1 WHERE token_hash = ? AND kind = 'MOBILE_EMAIL' AND expires_at > ? AND attempts < 5 RETURNING token_hash").bind(key, Date.now()).first();
  if (!attempt) return c.json({ error: "Too many attempts. Request a new code." }, 429);
  if (await hash(payload.salt + body.data.code) !== payload.code_hash) return c.json({ error: "Incorrect or expired code." }, 400);
  const consumed = await c.env.geofix167_db.prepare("DELETE FROM auth_flows WHERE token_hash = ? AND kind = 'MOBILE_EMAIL' AND expires_at > ? RETURNING token_hash").bind(key, Date.now()).first();
  if (!consumed) return c.json({ error: "Code already used or expired. Request a new code." }, 400);
  const registrationToken = randomToken();
  await c.env.geofix167_db.prepare("INSERT INTO auth_flows (token_hash, kind, payload, expires_at) VALUES (?, 'MOBILE_IDENTITY', ?, ?)")
    .bind(await hash(registrationToken), JSON.stringify({ email: payload.email }), Date.now() + 3600000).run();
  return c.json({ registration_token: registrationToken, identity: { email: payload.email, google: false } });
});
route.get("/google/mobile/start", async c => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET || !c.env.GOOGLE_MOBILE_REDIRECT_URI) {
    return c.json({ error: "Google authentication is not configured." }, 503);
  }
  await sourceThrottle(c, "google-mobile");
  const parsed = z.object({
    return_uri: z.string().min(1).max(500),
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  }).safeParse({
    return_uri: c.req.query("return_uri"),
    code_challenge: c.req.query("code_challenge"),
  });
  const returnUri = parsed.success ? mobileReturnUri(c, parsed.data.return_uri) : null;
  if (!parsed.success || !returnUri) {
    console.warn("[auth] invalid mobile OAuth start", {
      validation: parsed.success ? "valid" : parsed.error.issues.map(issue => issue.path.join(".")),
      return_uri_allowed: Boolean(returnUri),
    });
    return c.json({
      error: "Invalid mobile OAuth request.",
      invalid_fields: parsed.success ? ["return_uri"] : parsed.error.issues.map(issue => issue.path.join(".")),
    }, 400);
  }

  const verifier = randomToken();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const state = await flow(c, "OAUTH", { verifier, client: "mobile", return_uri: returnUri, code_challenge: parsed.data.code_challenge, google_redirect_uri: c.env.GOOGLE_MOBILE_REDIRECT_URI }, 600);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID, redirect_uri: c.env.GOOGLE_MOBILE_REDIRECT_URI, response_type: "code", scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" }).toString();
  return c.redirect(url.toString());
});
route.get("/google/callback", async c => {
  const state = c.req.query("state");
  const stateKey = state ? await hash(state) : null;
  const stateRow = stateKey ? await c.env.geofix167_db.prepare("SELECT payload, attempts FROM auth_flows WHERE token_hash = ? AND kind = 'OAUTH' AND expires_at > ?")
    .bind(stateKey, Date.now()).first<{ payload: string; attempts: number }>() : null;
  const payload = stateRow ? JSON.parse(stateRow.payload) as OAuthFlow : null;
  const failed = () => payload?.client === "mobile" && payload.return_uri
    ? c.redirect(redirectWithParams(payload.return_uri, { error: "google_auth_failed" }))
    : c.redirect(`${c.env.FRONTEND_ORIGIN}/register?auth_error=google`);
  const current = payload?.client === "mobile"
    ? (stateKey && stateRow ? { key: stateKey, payload, attempts: stateRow.attempts } : null)
    : await readFlow<OAuthFlow>(c, "OAUTH");
  if (!current || !state || await hash(state) !== current.key) return failed();
  const consumed = await c.env.geofix167_db.prepare("DELETE FROM auth_flows WHERE token_hash = ? RETURNING token_hash").bind(current.key).first();
  cookie(c, "geofix_oauth", "", 0);
  if (!consumed || !c.req.query("code") || c.req.query("error")) return failed();
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: c.env.GOOGLE_CLIENT_ID!, client_secret: c.env.GOOGLE_CLIENT_SECRET!, redirect_uri: current.payload.google_redirect_uri ?? c.env.GOOGLE_REDIRECT_URI!, code: c.req.query("code")!, grant_type: "authorization_code", code_verifier: current.payload.verifier }) });
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
      if (current.payload.client === "mobile" && current.payload.return_uri && current.payload.code_challenge) {
        const ticket = randomToken();
        await c.env.geofix167_db.prepare("INSERT INTO auth_flows (token_hash, kind, payload, expires_at) VALUES (?, 'MOBILE_OAUTH_TICKET', ?, ?)")
          .bind(await hash(ticket), JSON.stringify({ user_id: user.user_id, code_challenge: current.payload.code_challenge }), Date.now() + 120000).run();
        return c.redirect(redirectWithParams(current.payload.return_uri, { ticket }));
      }
      const token = randomToken();
      await createSession(c.env.geofix167_db, user.user_id, await hash(token), new Date(Date.now() + 604800000));
      cookie(c, "geofix_session", token, 604800);
      return c.redirect(`${c.env.FRONTEND_ORIGIN}/resident`);
    }
    if (current.payload.client === "mobile" && current.payload.return_uri) {
      const ticket = randomToken();
      await c.env.geofix167_db.prepare(`INSERT INTO auth_flows
        (token_hash, kind, payload, expires_at) VALUES (?, 'MOBILE_REGISTRATION_TICKET', ?, ?)`)
        .bind(await hash(ticket), JSON.stringify({ identity: { email: p.email.toLowerCase(), subject: p.sub, first_name: p.given_name, last_name: p.family_name }, code_challenge: current.payload.code_challenge }), Date.now() + 120000).run();
      return c.redirect(redirectWithParams(current.payload.return_uri, { registration_ticket: ticket }));
    }
    return c.redirect(`${c.env.FRONTEND_ORIGIN}/register`);
  } catch {
    return failed();
  }
});
route.post("/mobile/google/exchange", async c => {
  await sourceThrottle(c, "google-mobile-exchange");
  const parsed = z.object({
    ticket: z.string().min(20).max(200),
    code_verifier: z.string().min(43).max(128),
  }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid or expired Google sign-in." }, 400);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parsed.data.code_verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const ticketHash = await hash(parsed.data.ticket);
  const row = await c.env.geofix167_db.prepare(`DELETE FROM auth_flows
    WHERE token_hash = ? AND kind = 'MOBILE_OAUTH_TICKET' AND json_extract(payload, '$.code_challenge') = ? AND expires_at > ?
    RETURNING payload`).bind(ticketHash, challenge, Date.now()).first<{ payload: string }>();
  if (!row) return c.json({ error: "Invalid or expired Google sign-in." }, 401);

  const { user_id } = JSON.parse(row.payload) as { user_id: string };
  const accessToken = await createMobileSession(c.env.geofix167_db, user_id, 7);
  const refreshToken = await createMobileSession(c.env.geofix167_db, user_id, 30);
  const user = await findUserBySession(c.env.geofix167_db, await hashToken(accessToken));
  if (!user) return c.json({ error: "Unable to create a mobile session." }, 500);
  return c.json({ access_token: accessToken, refresh_token: refreshToken, user });
});
route.post("/mobile/registration/exchange", async c => {
  await sourceThrottle(c, "google-mobile-registration-exchange");
  const parsed = z.object({ ticket: z.string().min(20).max(200), code_verifier: z.string().min(43).max(128) })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid or expired registration." }, 400);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parsed.data.code_verifier)));
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const row = await c.env.geofix167_db.prepare(`DELETE FROM auth_flows
    WHERE token_hash = ? AND kind = 'MOBILE_REGISTRATION_TICKET' AND json_extract(payload, '$.code_challenge') = ? AND expires_at > ? RETURNING payload`)
    .bind(await hash(parsed.data.ticket), challenge, Date.now()).first<{ payload: string }>();
  if (!row) return c.json({ error: "Invalid or expired registration." }, 401);
  const registrationToken = randomToken();
  const { identity } = JSON.parse(row.payload) as { identity: Identity };
  await c.env.geofix167_db.prepare(`INSERT INTO auth_flows
    (token_hash, kind, payload, expires_at) VALUES (?, 'MOBILE_IDENTITY', ?, ?)`)
    .bind(await hash(registrationToken), JSON.stringify(identity), Date.now() + 3600000).run();
  return c.json({ registration_token: registrationToken, identity: { email: identity.email, first_name: identity.first_name, last_name: identity.last_name, google: true } });
});
export default route;
