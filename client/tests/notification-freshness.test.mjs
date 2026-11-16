import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationRequests } from '../src/shared/context/notificationRequests.js';
import { mergeNotificationPage, applyNotificationRead } from '../src/shared/context/notificationPages.js';
import { submitReport, getNotifications } from '../src/services/residentService.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const page = (id, count = 1) => ({ data: { notifications: [{ id, created_at: '2026-11-16T00:00:00.000Z', is_read: 0 }], unread_count: count, next_cursor: 'oldest-cursor' } });
function setup(get, read = async () => {}) {
  let state = { notifications: [], unread_count: 0, next_cursor: null };
  const errors = [], writeErrors = [];
  const requests = createNotificationRequests({ get, read,
    onPage: (fresh, append) => { state = mergeNotificationPage(state, fresh, append); },
    onRead: id => { state = applyNotificationRead(state, id); },
    onError: error => { if (error) errors.push(error); },
    onWriteError: error => { if (error) writeErrors.push(error); },
    onLoading() {}, onWriting() {},
  });
  return { requests, errors, writeErrors, state: () => state };
}

test('successful submission then inbox entry queues one fresh GET behind an older GET', async () => {
  const original = globalThis.fetch;
  const old = deferred();
  let posts = 0, gets = 0;
  globalThis.fetch = async url => {
    if (url === '/api/reports') {
      posts++;
      return new Response(JSON.stringify({ report: { incident_id: 'report', incident_status_id: 1 } }), { status: 201 });
    }
    gets++;
    if (gets === 1) return old.promise;
    return new Response(JSON.stringify(page('new', 2).data));
  };
  const h = setup(getNotifications);
  try {
    h.requests.refresh(); // earlier polling request
    await tick();
    const saved = await submitReport({ description: 'Report' });
    assert.equal(saved.data.report.public_id, 'report');
    h.requests.refresh(); // Report's confirmed-success callback
    h.requests.refresh(); // Alerts entry effect
    h.requests.refresh(); // simultaneous focus
    assert.equal(gets, 1);
    old.resolve(new Response(JSON.stringify(page('old').data)));
    await tick(); await tick();
    assert.equal(posts, 1);
    assert.equal(gets, 2);
    assert.equal(h.state().unread_count, 2);
    assert.deepEqual(new Set(h.state().notifications.map(n => n.id)), new Set(['old', 'new']));
    assert.equal(h.state().next_cursor, 'oldest-cursor');
  } finally { h.requests.dispose(); globalThis.fetch = original; }
});

test('idle inbox entry refreshes immediately and synchronous callers coalesce', async () => {
  let calls = 0;
  const h = setup(async () => { calls++; return page('new'); });
  h.requests.refresh(); h.requests.refresh();
  await tick();
  assert.equal(calls, 1);
  assert.equal(h.state().notifications[0].id, 'new');
  h.requests.dispose();
});

test('refresh during a write runs once afterward and retains loaded rows', async () => {
  let calls = 0;
  const write = deferred();
  const h = setup(async () => { calls++; return calls === 1 ? page('old') : page('new'); }, () => write.promise);
  h.requests.refresh(); await tick();
  const marking = h.requests.markRead('old');
  h.requests.refresh(); h.requests.refresh();
  assert.equal(calls, 1);
  write.resolve(); await marking; await tick();
  assert.equal(calls, 2);
  assert.equal(h.state().notifications.find(n => n.id === 'old').is_read, 1);
  h.requests.dispose();
});

test('cleanup drops queued account work and ignores late results', async () => {
  const pending = deferred(); let signal, calls = 0;
  const h = setup(options => { signal = options.signal; calls++; return pending.promise; });
  h.requests.refresh(); await tick();
  h.requests.refresh();
  h.requests.dispose();
  assert.ok(signal.aborted);
  pending.resolve(page('old-account')); await tick();
  assert.equal(calls, 1);
  assert.equal(h.state().notifications.length, 0);
  assert.deepEqual(h.errors, []);
});

test('mark-read intentionally aborts a GET and only the post-write refresh updates state', async () => {
  const old = deferred(), write = deferred();
  let calls = 0, signal;
  const h = setup(options => {
    calls++;
    if (calls === 1) { signal = options.signal; return old.promise; }
    return Promise.resolve(page('fresh'));
  }, () => write.promise);
  h.requests.refresh(); await tick();
  const marking = h.requests.markRead('old');
  assert.ok(signal.aborted);
  h.requests.refresh();
  old.resolve(page('stale')); await tick();
  assert.equal(h.state().notifications.length, 0);
  assert.equal(calls, 1);
  write.resolve(); await marking; await tick();
  assert.equal(calls, 2);
  assert.equal(h.state().notifications[0].id, 'fresh');
  assert.deepEqual(h.errors, []);
  h.requests.dispose();
});

test('effect cleanup/setup replay reactivates requests without accepting canceled results', async () => {
  const old = deferred(); let calls = 0;
  const h = setup(() => ++calls === 1 ? old.promise : Promise.resolve(page('fresh')));
  const callback = h.requests.refresh;
  h.requests.refresh(); await tick();
  h.requests.dispose(); h.requests.activate(); h.requests.refresh();
  old.resolve(page('stale')); await tick();
  assert.equal(callback, h.requests.refresh);
  assert.deepEqual(h.state().notifications.map(n => n.id), ['fresh']);
  h.requests.dispose();
});

test('intentional AbortError is normal, genuine fetch/write failures remain visible', async () => {
  const h = setup(async () => { throw new DOMException('Canceled', 'AbortError'); });
  h.requests.refresh(); await tick();
  assert.deepEqual(h.errors, []);
  h.requests.dispose();
  const failed = setup(async () => { throw new TypeError('Failed to fetch'); }, async () => { throw new Error('Server 500'); });
  assert.doesNotThrow(() => failed.requests.refresh(), 'refresh cannot fail a successful submission');
  await tick();
  assert.deepEqual(failed.errors, ['Failed to fetch']);
  assert.equal(await failed.requests.markRead('id'), false);
  assert.deepEqual(failed.writeErrors, ['Server 500']);
  failed.requests.dispose();
});
