import assert from 'node:assert/strict';
import test from 'node:test';
import { applyNotificationRead, mergeNotificationPage } from '../src/shared/context/notificationPages.js';

const row = (id, is_read = 0) => ({ id, created_at: '2026-11-16T00:00:00.000Z', is_read });
const page = (ids, next_cursor, unread_count = 12) => ({ notifications: ids.map(id => row(id)), next_cursor, unread_count });
const loaded = () => mergeNotificationPage(page(['f', 'e'], 'page-two'), page(['d', 'c'], 'page-three'), true);

for (const cause of ['polling', 'focus', 'manual refresh']) {
  test(`Load more then ${cause} retains older rows and cursor`, () => {
    const previous = loaded();
    const fresh = { ...page(['g', 'f'], 'new-page-two', 13), notifications: [row('g'), row('f', 1)] };
    const result = mergeNotificationPage(previous, fresh);
    assert.deepEqual(result.notifications.map(n => n.id), ['g', 'f', 'e', 'd', 'c']);
    assert.equal(result.notifications.find(n => n.id === 'f').is_read, 1);
    assert.equal(result.next_cursor, 'page-three');
    assert.equal(result.unread_count, 13);
    const more = mergeNotificationPage(result, page(['c', 'b', 'a'], null), true);
    assert.deepEqual(more.notifications.map(n => n.id), ['g', 'f', 'e', 'd', 'c', 'b', 'a']);
    assert.equal(mergeNotificationPage(more, fresh).next_cursor, null);
  });
}

test('mark one on an older page then refresh preserves the read and pagination', () => {
  const marked = applyNotificationRead(loaded(), 'c');
  assert.equal(marked.unread_count, 12, 'retain last server count until GET completes');
  const refreshed = mergeNotificationPage(marked, page(['f', 'e'], 'page-two', 11));
  assert.equal(refreshed.notifications.find(n => n.id === 'c').is_read, 1);
  assert.equal(refreshed.next_cursor, 'page-three');
  assert.equal(refreshed.unread_count, 11);
});

test('mark all updates every loaded page; concurrent arrivals use server unread count', () => {
  const marked = applyNotificationRead(loaded(), null);
  assert.ok(marked.notifications.every(n => n.is_read === 1));
  const fresh = { ...page(['g', 'f'], 'new-page-two', 1), notifications: [row('g'), row('f', 1)] };
  const refreshed = mergeNotificationPage(marked, fresh);
  assert.ok(refreshed.notifications.filter(n => n.id !== 'g').every(n => n.is_read === 1));
  assert.equal(refreshed.unread_count, 1);
  assert.equal(refreshed.next_cursor, 'page-three');
});

test('first load adopts cursor and timestamp ordering precedes ID ordering', () => {
  const fresh = page(['z', 'a'], 'next');
  fresh.notifications[1].created_at = '2026-11-17T00:00:00.000Z';
  const result = mergeNotificationPage({ notifications: [], next_cursor: null }, fresh);
  assert.deepEqual(result.notifications.map(n => n.id), ['a', 'z']);
  assert.equal(result.next_cursor, 'next');
});
