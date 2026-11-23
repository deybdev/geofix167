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
INSERT INTO roles VALUES(1,'admin'),(2,'resident'),(3,'tanod');
INSERT INTO account_statuses VALUES(1,'ACTIVE');
INSERT INTO users VALUES('admin','Admin','User','09123123123','hash',1,1),('resident','Resident','User','09246246246','hash',2,1),
('usr_demo_responder_001','Renus','Manipon','09369369369','hash',3,1);`);
for (const file of ['0005_guest_incidents.sql', '0006_review_alerts.sql', '0007_dispatch_support.sql', '0012_community_audit.sql', '0015_admin_dispatch.sql', '0017_report_attachments.sql', '0018_guest_report_intake.sql', '0019_resident_report_notifications.sql', '0020_guest_report_location_metadata.sql', '0021_guest_report_urgency.sql', '0022_normalize_maintenance_categories.sql', '0028_responder_dispatches.sql', '0029_dispatch_coordinates.sql', '0033_live_tracking.sql']) {
  sql.exec(readFileSync(resolve(serverRoot, `src/migrations/${file}`), 'utf8'));
}
const sha256 = async (value) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
for (const [id, role] of [['admin', 'admin'], ['resident', 'resident'], ['usr_demo_responder_001', 'tanod'], ['usr_demo_responder_002', 'tanod']]) {
  const token = `${id}-session`;
  sql.prepare('INSERT INTO user_sessions_and_devices (user_id, token_hash, expires_at) VALUES(?,?,?)').run(id, await sha256(token), '2099-01-01');
}
const db = {
  prepare(query) {
    const statement = sql.prepare(query);
    let values = [];
    return {
      readOnly: /^\s*SELECT/i.test(query),
      bind(...args) { values = args; return this; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { const result = statement.run(...values); return { results: [], meta: { changes: result.changes } }; },
    };
  },
  async batch(statements) {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(statement.readOnly ? await statement.all() : await statement.run());
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
const owner = 'usr_demo_responder_001';
const other = 'usr_demo_responder_002';
const path = '/responder/dispatches/duty-status';
const patch = (body, user = owner) => request(path, 'PATCH', body, user);
const read = async (user = owner) => {
  const response = await request(path, 'GET', undefined, user);
  assert.equal(response.status, 200);
  return response.json();
};
for (const expected of [false, true]) {
  const response = await patch({ on_duty: expected, responder_user_id: other });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.on_duty, expected);
  assert.deepEqual(await read(), result);
  assert.equal((await read(other)).on_duty, true);
}
for (const value of ['false', 'true', 0, 1, null, undefined]) {
  assert.equal((await patch({ on_duty: value })).status, 400);
}
assert.equal((await read()).on_duty, true);
assert.equal((await patch({ on_duty: false }, 'resident')).status, 403);
sql.prepare("UPDATE responder_resources SET availability_status='BUSY' WHERE responder_user_id=?").run(owner);
assert.equal((await patch({ on_duty: false })).status, 409);
assert.equal((await patch({ on_duty: true })).status, 200);
assert.equal((await read()).availability_status, 'BUSY');
sql.prepare("UPDATE responder_resources SET availability_status='UNAVAILABLE' WHERE responder_user_id=?").run(owner);
sql.exec("CREATE TRIGGER fail_save BEFORE UPDATE ON responder_resources BEGIN SELECT RAISE(ABORT,'test failure'); END");
assert.equal((await patch({ on_duty: true })).status, 503);
assert.equal((await read()).on_duty, false);
sql.exec('DROP TRIGGER fail_save');
assert.equal((await patch({ on_duty: true })).status, 200);
sql.prepare('DELETE FROM responder_resources WHERE responder_user_id=?').run(owner);
assert.equal((await patch({ on_duty: true })).status, 404);
assert.equal((await request(path, 'GET', undefined, owner)).status, 404);
sql.exec('ALTER TABLE responder_resources RENAME TO unavailable_resource_table');
assert.equal((await request(path, 'GET', undefined, other)).status, 503);
assert.equal((await patch({ on_duty: true }, other)).status, 503);
console.log('PASS duty persistence, strict booleans, current-user scope, BUSY, missing resource, database failures and retry');
