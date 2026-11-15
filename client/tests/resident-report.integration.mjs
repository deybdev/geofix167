import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  buildResidentReportPayload, submitReport, getReports, getReportStats,
  getReportDetails, updateReportDetails, normalizeReport, summarizeReports,
} from "../src/services/residentService.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const serverRequire = createRequire(resolve(root, "server/package.json"));
const { build } = serverRequire("esbuild");
const bundle = await build({ entryPoints: [resolve(root, "server/src/index.ts")], bundle: true, platform: "node", format: "esm", write: false });
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const sql = new DatabaseSync(":memory:");
sql.exec(`PRAGMA foreign_keys = ON;
  CREATE TABLE roles(role_id INTEGER PRIMARY KEY, code TEXT);
  CREATE TABLE account_statuses(status_id INTEGER PRIMARY KEY, status_code TEXT);
  CREATE TABLE users(user_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, mobile_number TEXT, role_id INTEGER, account_status_id INTEGER);
  CREATE TABLE user_sessions_and_devices(user_id TEXT, token_hash TEXT, expires_at TEXT, revoked_at TEXT);
  INSERT INTO roles VALUES(1, 'resident'); INSERT INTO account_statuses VALUES(1, 'ACTIVE');
  INSERT INTO users VALUES('resident', 'Test', 'Resident', '09123456789', 1, 1), ('other', 'Other', 'Resident', '09987654321', 1, 1);`);
for (const file of ["0005_guest_incidents.sql", "0006_review_alerts.sql", "0012_community_audit.sql"]) {
  sql.exec(readFileSync(resolve(root, "server/src/migrations", file), "utf8"));
}
const token = "test-resident-session";
const hash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))).toString("hex");
sql.prepare("INSERT INTO user_sessions_and_devices(user_id, token_hash, expires_at) VALUES(?,?,?)").run("resident", hash, "2099-01-01");
const db = {
  prepare(query) {
    const statement = sql.prepare(query);
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { return { meta: { changes: statement.run(...values).changes } }; },
    };
  },
  async batch(statements) {
    sql.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sql.exec("COMMIT");
      return results;
    } catch (error) { sql.exec("ROLLBACK"); throw error; }
  },
};

const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  assert.equal(options.credentials, "include");
  return app.request(url, {
    ...options, headers: { ...options.headers, Cookie: `geofix_session=${token}` },
  }, { geofix167_db: db, FRONTEND_ORIGIN: "http://localhost:5173" });
};

try {
  assert.deepEqual((await getReports()).data.reports, []);
  const payload = buildResidentReportPayload({
    category: "drainage", urgency: "Moderate", isEmergency: false,
    description: "  Blocked drainage  ", position: null, address: "  Main Street  ",
    landmark: " Near chapel ", callbackContact: " 09123456789 ",
  });
  assert.equal(payload.reporter_type, "RESIDENT");
  assert.equal(payload.priority_level, "MEDIUM");
  assert.equal(payload.description, "Blocked drainage");
  assert.equal(payload.is_emergency, 0);
  assert.equal(payload.latitude, null);
  assert.equal(payload.longitude, null);
  assert.equal(payload.callback_contact, "09123456789");
  assert.ok(!("reporter_user_id" in payload));

  const attempt = { ...payload, idempotency_key: crypto.randomUUID() };
  const { data: created } = await submitReport(attempt);
  assert.equal(created.idempotent_replay, false);
  const { data: replay } = await submitReport(attempt);
  assert.equal(replay.idempotent_replay, true);
  assert.equal(replay.report.public_id, created.report.public_id);
  assert.equal(sql.prepare("SELECT count(*) n FROM incident_reports").get().n, 1);
  const id = created.report.public_id;
  assert.equal(created.report.reference_number, id);
  assert.equal(created.report.status, "submitted");
  assert.equal(created.report.urgency, "Moderate");
  assert.equal(created.report.latitude, null);
  assert.ok(created.report.address.includes("Main Street") && created.report.address.includes("Near chapel"));
  assert.equal((await getReports()).data.reports[0].public_id, id);
  assert.equal((await getReportStats()).data.stats.total, 1);
  const fetched = (await getReportDetails(id)).data.report;
  assert.equal(fetched.status_events.length, 1);
  assert.equal(fetched.status_events[0].label, "Submitted");
  assert.ok(fetched.status_events[0].created_at);
  assert.ok(fetched.status_events[0].id);

  await updateReportDetails(id, { description_sanitized: "More details", location_description: "New landmark", priority_code: "P1", category: "fire" });
  const patchCall = calls.find(call => call.options.method === "PATCH");
  assert.deepEqual(JSON.parse(patchCall.options.body), { description_sanitized: "More details", location_description: "New landmark" });
  const fresh = (await getReportDetails(id)).data.report;
  assert.equal(fresh.description, "More details");
  assert.equal(fresh.address, "New landmark");
  assert.equal(fresh.category, "drainage");

  sql.prepare("UPDATE incident_reports SET incident_status_id=4 WHERE incident_id=?").run(id);
  await assert.rejects(updateReportDetails(id, { location_description: "Too late" }), error =>
    error.status === 409 && /verification or dispatch/.test(error.message));
  assert.equal((await getReports({ status: "in_progress" })).data.reports.length, 1);
  assert.equal((await getReportStats()).data.stats.in_progress, 1);
  await assert.rejects(getReportDetails("not-found"), error => error.status === 404);

  // Every terminal outcome stays distinct; only CLOSED contributes to Resolved.
  const normalized = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(status_id => normalizeReport({
    incident_id: `id-${status_id}`, status_id, priority_code: "P2", is_terminal: [10, 11, 12].includes(status_id) ? 1 : 0,
    description_original: "Original", description_sanitized: "", submitted_at: "2026-11-13 00:00:00",
  }));
  assert.equal(normalized[0].description, "");
  assert.equal(normalized[0].created_at, "2026-11-13T00:00:00Z");
  assert.deepEqual(summarizeReports(normalized), { total: 14, submitted: 1, under_review: 3, assigned: 4, in_progress: 10, resolved: 1 });
  assert.equal(normalized[10].status, "rejected");
  const emergency = buildResidentReportPayload({ category: "fire", urgency: "Critical", isEmergency: true, description: "Smoke", position: { lat: 14.73, lng: 121.01 } });
  assert.equal(emergency.is_emergency, 1);
  assert.equal(emergency.latitude, 14.73);
  assert.equal(emergency.priority_level, "CRITICAL");

  sql.exec("UPDATE user_sessions_and_devices SET revoked_at=datetime('now')");
  await assert.rejects(getReports(), error => error.status === 401 && /Session expired or invalid/.test(error.message));
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Editing forbidden." }), { status: 403 });
  await assert.rejects(updateReportDetails(id, { location_description: "Draft" }), error => error.status === 403 && error.message === "Editing forbidden.");
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(submitReport(attempt), /Check your connection/);
  console.log("PASS resident API integration: submission/replay, session credentials, live list/stats/detail, event mapping, PATCH allowlist, NULL coordinates, and backend errors");
} finally {
  globalThis.fetch = originalFetch;
  sql.close();
}
