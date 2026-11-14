import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const output = await build({entryPoints:['server/src/index.ts'], bundle:true, platform:'node', format:'esm', write:false});
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text + '\n//# sourceURL=attachment-worker-bundle.js').toString('base64')}`);
const sql = new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys = ON');
sql.exec(`CREATE TABLE roles(role_id INTEGER, code TEXT); CREATE TABLE account_statuses(status_id INTEGER, status_code TEXT);
CREATE TABLE users(user_id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, mobile_number TEXT, role_id INTEGER, account_status_id INTEGER, password_hash TEXT);
CREATE TABLE user_sessions_and_devices(user_id TEXT, token_hash TEXT, expires_at TEXT, revoked_at TEXT);
INSERT INTO roles VALUES(1,'resident'),(2,'admin'); INSERT INTO account_statuses VALUES(1,'ACTIVE');
INSERT INTO users VALUES('a','A','Resident','1',1,1,NULL),('b','B','Resident','2',1,1,NULL),('admin','Staff','Admin','3',2,1,NULL);`);
for (const file of ['0005_guest_incidents.sql','0006_review_alerts.sql','0007_dispatch_support.sql','0012_community_audit.sql','0015_admin_dispatch.sql','0017_report_attachments.sql']) sql.exec(readFileSync(`server/src/migrations/${file}`,'utf8'));
const hash = async s => Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
for (const id of ['a','b','admin']) sql.prepare('INSERT INTO user_sessions_and_devices(user_id,token_hash,expires_at) VALUES(?,?,?)').run(id,await hash(id),'2099-01-01');
const db = {prepare(query) { const stmt = sql.prepare(query); let args=[]; return { bind(...v){args=v;return this}, async first(){return stmt.get(...args) ?? null}, async all(){return {results:stmt.all(...args)}}, async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}} }; }, async batch(statements){sql.exec('BEGIN');try {const results=[];for(const stmt of statements) results.push(await stmt.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}};
// Use the actual local R2 implementation, with SQLite standing in for D1.
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default { fetch() { return new Response("ok") } }',
  compatibilityDate: '2026-10-23', r2Buckets: ['MEDIA'] }));
try {
  const bucket = await mf.getR2Bucket('MEDIA');
  const env = { geofix167_db: db, geofix167_uploads: bucket, FRONTEND_ORIGIN: 'http://localhost:5173',
    MEDIA_SIGNING_SECRET: 'integration-test-secret-at-least-32-characters' };
  const request = (path, options = {}, bindings = env) => app.request(path, options, bindings);
  const create = async () => {
    const response = await request('/api/reports', { method: 'POST', headers: { Cookie: 'geofix_session=a', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporter_type: 'RESIDENT', incident_category: 'Flood', description: 'Media report' }) });
    assert.equal(response.status, 201);
    return (await response.json()).report.incident_id;
  };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOc8AAAAASUVORK5CYII=', 'base64');
  const photo = () => new File([png], 'incident.png', { type: 'image/png' });
  const upload = (reportId, file = photo(), uploadId = crypto.randomUUID(), cookie = 'a', bindings = env) => {
    const form = new FormData();
    if (file) form.append('file', file);
    form.append('upload_id', uploadId);
    return request(`/api/reports/${reportId}/attachments`, { method: 'POST',
      headers: cookie ? { Cookie: `geofix_session=${cookie}` } : {}, body: form }, bindings);
  };
  const list = (id, cookie = 'a') => request(`/api/reports/${id}/attachments`, { headers: cookie ? { Cookie: `geofix_session=${cookie}` } : {} });
  const id = await create();
  assert.equal((await upload(id, photo(), crypto.randomUUID(), null)).status, 401);
  assert.equal((await upload(id, photo(), crypto.randomUUID(), 'b')).status, 404);
  assert.equal((await upload(id, photo(), crypto.randomUUID(), 'admin')).status, 403);
  assert.equal((await upload('missing')).status, 404);
  assert.equal((await upload(id, null)).status, 400);
  assert.equal((await upload(id, photo(), 'not-a-uuid')).status, 400);
  assert.equal((await upload(id, new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))).status, 415);
  assert.equal((await upload(id, new File(['fake'], 'x.png', { type: 'image/png' }))).status, 415);
  assert.equal((await upload(id, new File([], 'empty.png', { type: 'image/png' }))).status, 413);
  assert.equal((await upload(id, new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).status, 413);
  assert.equal((await upload(id, new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.mp4', { type: 'video/mp4' }))).status, 413);
  const oversized = await request(`/api/reports/${id}/attachments`, { method: 'POST', headers: {
    Cookie: 'geofix_session=a', 'Content-Type': 'multipart/form-data; boundary=x', 'Content-Length': String(26 * 1024 * 1024),
  }, body: 'x' });
  assert.equal(oversized.status, 413);
  const multiple = new FormData(); multiple.append('file', photo()); multiple.append('file', photo()); multiple.append('upload_id', crypto.randomUUID());
  assert.equal((await request(`/api/reports/${id}/attachments`, { method: 'POST', headers: { Cookie: 'geofix_session=a' }, body: multiple })).status, 400);
  assert.equal((await upload(id, photo(), crypto.randomUUID(), 'a', { ...env, MEDIA_SIGNING_SECRET: '' })).status, 503);
  assert.equal((await bucket.list()).objects.length, 0);

  const uploadId = crypto.randomUUID();
  let response = await upload(id, photo(), uploadId);
  assert.equal(response.status, 201, await response.clone().text());
  const { attachment } = await response.json();
  assert.equal(attachment.media_type, 'PHOTO');
  const row = sql.prepare('SELECT * FROM incident_media WHERE incident_media_id=?').get(attachment.id);
  assert.equal(row.media_url, `/api/media/${attachment.id}`);
  assert.equal(row.byte_size, png.length);
  assert.equal(row.uploaded_by_user_id, 'a');
  assert.equal(row.original_filename, 'incident.png');
  assert.equal(row.content_sha256, Buffer.from(await crypto.subtle.digest('SHA-256', png)).toString('hex'));
  assert.deepEqual(Buffer.from(await (await bucket.get(row.storage_key)).arrayBuffer()), png);
  assert.equal((await upload(id, photo(), uploadId)).status, 200);
  const different = new File([png, 'different'], 'other.png', { type: 'image/png' });
  assert.equal((await upload(id, different, uploadId)).status, 409);
  assert.equal((await bucket.list()).objects.length, 1);
  assert.equal((await list(id, null)).status, 401);
  assert.equal((await list(id, 'b')).status, 404);
  assert.equal((await list(id, 'admin')).status, 200);
  assert.equal((await (await list(id)).json()).attachments.length, 1);
  response = await request(attachment.url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.equal((await request(`/api/media/${attachment.id}`)).status, 403);
  const expired = new URL(attachment.url, 'http://localhost'); expired.searchParams.set('expires', '1');
  assert.equal((await request(expired.pathname + expired.search)).status, 403);
  assert.equal((await request(attachment.url.replace(attachment.id, crypto.randomUUID()))).status, 403);
  response = await request(attachment.url, { headers: { Range: 'bytes=2-9' } });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), `bytes 2-9/${png.length}`);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png.subarray(2, 10));
  response = await request(attachment.url, { headers: { Range: 'bytes=-4' } });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png.subarray(-4));
  response = await request(attachment.url, { headers: { Range: 'bytes=4-' } });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png.subarray(4));
  assert.equal((await request(attachment.url, { headers: { Range: 'bytes=9999-' } })).status, 416);
  assert.equal((await request(attachment.url, { headers: { Range: 'bytes=-0' } })).status, 416);
  assert.equal((await request(attachment.url, { method: 'HEAD' })).status, 200);

  // Container-signature fixtures test validation/storage, not video codec decoding.
  for (const [mime, bytes] of [['video/mp4', Buffer.from('0000ftypisom0000')], ['video/quicktime', Buffer.from('0000ftypqt  0000')],
    ['video/webm', Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 1, 2, 3])]]) {
    response = await upload(id, new File([bytes], 'clip', { type: mime }));
    assert.equal(response.status, 201, await response.clone().text());
    assert.equal((await response.json()).attachment.media_type, 'VIDEO');
  }
  const capResults = await Promise.all([upload(id), upload(id), upload(id)]);
  assert.deepEqual(capResults.map(r => r.status).sort(), [201, 409, 409]);
  assert.equal(sql.prepare('SELECT count(*) n FROM incident_media WHERE incident_id=?').get(id).n, 5);
  assert.equal((await bucket.list()).objects.length, 5);
  assert.equal((await upload(id, photo(), uploadId)).status, 200);

  // Simultaneous retries share one row and clean up the losing R2 object.
  const raceId = await create(); const raceKey = crypto.randomUUID();
  const race = await Promise.all([upload(raceId, photo(), raceKey), upload(raceId, photo(), raceKey)]);
  assert.deepEqual(race.map(r => r.status).sort(), [200, 201]);
  assert.equal(sql.prepare('SELECT count(*) n FROM incident_media WHERE incident_id=?').get(raceId).n, 1);
  assert.equal((await bucket.list()).objects.length, 6);

  const failureId = await create();
  sql.exec(`CREATE TRIGGER reject_media BEFORE INSERT ON incident_media WHEN NEW.incident_id='${failureId}' BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
  assert.equal((await upload(failureId)).status, 500);
  assert.equal((await bucket.list()).objects.length, 6);
  sql.exec('DROP TRIGGER reject_media');
  const failedBucket = { put: async () => { throw new Error('Simulated R2 outage'); } };
  assert.equal((await upload(failureId, photo(), crypto.randomUUID(), 'a', { ...env, geofix167_uploads: failedBucket })).status, 500);
  assert.equal(sql.prepare('SELECT count(*) n FROM incident_media WHERE incident_id=?').get(failureId).n, 0);
  // Exercise the real browser service adapter against Hono, including a lost
  // response after a successful upload. Retrying must not create another row.
  const residentService = await import('../../client/src/services/residentService.js');
  const originalFetch = globalThis.fetch;
  let loseUploadResponse = true;
  globalThis.fetch = async (path, options) => {
    assert.equal(options.credentials, 'include');
    const headers = new Headers(options.headers);
    headers.set('Cookie', 'geofix_session=a');
    if (options.body instanceof FormData) assert.equal(headers.has('Content-Type'), false);
    const response = await request(path, { ...options, headers });
    if (options.body instanceof FormData && loseUploadResponse) {
      loseUploadResponse = false;
      throw new TypeError('Simulated lost response');
    }
    return response;
  };
  try {
    const { data } = await residentService.submitReport({ reporter_type: 'RESIDENT', incident_category: 'Flood', description: 'Client upload' });
    const clientId = data.report.public_id;
    const clientKey = crypto.randomUUID();
    await assert.rejects(residentService.uploadReportAttachment(clientId, photo(), clientKey), /Could not connect/);
    const replay = await residentService.uploadReportAttachment(clientId, photo(), clientKey);
    assert.equal(replay.idempotent_replay, true);
    const details = await residentService.getReportDetails(clientId);
    assert.equal(details.data.report.attachments.length, 1);
    assert.equal(details.data.report.attachments[0].id, replay.attachment.id);
    assert.equal(sql.prepare('SELECT count(*) n FROM incident_reports WHERE incident_id=?').get(clientId).n, 1);
  } finally { globalThis.fetch = originalFetch; }
  console.log('PASS attachments: local R2 bytes, migration, validation, ownership, signatures, ranges, retries, concurrency, caps and failure cleanup');
} finally {
  await mf.dispose();
  sql.close();
}
