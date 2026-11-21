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
for (const file of ['0005_guest_incidents.sql', '0006_review_alerts.sql', '0007_dispatch_support.sql', '0012_community_audit.sql', '0015_admin_dispatch.sql', '0018_guest_report_intake.sql', '0019_resident_report_notifications.sql']) {
  sql.exec(readFileSync(resolve(serverRoot, `src/migrations/${file}`), 'utf8'));
}
sql.exec("INSERT INTO users VALUES('other','Other','User','09000000000','hash',2,1)");
const sha256 = async (value) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('hex');
for (const [id, role] of [['admin', 'admin'], ['resident', 'resident'], ['other', 'resident']]) {
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
      async run() { if (/^\s*SELECT/i.test(query)) return { results: statement.all(...values) }; const result = statement.run(...values); return { meta: { changes: result.changes } }; },
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

const count = () => sql.prepare('SELECT count(*) n FROM resident_notifications').get().n;
const create = async (guest = false, key = crypto.randomUUID()) => {
  const response = await request('/reports', 'POST', { reporter_type: guest ? 'GUEST' : 'RESIDENT',
    incident_category: 'Road Damage', guest_alias: 'Test Guest', title: 'Road report', classification: 'maintenance', priority_level: 'HIGH', landmark_description: 'Test street', description: 'Notification test', idempotency_key: key }, guest ? undefined : 'resident');
  assert.equal(response.status, 201);
  return (await response.json()).report.incident_id;
};
const inbox = async (query = '', user = 'resident') => {
  const response = await request('/notifications' + query, 'GET', undefined, user);
  assert.equal(response.status, 200);
  return response.json();
};
assert.equal((await request('/notifications')).status, 401);
assert.equal((await request('/notifications', 'GET', undefined, 'admin')).status, 403);
const key = crypto.randomUUID();
const id = await create(false, key);
assert.equal(count(), 1);
assert.equal((await request('/reports', 'POST', { reporter_type: 'RESIDENT', incident_category: 'Road Damage', description: 'Notification test', idempotency_key: key }, 'resident')).status, 200);
assert.equal(count(), 1, 'submission replay must not notify twice');
const guest = await create(true);
assert.equal(count(), 1, 'guests have no resident inbox');
assert.equal((await request(`/admin/dispatch/reports/${guest}/verify`, 'POST', { decision: 'VERIFIED' }, 'admin')).status, 200);
assert.equal(count(), 1);
const verify = (report, decision = 'VERIFIED') => request(`/admin/dispatch/reports/${report}/verify`, 'POST', { decision, reason: 'PRIVATE STAFF NOTE' }, 'admin');
assert.equal((await verify(id)).status, 200);
assert.equal(count(), 2);
assert.equal((await verify(id)).status, 409);
assert.equal(count(), 2);
const unit = sql.prepare('SELECT responder_resource_id id FROM responder_resources WHERE responder_user_id IS NOT NULL').get().id;
assert.equal((await request(`/admin/dispatch/reports/${id}/dispatch`, 'POST', { unit_id: unit }, 'resident')).status, 403);
assert.equal(count(), 2);
assert.equal((await request(`/admin/dispatch/reports/${id}/dispatch`, 'POST', { unit_id: unit }, 'admin')).status, 201);
assert.equal(count(), 3);
assert.equal((await request(`/admin/dispatch/reports/${id}/dispatch`, 'POST', { unit_id: unit }, 'admin')).status, 409);
assert.equal(count(), 3);
const rejected = await create();
assert.equal((await verify(rejected, 'REJECTED')).status, 200);
const escalated = await create();
assert.equal((await request(`/admin/dispatch/reports/${escalated}/request-drrmo`, 'POST', {}, 'admin')).status, 201);
const beforeStale = count();
assert.equal((await request(`/admin/dispatch/reports/${escalated}/request-drrmo`, 'POST', {}, 'admin')).status, 409);
assert.equal(count(), beforeStale);

const generic = await create();
sql.prepare(`INSERT INTO tanod_assignments
  (tanod_assignment_id, incident_id, tanod_user_id, assignment_status_id, assigned_by_user_id)
  VALUES ('generic-assignment', ?, 'usr_demo_responder_001', 2, 'admin')`).run(generic);
for (const status of [2, 3, 2, 4, 5, 6, 7, 8, 9, 10]) {
  const before = count();
  const response = await request(`/reports/${generic}/status`, 'PATCH', { status_id: status }, 'admin');
  assert.equal(response.status, 200, `generic status ${status}`);
  assert.equal(count(), before + 1);
}
const beforeInvalid = count();
assert.equal((await request(`/reports/${generic}/status`, 'PATCH', { status_id: 10 }, 'admin')).status, 409);
assert.equal(count(), beforeInvalid);
const events = sql.prepare('SELECT * FROM resident_notifications WHERE incident_id = ?').all(generic);
assert.equal(events.filter(n => n.body === 'Your report is under review.').length, 2, 'revisited status uses a distinct event');
assert.ok(events.some(n => n.body.includes('not yet closed')));
assert.ok(events.some(n => n.body === 'Your report has been closed.'));
assert.ok(sql.prepare('SELECT body FROM resident_notifications').all().every(n => !n.body.includes('PRIVATE')));
const event = sql.prepare('SELECT * FROM incident_status_events WHERE incident_id = ? LIMIT 1').get(id);
assert.throws(() => sql.prepare(`INSERT INTO resident_notifications
  (notification_id, recipient_user_id, incident_id, source_event_id, title, body)
  VALUES ('duplicate', 'resident', ?, ?, 'Duplicate', 'Duplicate')`).run(id, event.incident_status_event_id), /UNIQUE/);

// Inject a notification failure: the real admin transaction must roll back.
const rollbackId = await create();
const beforeRollback = count();
sql.exec("CREATE TRIGGER fail_notification BEFORE INSERT ON resident_notifications BEGIN SELECT RAISE(ABORT, 'test notification failure'); END");
const originalError = console.error;
console.error = () => {};
try { assert.equal((await verify(rollbackId)).status, 500); } finally { console.error = originalError; }
assert.equal(count(), beforeRollback);
assert.equal(sql.prepare('SELECT incident_status_id s FROM incident_reports WHERE incident_id = ?').get(rollbackId).s, 1);
assert.equal(sql.prepare('SELECT count(*) n FROM incident_status_events WHERE incident_id = ?').get(rollbackId).n, 1);
sql.exec('DROP TRIGGER fail_notification');

// Force tied timestamps to exercise the ID tie-breaker, and verify full unread count.
sql.exec("UPDATE resident_notifications SET created_at = '2026-11-16T00:00:00.000Z'");
let page = await inbox('?limit=2');
assert.equal(page.notifications.length, 2);
assert.equal(page.unread_count, count());
const ids = page.notifications.map(n => n.id);
while (page.next_cursor) {
  page = await inbox('?limit=2&cursor=' + encodeURIComponent(page.next_cursor));
  ids.push(...page.notifications.map(n => n.id));
}
assert.equal(new Set(ids).size, count());
assert.deepEqual(ids, [...ids].sort().reverse());
assert.ok((await inbox()).notifications.every(n => n.ref_id && n.type === 'report_update' && n.created_at.endsWith('Z')));
assert.equal((await inbox('', 'other')).unread_count, 0);
assert.equal((await request(`/notifications/${ids[0]}/read`, 'PATCH', undefined, 'other')).status, 404);
assert.equal((await request('/notifications/read-all', 'PATCH', undefined, 'other')).status, 200);
assert.equal((await inbox()).unread_count, count());
assert.equal((await app.request(`/api/notifications/${ids[0]}/read`, { method: 'PATCH', headers: { Cookie: 'geofix_session=resident-session', Origin: 'https://evil.example' } }, { geofix167_db: db, FRONTEND_ORIGIN: 'http://localhost:5173' })).status, 403);
assert.equal((await request(`/notifications/${ids[0]}/read`, 'PATCH', undefined, 'resident')).status, 200);
const readAt = sql.prepare('SELECT read_at FROM resident_notifications WHERE notification_id = ?').get(ids[0]).read_at;
assert.ok(readAt);
assert.equal((await request(`/notifications/${ids[0]}/read`, 'PATCH', undefined, 'resident')).status, 200);
assert.equal(sql.prepare('SELECT read_at FROM resident_notifications WHERE notification_id = ?').get(ids[0]).read_at, readAt);
assert.equal((await inbox()).unread_count, count() - 1);
assert.equal((await request('/notifications/read-all', 'PATCH', undefined, 'resident')).status, 200);
assert.equal((await request('/notifications/read-all', 'PATCH', undefined, 'resident')).status, 200);
assert.equal((await inbox()).unread_count, 0);
assert.equal((await request('/notifications?limit=51', 'GET', undefined, 'resident')).status, 400);
assert.equal((await request('/notifications?cursor=bad', 'GET', undefined, 'resident')).status, 400);
console.log('PASS notifications: auth, isolation, real submission/replay, generic/admin transitions, rollback, guest skip, deduplication, pagination and persistent reads');
sql.close();

