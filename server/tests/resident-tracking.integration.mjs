import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const testDir = dirname(fileURLToPath(import.meta.url));
const serverRoot = resolve(testDir, '..');
const { build } = require('esbuild');
const bundle = await build({ entryPoints: [resolve(serverRoot, 'src/index.ts')], bundle: true, platform: 'node', format: 'esm', write: false });
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const sql = new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys = ON');
sql.exec(`CREATE TABLE roles(role_id INTEGER PRIMARY KEY, code TEXT UNIQUE);
CREATE TABLE account_statuses(status_id INTEGER PRIMARY KEY, status_code TEXT UNIQUE);
CREATE TABLE users(user_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, mobile_number TEXT, password_hash TEXT, role_id INTEGER, account_status_id INTEGER);
CREATE TABLE user_sessions_and_devices(user_id TEXT, token_hash TEXT, expires_at TEXT, revoked_at TEXT);
INSERT INTO roles VALUES(1,'admin'),(2,'resident'),(3,'tanod'),(4,'bdrrmo'),(5,'fire'),(6,'police');
INSERT INTO account_statuses VALUES(1,'ACTIVE');
INSERT INTO users VALUES('admin','Admin','User','09123123123','hash',1,1),('resident','Resident','User','09246246246','hash',2,1),
('usr_demo_responder_001','Renus','Manipon','09369369369','hash',3,1),('bdrrmo','BDRRMO','User','4','hash',4,1),('fire','Fire','User','5','hash',5,1),('police','Police','User','6','hash',6,1),('other','Other','Resident','7','hash',2,1);`);
for (const file of ['0005_guest_incidents.sql', '0006_review_alerts.sql', '0007_dispatch_support.sql', '0012_community_audit.sql', '0015_admin_dispatch.sql', '0017_report_attachments.sql', '0018_guest_report_intake.sql', '0019_resident_report_notifications.sql', '0020_guest_report_location_metadata.sql', '0021_guest_report_urgency.sql', '0022_normalize_maintenance_categories.sql', '0028_responder_dispatches.sql', '0029_dispatch_coordinates.sql', '0033_live_tracking.sql']) {
  sql.exec(readFileSync(resolve(serverRoot, `src/migrations/${file}`), 'utf8'));
}
const sha256 = async (value) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
for (const [id] of [['admin'], ['resident'], ['bdrrmo'], ['fire'], ['police'], ['other']]) {
  const token = `${id}-session`;
  sql.prepare('INSERT INTO user_sessions_and_devices (user_id, token_hash, expires_at) VALUES(?,?,?)').run(id, await sha256(token), '2099-01-01');
}
const db = {
  prepare(query) {
    const statement = sql.prepare(query);
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { const result = statement.run(...values); return { meta: { changes: result.changes } }; },
    };
  },
  async batch(statements) {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sql.exec('COMMIT');
      return results;
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  },
};
const uploadedPhotos = new Map();
const uploads = {
  async put(key, value) { uploadedPhotos.set(key, value); },
  async get(key) { return uploadedPhotos.get(key) ?? null; },
  async delete(key) { uploadedPhotos.delete(key); },
};
const request = (path, method = 'GET', body, account) => {
  const multipart = body instanceof FormData;
  return app.request(`/api${path}`, {
  method,
  headers: { ...(multipart ? {} : { 'Content-Type': 'application/json' }), ...(account ? { Cookie: `geofix_session=${account}-session` } : {}) },
  ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
  }, { geofix167_db: db, geofix167_uploads: uploads, FRONTEND_ORIGIN: 'http://localhost:5173' });
};

