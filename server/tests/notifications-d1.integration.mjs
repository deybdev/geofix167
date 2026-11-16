import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

// Real, ephemeral local D1 validates trigger behavior beyond the SQLite adapter.
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true,
  script: 'export default { fetch() { return new Response("ok") } }',
  compatibilityDate: '2026-10-23', d1Databases: ['DB'] }));
try {
  const db = await mf.getD1Database('DB');
  await db.exec('CREATE TABLE users(user_id TEXT PRIMARY KEY);');
  const apply = async name => {
    const sql = readFileSync(new URL('../src/migrations/' + name, import.meta.url), 'utf8');
    await db.exec(sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' '));
  };
  await apply('0005_guest_incidents.sql');
  await apply('0019_resident_report_notifications.sql');
  await db.prepare("INSERT INTO users VALUES ('resident')").run();
  await db.prepare(`INSERT INTO incident_reports (incident_id, reported_by_user_id, incident_status_id, title, description_original)
    VALUES ('report', 'resident', 1, 'Report', 'Test report')`).run();
  const transition = (from, to, event) => db.batch([
    db.prepare('UPDATE incident_reports SET incident_status_id = ? WHERE incident_id = ? AND incident_status_id = ?').bind(to, 'report', from),
    db.prepare(`INSERT INTO incident_status_events (incident_status_event_id, incident_id, to_incident_status_id)
      SELECT ?, 'report', ? WHERE changes() = 1`).bind(event, to),
    db.prepare('SELECT changes() AS n'),
  ]);
  const changed = await transition(1, 2, 'event');
  assert.equal(changed[2].results[0].n, 1);
  assert.equal(await db.prepare('SELECT count(*) n FROM resident_notifications').first('n'), 1);
  const stale = await transition(1, 3, 'stale');
  assert.equal(stale[2].results[0].n, 0);
  assert.equal(await db.prepare('SELECT count(*) n FROM resident_notifications').first('n'), 1);
  await db.exec("CREATE TRIGGER fail_notification BEFORE INSERT ON resident_notifications BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  await assert.rejects(transition(2, 4, 'rollback'), /test failure/);
  assert.equal(await db.prepare("SELECT incident_status_id FROM incident_reports WHERE incident_id = 'report'").first('incident_status_id'), 2);
  assert.equal(await db.prepare('SELECT count(*) n FROM incident_status_events').first('n'), 1);
  console.log('PASS local D1: additive migration, trigger, changes(), stale transition and atomic rollback');
} finally { await mf.dispose(); }
