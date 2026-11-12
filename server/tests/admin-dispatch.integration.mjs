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
CREATE TABLE user_sessions_and_devices(user_id TEXT, token_hash TEXT, expires_at TEXT);
INSERT INTO roles VALUES(1,'admin'),(2,'resident'),(3,'tanod');
INSERT INTO account_statuses VALUES(1,'ACTIVE');
INSERT INTO users VALUES('admin','Admin','User','09123123123','hash',1,1),('resident','Resident','User','09246246246','hash',2,1),
('usr_demo_responder_001','Renus','Manipon','09369369369','hash',3,1);`);
for (const file of ['0005_guest_incidents.sql', '0006_review_alerts.sql', '0007_dispatch_support.sql', '0012_community_audit.sql', '0015_admin_dispatch.sql']) {
  sql.exec(readFileSync(resolve(serverRoot, `src/migrations/${file}`), 'utf8'));
}
const sha256 = async (value) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
for (const [id, role] of [['admin', 'admin'], ['resident', 'resident']]) {
  const token = `${id}-session`;
  sql.prepare('INSERT INTO user_sessions_and_devices VALUES(?,?,?)').run(id, await sha256(token), '2099-01-01');
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
const request = (path, method = 'GET', body, account) => app.request(`/api${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', ...(account ? { Cookie: `geofix_session=${account}-session` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}, { geofix167_db: db, geofix167_uploads: { get: async () => null }, FRONTEND_ORIGIN: 'http://localhost:5173' });

assert.equal((await request('/admin/dispatch/reports')).status, 401, 'anonymous admin request must be rejected');
assert.equal((await request('/admin/dispatch/reports', 'GET', undefined, 'resident')).status, 403, 'non-admin request must be rejected');
const unitsResponse = await request('/admin/dispatch/units', 'GET', undefined, 'admin');
assert.equal(unitsResponse.status, 200);
const seededUnits = (await unitsResponse.json()).units;
assert.equal(seededUnits.length, 3, 'demo responder and extra demo units are seeded');
assert.ok(seededUnits.every((unit) => unit.availability_status === 'AVAILABLE'));

const reportIds = [];
for (let index = 0; index < 4; index += 1) {
  const response = await request('/reports', 'POST', {
    reporter_type: 'GUEST', incident_category: 'Road Damage', priority_level: 'HIGH',
    description: `Dispatch integration report ${index}`, latitude: 14.73, longitude: 121.01,
  });
  assert.equal(response.status, 201);
  reportIds.push((await response.json()).report.incident_id);
}

for (let index = 0; index < 3; index += 1) {
  const verified = await request(`/admin/dispatch/reports/${reportIds[index]}/verify`, 'POST', { decision: 'VERIFIED' }, 'admin');
  assert.equal(verified.status, 200);
  const dispatched = await request(`/admin/dispatch/reports/${reportIds[index]}/dispatch`, 'POST', { unit_id: seededUnits[index].id }, 'admin');
  assert.equal(dispatched.status, 201);
  const report = sql.prepare(`SELECT s.code AS status FROM incident_reports r JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id WHERE r.incident_id = ?`).get(reportIds[index]);
  assert.equal(report.status, 'DISPATCHED');
}
const busyUnits = (await (await request('/admin/dispatch/units', 'GET', undefined, 'admin')).json()).units;
assert.ok(busyUnits.every((unit) => unit.availability_status === 'BUSY'));
assert.equal((await request(`/admin/dispatch/reports/${reportIds[0]}/dispatch`, 'POST', { unit_id: seededUnits[0].id }, 'admin')).status, 409, 'unavailable unit must not be dispatched');

const help = await request(`/admin/dispatch/reports/${reportIds[3]}/request-drrmo`, 'POST', { note: 'No units available' }, 'admin');
assert.equal(help.status, 201);
const awaiting = sql.prepare(`SELECT s.code AS status FROM incident_reports r JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id WHERE r.incident_id = ?`).get(reportIds[3]);
assert.equal(awaiting.status, 'AWAITING_DRRMO_SUPPORT');
const requested = sql.prepare('SELECT COUNT(*) AS count FROM external_support_requests WHERE incident_id = ?').get(reportIds[3]);
assert.equal(requested.count, 1);
assert.equal((await request(`/admin/dispatch/reports/${reportIds[3]}/verify`, 'POST', { decision: 'REJECTED', reason: 'Invalid' }, 'admin')).status, 409, 'closed workflow states cannot be re-verified');
assert.equal((await request('/admin/dispatch/reports', 'GET', undefined, 'resident')).status, 403);
console.log('PASS admin dispatch integration: role guards, seeding, verification, atomic dispatch, unit availability, DRRMO request, and invalid transitions');