sql.exec('CREATE TABLE auth_rate_limits (rate_limit_key TEXT NOT NULL, action TEXT NOT NULL, window_started_at TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, blocked_until TEXT, PRIMARY KEY (rate_limit_key, action))');
// Exercise production Hono routes + SQL persistence, then the mobile service and mapper.
const mobile = await build({
  stdin: { contents: `export { getReportDetails } from './src/services/residentService.js'; export { trackingState } from './src/services/residentTracking.js';`, resolveDir: resolve(serverRoot, '../mobile'), sourcefile: 'tracking-test.js' },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'http-adapter', setup(builder) {
    builder.onLoad({ filter: /[\\/]services[\\/]api\.js$/ }, () => ({ contents: 'export default globalThis.trackingTestApi;' }));
    builder.onLoad({ filter: /[\\/]services[\\/]secureStorage\.js$/ }, () => ({ contents: 'export const secureStorage = { getAccessToken: async () => null };' }));
  } }],
});
globalThis.trackingTestApi = {
  defaults: { baseURL: 'http://localhost/api' },
  async request(config) {
    const response = await request(config.url, config.method || 'GET', config.data, 'resident');
    const data = await response.json();
    if (!response.ok) throw { response: { status: response.status, data } };
    return { data };
  },
};
const { getReportDetails, trackingState } = await import(`data:text/javascript;base64,${Buffer.from(mobile.outputFiles[0].text).toString('base64')}`);
const expectResponse = async (response, status) => {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
};
const created = await expectResponse(await request('/reports', 'POST', {
  reporter_type: 'RESIDENT', incident_category: 'fire', is_emergency: 1,
  description: 'Resident tracking integration test emergency', latitude: 14.73, longitude: 121.01,
}, 'resident'), 201);
const id = created.report.incident_id;
const read = async () => (await getReportDetails(id)).data.report;
assert.equal((await read()).status_id, 1);
assert.equal(trackingState(await read()).report.status, 'received');
await expectResponse(await request(`/admin/dispatch/reports/${id}/verify`, 'POST', { decision: 'VERIFIED' }, 'admin'), 200);
assert.equal((await read()).status_id, 5);
assert.equal(trackingState(await read()).report.status, 'validated');
await expectResponse(await request(`/bdrrmo/incidents/${id}/dispatch`, 'POST', {
  departments: ['fire', 'police'], tactical_note: 'Tracking test dispatch',
}, 'bdrrmo'), 201);
let report = await read();
assert.equal(report.status_id, 6, 'BDRRMO Web dispatch assigns the parent immediately');
assert.equal(trackingState(report).report.status, 'dispatched');
const fire = report.dispatched_units.find(unit => unit.role === 'fire').id;
const police = report.dispatched_units.find(unit => unit.role === 'police').id;
const status = async (assignment, value, role) => expectResponse(await request(`/responder/dispatches/${assignment}/status`, 'PATCH', { status: value }, role), 200);
const start = () => request(`/responder/dispatches/${fire}/status`, 'PATCH', { status: 'EN_ROUTE' }, 'fire');
assert.equal((await start()).status, 409);
assert.equal((await read()).dispatched_units.find(unit => unit.id === fire).status, 'DISPATCHED');
await status(fire, 'ACCEPTED', 'fire');
await expectResponse(await request('/responder/location', 'POST', { assignment_id: fire, lat: 14.731, lng: 121.011, accuracy: 5, heading: 90 }, 'fire'), 200);
report = await read();
assert.equal(report.status_id, 6, 'Acceptance persists parent ASSIGNED, including when already assigned by Web dispatch');
assert.equal(report.dispatched_units.find(unit => unit.id === fire).status, 'ACCEPTED');
assert.ok(report.dispatched_units.find(unit => unit.id === fire).location);
assert.equal(trackingState(report).report.status, 'dispatched', 'Actual acceptance + GPS payload must remain assigned');
console.log('PASS actual acceptance response: parent ASSIGNED (6), unit ACCEPTED, live GPS; mobile stage dispatched');
sql.exec("CREATE TRIGGER fail_start BEFORE INSERT ON incident_status_events WHEN NEW.to_incident_status_id=7 BEGIN SELECT RAISE(ABORT,'test save failure'); END");
const oldError = console.error;
try {
  console.error = () => {};
  assert.equal((await start()).status, 500);
} finally {
  console.error = oldError;
  sql.exec('DROP TRIGGER fail_start');
}
assert.equal((await read()).dispatched_units.find(unit => unit.id === fire).status, 'ACCEPTED');
await expectResponse(await start(), 200);
await expectResponse(await start(), 200); // Retry after a lost success response.
report = await read(); assert.equal(report.status_id, 7);
assert.equal(trackingState(report).report.status, 'on_the_way');
await expectResponse(await request(`/responder/dispatches/${fire}/arrive`, 'POST', { incident_id: id }, 'fire'), 200);
report = await read(); assert.equal(report.status_id, 8);
assert.equal(trackingState(report).report.status, 'arrived');
assert.equal((await start()).status, 409);
assert.equal((await read()).status_id, 8);
await status(police, 'ACCEPTED', 'police');
await expectResponse(await request(`/responder/dispatches/${police}/arrive`, 'POST', { incident_id: id }, 'police'), 200);
await expectResponse(await request(`/responder/dispatches/${fire}/complete-agency`, 'POST', { incident_id: id, summary: 'Fire unit completed its assignment' }, 'fire'), 201);
report = await read();
assert.equal(report.status_id, 9);
assert.equal(report.is_terminal, false);
assert.equal(report.dispatched_units.find(unit => unit.id === fire).status, 'COMPLETED');
assert.equal(report.dispatched_units.find(unit => unit.id === police).status, 'ON_SCENE');
assert.equal(trackingState(report).report.status, 'closure_review');
assert.equal(trackingState(report).responder.id, police, 'The remaining active unit stays visible during review');
assert.equal((await request(`/reports/${id}`, 'GET', undefined, 'other')).status, 404);
assert.equal((await request('/reports/missing', 'GET', undefined, 'resident')).status, 404);
console.log('PASS resident submit, Admin verify/forward, BDRRMO dispatch, accept/GPS, en route, arrive, one-unit completion awaiting closure review; ownership/missing report enforced');
sql.close();
delete globalThis.trackingTestApi;
