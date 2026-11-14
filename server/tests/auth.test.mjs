import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const digest = value => createHash("sha256").update(value).digest("hex");
const origin = "http://localhost:5173";

test("authentication and registration security integration", async t => {
  const externalResponses = new Map();
  const sentEmails = [];
  let mailFails = false;
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: ".wrangler/auth-test-build/index.js", compatibilityDate: "2026-10-23",
    d1Databases: ["geofix167_db"], r2Buckets: ["geofix167_uploads"],
    outboundService: async request => {
      if (request.url === "https://mail.example/send") {
        if (mailFails) return Response.json({ message: "Unavailable" }, { status: 503 });
        sentEmails.push(await request.json());
        return Response.json({ messageId: "test-message" });
      }
      const response = externalResponses.get(request.url);
      if (!response) return new Response("Unexpected external request", { status: 500 });
      externalResponses.delete(request.url);
      return Response.json(response);
    },
    bindings: { FRONTEND_ORIGIN: origin, AUTH_HASH_SECRET: "isolated-test-secret", GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", GOOGLE_REDIRECT_URI: `${origin}/api/auth/google/callback`, BREVO_API_URL: "https://mail.example/send", BREVO_API_KEY: "test-key" },
  }));
  try {
    const db = await mf.getD1Database("geofix167_db");
    for (const filename of (await readdir("src/migrations")).filter(v => v.endsWith(".sql")).sort()) {
      const sql = (await readFile(`src/migrations/${filename}`, "utf8")).replace(/^\s*--.*$/gm, "");
      const statements = sql.split(";").map(v => v.trim()).filter(v => v && !/^(BEGIN|COMMIT|PRAGMA)/i.test(v));
      await db.batch(statements.map(v => db.prepare(v)));
    }
    const request = (path, { method = "GET", cookie = "", body, headers = {} } = {}) => mf.dispatchFetch(`http://localhost${path}`, {
      method, headers: { Origin: origin, Cookie: cookie, ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, body: body === undefined ? undefined : typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body), redirect: "manual",
    });
    const verified = async (email, subject) => {
      const token = randomBytes(32).toString("hex");
      await db.prepare("INSERT INTO auth_flows (token_hash, kind, payload, expires_at) VALUES (?, 'IDENTITY', ?, ?)")
        .bind(digest(token), JSON.stringify({ email, ...(subject ? { subject } : {}) }), Date.now() + 3600000).run();
      return `geofix_identity=${token}`;
    };
    const registration = (email, overrides = {}) => ({ first_name: "Demo", last_name: "Resident", email, date_of_birth: "2000-01-01", barangay_identifier: "DEMO-167-0001", mobile_number: "09910000001", password: "Strong-Test-123!", accepted_terms: true, terms_version: "2026-11-13", privacy_version: "2026-11-13", ...overrides });
    let automaticCookie, pendingCookie, adminCookie, pendingId;

    await t.test("requires verified identity and correct origin", async () => {
      assert.equal((await request("/api/auth/register", { method: "POST", body: registration() })).status, 401);
      assert.equal((await request("/api/auth/register", { method: "POST", body: registration(), headers: { Origin: "https://attacker.example" } })).status, 403);
    });
    await t.test("verified email unrelated to masterlist auto-approves exact match", async () => {
      automaticCookie = await verified("new-google-email@example.com", "google-sub-1");
      const result = await request("/api/auth/register", { method: "POST", cookie: automaticCookie, body: registration("new-google-email@example.com") });
      assert.equal(result.status, 202);
      assert.equal((await result.json()).status, "RECEIVED");
      const user = await db.prepare("SELECT * FROM users WHERE email = 'new-google-email@example.com'").first();
      assert.equal(user.account_status_id, 1);
      assert.equal(user.google_subject, "google-sub-1");
      assert.equal(user.masterlist_id, "ml_demo_resident_001");
      assert.equal((await (await request("/api/auth/registration/status", { cookie: automaticCookie })).json()).request.status, "APPROVED");
    });
    await t.test("duplicates return same public response and never replace account credentials", async () => {
      const before = await db.prepare("SELECT password_hash FROM users WHERE mobile_number = '09910000001'").first();
      const collision = await verified("different@example.com", "different-sub");
      const result = await request("/api/auth/register", { method: "POST", cookie: collision, body: registration("different@example.com", { password: "Different-Pass-321!" }) });
      assert.equal(result.status, 202);
      assert.equal((await result.json()).status, "RECEIVED");
      assert.deepEqual(await db.prepare("SELECT password_hash FROM users WHERE mobile_number = '09910000001'").first(), before);
      assert.equal((await (await request("/api/auth/registration/status", { cookie: collision })).json()).request, null);
    });
    await t.test("unknown ID creates unverified request; no login until reviewed", async () => {
      pendingCookie = await verified("pending@example.com");
      const result = await request("/api/auth/register", { method: "POST", cookie: pendingCookie, body: registration("pending@example.com", { barangay_identifier: "UNKNOWN-ID", mobile_number: "09910000002" }) });
      assert.equal(result.status, 202);
      const status = (await (await request("/api/auth/registration/status", { cookie: pendingCookie })).json()).request;
      assert.equal(status.status, "NEEDS_CORRECTION");
      pendingId = status.request_id;
      assert.equal((await request("/api/auth/login", { method: "POST", body: { mobile_number: "09910000002", password: "Strong-Test-123!" } })).status, 403);
    });
    await t.test("valid consent versions are required server-side", async () => {
      assert.equal((await request("/api/auth/register", { method: "POST", cookie: pendingCookie, body: registration("pending@example.com", { accepted_terms: false }) })).status, 400);
      assert.equal((await request("/api/auth/register", { method: "POST", cookie: pendingCookie, body: registration("pending@example.com", { terms_version: "old" }) })).status, 400);
    });
    await t.test("ID uploads reject forged MIME and enforce private review", async () => {
      assert.equal((await request("/api/auth/registration/document", { method: "POST", cookie: pendingCookie, body: "not a PNG", headers: { "Content-Type": "image/png" } })).status, 400);
      const pdf = new TextEncoder().encode("%PDF-1.4\nTest-only fixture");
      assert.equal((await request("/api/auth/registration/document", { method: "POST", cookie: pendingCookie, body: pdf, headers: { "Content-Type": "application/pdf" } })).status, 202);
      assert.equal((await (await request("/api/auth/registration/status", { cookie: pendingCookie })).json()).request.status, "PENDING");
      assert.equal((await request(`/api/admin/registrations/${pendingId}/document`)).status, 401);
      assert.equal((await request("/api/admin/registrations/")).status, 401);
    });
    await t.test("admin can request correction, applicant resubmits, then admin approves", async () => {
      const login = await request("/api/auth/login", { method: "POST", body: { mobile_number: "09123123123", password: "password" } });
      assert.equal(login.status, 200);
      adminCookie = login.headers.get("set-cookie").split(";")[0];
      assert.equal((await request(`/api/admin/registrations/${pendingId}/document`, { cookie: adminCookie })).status, 200);
      const review = (decision, reason) => request(`/api/admin/registrations/${pendingId}/review`, { method: "POST", cookie: adminCookie, body: { decision, reason } });
      assert.equal((await review("NEEDS_CORRECTION", "Please provide a clearer photo")).status, 200);
      assert.equal((await (await request("/api/auth/registration/status", { cookie: pendingCookie })).json()).request.status, "NEEDS_CORRECTION");
      assert.equal((await request("/api/auth/registration/document", { method: "POST", cookie: pendingCookie, body: new TextEncoder().encode("%PDF-1.4\nClearer fixture"), headers: { "Content-Type": "application/pdf" } })).status, 202);
      const decisions = await Promise.all([review("APPROVED", ""), review("REJECTED", "Concurrent decision")]);
      assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
      const final = (await (await request("/api/auth/registration/status", { cookie: pendingCookie })).json()).request.status;
      const user = await db.prepare("SELECT account_status_id FROM users WHERE email = 'pending@example.com'").first();
      assert.equal(user.account_status_id, final === "APPROVED" ? 1 : 2);
    });
    await t.test("concurrent attempts enforce registration cooldown with Retry-After", async () => {
      const results = await Promise.all(Array.from({ length: 4 }, () => request("/api/auth/register", { method: "POST", cookie: automaticCookie, body: registration("new-google-email@example.com") })));
      const blocked = results.find(r => r.status === 429);
      assert.ok(blocked);
      assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    });
    await t.test("OAuth rejects callbacks without matching browser state", async () => {
      const result = await request("/api/auth/google/callback?state=wrong&code=fake");
      assert.equal(result.status, 302);
      assert.match(result.headers.get("location"), /auth_error=google/);
      assert.equal(result.headers.get("set-cookie"), null);
    });
    await t.test("Google authorization uses PKCE and single-use callback; existing subject signs in", async () => {
      const start = await request("/api/auth/google/start");
      assert.equal(start.status, 302);
      const url = new URL(start.headers.get("location"));
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert.equal(url.searchParams.get("scope"), "openid email profile");
      const oauthCookie = start.headers.get("set-cookie").split(";")[0];
      externalResponses.set("https://oauth2.googleapis.com/token", { access_token: "mock-access" });
      externalResponses.set("https://openidconnect.googleapis.com/v1/userinfo", { sub: "google-sub-1", email: "new-google-email@example.com", email_verified: true });
      const callback = `/api/auth/google/callback?state=${url.searchParams.get("state")}&code=mock-code`;
      const result = await request(callback, { cookie: oauthCookie });
      assert.equal(result.status, 302);
      assert.equal(result.headers.get("location"), `${origin}/resident`);
      const session = result.headers.getSetCookie().find(v => v.startsWith("geofix_session=")).split(";")[0];
      assert.equal((await request("/api/auth/me", { cookie: session })).status, 200);
      assert.equal((await request(callback, { cookie: oauthCookie })).headers.get("location"), `${origin}/register?auth_error=google`);
      assert.equal((await request("/api/admin/registrations/", { cookie: session })).status, 403);
      assert.equal((await request("/api/auth/logout", { method: "POST", cookie: session })).status, 200);
      assert.equal((await request("/api/auth/me", { cookie: session })).status, 401);
    });
    await t.test("email delivery verifies ownership, enforces resend cooldown, and consumes code once", async () => {
      const result = await request("/api/auth/registration/email/start", { method: "POST", body: { email: "new@example.com" } });
      assert.equal(result.status, 200);
      const cookie = result.headers.get("set-cookie").split(";")[0];
      const message = sentEmails.find(v => v.to[0].email === "new@example.com");
      const code = message.textContent.match(/code is (\d{6})/)[1];
      const resend = await request("/api/auth/registration/email/start", { method: "POST", body: { email: "new@example.com" } });
      assert.equal(resend.status, 429);
      assert.ok(Number(resend.headers.get("retry-after")) <= 60);
      assert.equal((await request("/api/auth/registration/email/verify", { method: "POST", cookie, body: { code: code === "000000" ? "111111" : "000000" } })).status, 400);
      const verified = await request("/api/auth/registration/email/verify", { method: "POST", cookie, body: { code } });
      assert.equal(verified.status, 200);
      assert.equal((await verified.json()).identity.email, "new@example.com");
      assert.equal((await request("/api/auth/registration/email/verify", { method: "POST", cookie, body: { code } })).status, 400);
    });
    await t.test("five incorrect email-code attempts lock even a subsequent correct code", async () => {
      const result = await request("/api/auth/registration/email/start", { method: "POST", body: { email: "locked@example.com" } });
      const cookie = result.headers.get("set-cookie").split(";")[0];
      const message = sentEmails.find(v => v.to[0].email === "locked@example.com");
      const code = message.textContent.match(/code is (\d{6})/)[1];
      const wrong = code === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++) assert.equal((await request("/api/auth/registration/email/verify", { method: "POST", cookie, body: { code: wrong } })).status, 400);
      assert.equal((await request("/api/auth/registration/email/verify", { method: "POST", cookie, body: { code } })).status, 429);
    });
    await t.test("email delivery failure is not reported as a sent code", async () => {
      mailFails = true;
      const result = await request("/api/auth/registration/email/start", { method: "POST", body: { email: "failure@example.com" } });
      assert.equal(result.status, 503);
      mailFails = false;
    });
  } finally { await mf.dispose(); }
});
