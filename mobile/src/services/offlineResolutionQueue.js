import { File, Paths } from 'expo-file-system';

const QUEUE_FILENAME = 'geofix_offline_submission_queue.json';

function getQueueFile() {
  return new File(Paths.document, QUEUE_FILENAME);
}

/**
 * Offline-resilient submission queue for responder resolution forms (and future
 * resident mobile reports). Stores JSON payloads + base64 photos locally when
 * network signal drops, and auto-flushes when connectivity returns.
 */
export async function getOfflineQueue() {
  try {
    const file = getQueueFile();
    if (!file.exists) return [];
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveOfflineQueue(items) {
  try {
    const file = getQueueFile();
    file.write(JSON.stringify(items));
  } catch {
    // Ignore storage errors if filesystem is unavailable
  }
}

export function isNetworkError(err) {
  const msg = String(err?.message || '').toLowerCase();
  return (
    !err?.response &&
    (msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('failed to fetch') ||
      msg.includes('abort') ||
      err?.code === 'ERR_NETWORK' ||
      err?.code === 'ECONNABORTED')
  );
}

/**
 * @param {{ kind: 'agency_resolution' | 'tanod_qr_handover' | 'resident_report', dispatchId?: string, payload: object }} entry
 */
export async function enqueueOfflineSubmission(entry) {
  const current = await getOfflineQueue();
  const next = [
    ...current,
    {
      id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      queuedAt: new Date().toISOString(),
      ...entry,
    },
  ];
  await saveOfflineQueue(next);
  return next.length;
}

/**
 * Attempts to send all queued items using the provided handlers map.
 * Any item that still fails with a network error stays in the queue.
 */
export async function flushOfflineQueue(handlers = {}) {
  const current = await getOfflineQueue();
  if (current.length === 0) return { synced: 0, remaining: 0 };

  const remaining = [];
  let synced = 0;

  for (const item of current) {
    const handler = handlers[item.kind];
    if (typeof handler !== 'function') {
      remaining.push(item);
      continue;
    }
    try {
      await handler(item);
      synced += 1;
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(item);
      }
    }
  }

  await saveOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}
