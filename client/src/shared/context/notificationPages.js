// Match the API's descending (created_at, notification_id) keyset ordering.
export function mergeNotificationPage(previous, fresh, append = false) {
  const records = new Map(previous.notifications.map(row => [row.id, row]));
  for (const row of fresh.notifications) records.set(row.id, row);
  return {
    ...fresh,
    notifications: [...records.values()].sort((a, b) => {
      const left = a.created_at + a.id;
      const right = b.created_at + b.id;
      return left < right ? 1 : left > right ? -1 : 0;
    }),
    // A newest-page refresh must not move the continuation back to page one.
    // null is meaningful: the oldest loaded page exhausted the inbox.
    next_cursor: append || previous.notifications.length === 0
      ? fresh.next_cursor : previous.next_cursor,
  };
}

export function applyNotificationRead(previous, id) {
  return {
    ...previous,
    // Only GET supplies the total count; concurrent arrivals may exist.
    notifications: previous.notifications.map(row => !id || row.id === id
      ? { ...row, is_read: 1 } : row),
  };
}
