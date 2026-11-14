// Recovery for report attachments whose upload did not finish (failed, lost
// response, refresh, or tab close). File objects are never serialized: only
// small attempt metadata is persisted, and a reselected file must match the
// recorded SHA-256, MIME type and byte size before its upload_id is reused.
// The server stays authoritative for ownership, idempotency and the file cap.
import { getReportAttachments, uploadReportAttachment } from "../../services/residentService.js";

export const MAX_ATTACHMENTS = 5;
const PREFIX = "geofix167:upload-attempts:v1";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const PERSISTENCE_WARNING =
  "Recovery after closing this page is unavailable (browser storage is blocked or full). Keep this page open until uploads finish.";

const hashes = new WeakMap();

/** SHA-256 of a File's bytes, cached per File object. */
export function sha256File(file) {
  if (!hashes.has(file)) {
    const pending = (async () => {
      if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is unavailable in this browser context.");
      const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    })();
    pending.catch(() => hashes.delete(file));
    hashes.set(file, pending);
  }
  return hashes.get(file);
}

export async function describeAttempt(item) {
  return {
    upload_id: item.id, sha256: await sha256File(item.file),
    type: item.file.type, size: item.file.size, name: String(item.file.name ?? "").slice(0, 255),
  };
}

export const attemptStorageKey = (userId, incidentId) =>
  `${PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(incidentId)}`;

function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

const validAttempt = attempt => attempt && UUID.test(attempt.upload_id) && /^[a-f0-9]{64}$/.test(attempt.sha256) &&
  typeof attempt.type === "string" && Number.isSafeInteger(attempt.size) && attempt.size > 0 &&
  typeof attempt.name === "string" && Number.isFinite(attempt.recorded_at);

/**
 * Attempt metadata scoped to one authenticated user and one incident.
 * Every method degrades to a no-op (reporting failure) when storage is
 * unavailable, so the in-memory upload flow keeps working.
 */
export function createAttemptStore({ userId, incidentId, storage = browserStorage(), now = Date.now } = {}) {
  const key = userId && incidentId ? attemptStorageKey(userId, incidentId) : null;
  let available = Boolean(key && storage);
  let failed = false;
  if (available) {
    try {
      storage.setItem(`${PREFIX}:probe`, "1");
      storage.removeItem(`${PREFIX}:probe`);
    } catch { available = false; }
  }
  function load() {
    if (!available) return [];
    try {
      const saved = JSON.parse(storage.getItem(key) || "null");
      if (saved?.version !== 1 || !Array.isArray(saved.attempts)) return [];
      return saved.attempts.filter(attempt => validAttempt(attempt) && now() - attempt.recorded_at < TTL_MS);
    } catch { return []; }
  }
  function write(attempts) {
    if (!available) return false;
    try {
      if (attempts.length) storage.setItem(key, JSON.stringify({ version: 1, attempts }));
      else storage.removeItem(key);
      return true;
    } catch {
      failed = true; // e.g. QuotaExceededError
      return false;
    }
  }
  return {
    /** True while recovery after closing the page is still possible. */
    get persistent() { return available && !failed; },
    load,
    record(attempt) {
      const recorded = load().find(existing => existing.upload_id === attempt.upload_id);
      const next = load().filter(existing => existing.upload_id !== attempt.upload_id);
      return write([...next, { ...attempt, recorded_at: recorded?.recorded_at ?? now() }]);
    },
    remove(uploadIds) {
      const ids = new Set(uploadIds);
      const attempts = load();
      const next = attempts.filter(attempt => !ids.has(attempt.upload_id));
      return next.length === attempts.length || write(next);
    },
  };
}

export const savedUploadIds = attachments =>
  new Set((attachments ?? []).map(attachment => attachment.upload_id).filter(Boolean));

/** Splits queued items and persisted attempts into confirmed vs unresolved, using server upload_ids. */
export function reconcileUploads({ queue = [], attempts = [], attachments }) {
  const saved = savedUploadIds(attachments);
  const confirmed = new Set([...queue.map(item => item.id), ...attempts.map(attempt => attempt.upload_id)]
    .filter(id => saved.has(id)));
  return {
    confirmed: [...confirmed],
    queue: queue.filter(item => !saved.has(item.id)),
    attempts: attempts.filter(attempt => !saved.has(attempt.upload_id)),
  };
}

/** Returns the unresolved attempt whose content matches this file, never by filename alone. */
export async function matchReselectedFile(file, attempts, boundIds = new Set()) {
  const sha256 = await sha256File(file);
  return attempts.find(attempt => !boundIds.has(attempt.upload_id) &&
    attempt.sha256 === sha256 && attempt.type === file.type && attempt.size === file.size) ?? null;
}

/**
 * ambiguous: the server may have saved the file (network error, 5xx); reconcile.
 * rejected:  the server refused this file or request; retrying cannot succeed.
 * retryable: not saved, but the attempt stays recoverable (session, cap or conflict).
 */
export function classifyUploadError(error) {
  const status = error?.status;
  if (!status || status >= 500 || status === 408 || status === 429) return "ambiguous";
  if ([400, 403, 404, 413, 415].includes(status)) return "rejected";
  return "retryable";
}

async function listSaved(reportId, list) {
  try {
    return { attachments: (await list(reportId)).data.attachments, error: null };
  } catch (error) {
    return { attachments: null, error: error.message || "Unable to load photos and videos." };
  }
}

/**
 * Sequentially uploads queue items, reusing each item's id as its upload_id.
 * Reconciles before sending and after ambiguous failures; when listing fails,
 * unresolved attempts are preserved and server idempotency covers retries.
 */
export async function uploadQueue({
  reportId, items, store, uploadedIds, onProgress,
  upload = uploadReportAttachment, list = getReportAttachments,
}) {
  const markSaved = ids => {
    for (const id of ids) uploadedIds.add(id);
    if (ids.length) store?.remove(ids);
  };
  const before = await listSaved(reportId, list);
  if (before.attachments) {
    const saved = savedUploadIds(before.attachments);
    markSaved(items.map(item => item.id).filter(id => saved.has(id)));
  }
  const pending = items.filter(item => !uploadedIds.has(item.id));
  let persistent = Boolean(store?.persistent);
  // Record every attempt before the first request so a refresh mid-queue remains recoverable.
  for (const item of pending) {
    try {
      if (!store?.record(await describeAttempt(item))) persistent = false;
    } catch { persistent = false; }
  }
  let errors = [];
  for (const [index, item] of pending.entries()) {
    onProgress?.({ index, total: pending.length, item });
    try {
      await upload(reportId, item.file, item.id);
      markSaved([item.id]);
    } catch (error) {
      const kind = classifyUploadError(error);
      if (kind === "rejected") store?.remove([item.id]);
      errors.push({ id: item.id, name: item.file.name, message: error.message || "Upload failed.", status: error.status ?? null, kind });
    }
  }
  let after = null;
  if (errors.some(error => error.kind === "ambiguous")) {
    after = await listSaved(reportId, list);
    if (after.attachments) {
      const saved = savedUploadIds(after.attachments);
      markSaved(errors.map(error => error.id).filter(id => saved.has(id)));
      errors = errors.filter(error => !saved.has(error.id));
    }
  }
  return {
    errors, uploaded: pending.filter(item => uploadedIds.has(item.id)).length,
    attachments: after?.attachments ?? null, listError: after?.error ?? null,
    persistent: persistent && Boolean(store?.persistent),
  };
}

