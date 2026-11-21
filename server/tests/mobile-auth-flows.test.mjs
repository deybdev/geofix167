import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const hash = value => createHash("sha256").update(value).digest("hex");

test("consolidated mobile flows preserve records and enforce verification", async () => {
  const emails = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, scriptPath: ".wrangler/auth-test-build/index.js", compatibilityDate: "2026-10-23",
    d1Databases: ["geofix167_db"], r2Buckets: ["geofix167_uploads"],
    bindings: { FRONTEND_ORIGIN: "http://localhost:5173", AUTH_HASH_SECRET: "isolated-test", BREVO_API_URL: "https://mail.example/send", BREVO_API_KEY: "test" },
    outboundService: async request => { emails.push(await request.json()); return Response.json({ messageId: "test" }); },
  }));
  try {
    const db = await mf.getD1Database("geofix167_db");
    const apply = async sql => db.batch(sql.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)));
    // Minimal isolated schema avoids unrelated historical seed/trigger failures.
    await apply(`CREATE TABLE users (user_id TEXT PRIMARY KEY);
      CREATE TABLE auth_flows (token_hash TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('OAUTH','EMAIL','IDENTITY')), payload TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX idx_auth_flows_expiry ON auth_flows(expires_at);
      CREATE TABLE auth_rate_limits (rate_limit_key TEXT NOT NULL, action TEXT NOT NULL, window_started_at TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, blocked_until TEXT, PRIMARY KEY(rate_limit_key, action));`);
    for (const name of ["0019_mobile_google_oauth.sql", "0020_mobile_registration_identity.sql"]) await apply(await readFile(`src/migrations/${name}`, "utf8"));
    const expiry = Date.now() + 3600000;
    await db.prepare("INSERT INTO auth_flows VALUES ('web', 'IDENTITY', '{}', ?, 2)").bind(expiry).run();
    await db.prepare("INSERT INTO users VALUES ('test-user')").run();
    await db.prepare("INSERT INTO mobile_oauth_tickets (ticket_hash,user_id,code_challenge,expires_at) VALUES ('login','test-user','challenge',?)").bind(expiry).run();
    const verifier = "v".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const ticket = "t".repeat(64);
    await db.prepare("INSERT INTO mobile_registration_tickets (ticket_hash,identity_payload,code_challenge,expires_at) VALUES (?,?,?,?)").bind(hash(ticket), JSON.stringify({ email: "migrated@example.com" }), challenge, expiry).run();
    await db.prepare("INSERT INTO mobile_registration_identities (token_hash,identity_payload,expires_at) VALUES ('identity','{}',?)").bind(expiry).run();
    await apply(await readFile("src/migrations/0030_consolidate_mobile_auth_flows.sql", "utf8"));
    assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM auth_flows").first()).n, 4);
    assert.equal((await db.prepare("SELECT attempts FROM auth_flows WHERE token_hash='web'").first()).attempts, 2);
    assert.equal((await db.prepare("SELECT expires_at FROM auth_flows WHERE token_hash='login'").first()).expires_at, expiry);
    for (const table of ["mobile_oauth_tickets", "mobile_registration_tickets", "mobile_registration_identities"]) {
      assert.equal((await db.prepare(`SELECT COUNT(*) AS n FROM ${table}_old`).first()).n, 1);
      assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name=?").bind(table).first(), null);
    }
    const request = (path, body) => mf.dispatchFetch(`http://localhost/api/auth${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const exchange = code_verifier => request("/mobile/registration/exchange", { ticket, code_verifier });
    assert.equal((await exchange("x".repeat(43))).status, 401);
    const exchanges = await Promise.all([exchange(verifier), exchange(verifier)]);
    assert.deepEqual(exchanges.map(r => r.status).sort(), [200, 401]);
    const start = await request("/mobile/registration/email/start", { email: "qa@example.com" });
    assert.equal(start.status, 200);
    const { email_token } = await start.json();
    const code = emails.at(-1).textContent.match(/code is (\d{6})/)[1];
    const verify = value => request("/mobile/registration/email/verify", { email_token, code: value });
    assert.equal((await verify(code === "000000" ? "111111" : "000000")).status, 400);
    const verified = await Promise.all([verify(code), verify(code)]);
    assert.equal(verified.filter(r => r.status === 200).length, 1);
    assert.notEqual((await verify(code)).status, 200);
    const startLocked = await request("/mobile/registration/email/start", { email: "locked@example.com" });
    const locked = await startLocked.json();
    const lockedCode = emails.at(-1).textContent.match(/code is (\d{6})/)[1];
    for (let i = 0; i < 5; i++) assert.equal((await request("/mobile/registration/email/verify", { email_token: locked.email_token, code: lockedCode === "000000" ? "111111" : "000000" })).status, 400);
    assert.equal((await request("/mobile/registration/email/verify", { email_token: locked.email_token, code: lockedCode })).status, 429);
    assert.equal((await request("/mobile/registration/email/start", { email: "qa@example.com" })).status, 429);
  } finally { await mf.dispose(); }
});
