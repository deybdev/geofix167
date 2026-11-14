import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../shared/components/ui/button";
import MediaPicker from "./MediaPicker";
import {
  createAttemptStore, MAX_ATTACHMENTS, matchReselectedFile, PERSISTENCE_WARNING, savedUploadIds, uploadQueue,
} from "../uploadRecovery";

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Lets the reporting resident finish interrupted uploads or add new media.
 * - Queue items carried over in router state still hold their File objects;
 *   they upload only when the resident presses the button.
 * - Attempts recovered from storage have no File: the resident must reselect
 *   the same file (manual recovery). Nothing resumes automatically.
 * attachments === null means the saved list is unknown (listing failed).
 */
export default function AttachmentRecovery({ reportId, userId, attachments, initialItems, onUploaded }) {
  const store = useMemo(() => createAttemptStore({ userId, incidentId: reportId }), [userId, reportId]);
  const [queue, setQueue] = useState(initialItems);
  const [attempts, setAttempts] = useState(() => store.load());
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [persistWarning, setPersistWarning] = useState(store.persistent ? "" : PERSISTENCE_WARNING);
  const busyRef = useRef(false);
  const uploadedIds = useRef(new Set());

  // Confirmed successes are reconciled first, even when all slots are full.
  const saved = useMemo(() => attachments ? savedUploadIds(attachments) : null, [attachments]);
  const pendingQueue = queue.filter(item => !saved?.has(item.id));
  const queuedIds = new Set(pendingQueue.map(item => item.id));
  const awaiting = attempts.filter(attempt => !saved?.has(attempt.upload_id) && !queuedIds.has(attempt.upload_id));
  const recovered = saved ? queue.filter(item => saved.has(item.id)).length +
    attempts.filter(attempt => saved.has(attempt.upload_id) && !queue.some(item => item.id === attempt.upload_id)).length : 0;
  const remaining = attachments ? Math.max(0, MAX_ATTACHMENTS - attachments.length) : null;

  useEffect(() => {
    if (!saved) return;
    const confirmed = attempts.map(attempt => attempt.upload_id).filter(id => saved.has(id));
    if (confirmed.length) store.remove(confirmed);
  }, [saved, attempts, store]);

  function changeQueue(next) {
    // Removing a queued file also forgets its recovery record.
    const kept = new Set(next.map(item => item.id));
    const removed = pendingQueue.filter(item => !kept.has(item.id)).map(item => item.id);
    if (removed.length) {
      store.remove(removed);
      setAttempts(store.load());
      setErrors(previous => previous.filter(error => !removed.includes(error.id)));
    }
    setQueue(previous => previous.filter(item => kept.has(item.id) || saved?.has(item.id)));
  }

  async function addFiles(selected) {
    setMatching(true);
    setNotice("");
    const bound = new Set(pendingQueue.map(item => item.id));
    const added = [];
    let matched = 0;
    for (const file of selected) {
      let attempt = null;
      try { attempt = await matchReselectedFile(file, awaiting, bound); } catch { /* hashing unavailable: new upload */ }
      const id = attempt?.upload_id ?? crypto.randomUUID();
      if (attempt) matched += 1;
      bound.add(id);
      added.push({ id, file, label: attempt ? "Matches an interrupted upload" : "New file" });
    }
    setQueue(previous => [...previous, ...added]);
    setMatching(false);
    if (awaiting.length) {
      setNotice(matched
        ? `${plural(matched, "file")} matched an interrupted upload by content and will reuse its original upload.` +
          (added.length > matched ? ` ${plural(added.length - matched, "file")} will upload as new.` : "")
        : "The selected files did not match any interrupted upload (content, type and size are compared, not names). They will upload as new files.");
    }
  }

  async function runUploads() {
    if (busyRef.current || matching || !pendingQueue.length) return;
    busyRef.current = true;
    setBusy(true);
    setErrors([]);
    setNotice("");
    try {
      const result = await uploadQueue({
        reportId, items: pendingQueue, store, uploadedIds: uploadedIds.current,
        onProgress: ({ index, total, item }) => setProgress(`Uploading ${index + 1} of ${total}: ${item.file.name}`),
      });
      setQueue(previous => previous.filter(item => !uploadedIds.current.has(item.id)));
      setAttempts(store.load());
      setErrors(result.errors);
      setPersistWarning(result.persistent ? "" : PERSISTENCE_WARNING);
      setProgress(result.errors.length
        ? `${plural(result.uploaded, "file")} uploaded; ${result.errors.length} still pending.`
        : `${plural(result.uploaded, "file")} uploaded.`);
      if (result.listError) setNotice(`Could not confirm which uploads finished: ${result.listError} Unconfirmed files stay queued.`);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    await onUploaded?.();
  }

  function forget(uploadId) {
    store.remove([uploadId]);
    setAttempts(store.load());
  }

  const errorFor = new Map(errors.map(error => [error.id, error]));
  const items = pendingQueue.map(item => errorFor.has(item.id)
    ? { ...item, label: `Failed: ${errorFor.get(item.id).message}` } : item);

  return <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 p-4" aria-label="Add photos or videos" aria-busy={busy}>
    <h2 className="text-sm font-semibold">Add photos or videos</h2>
    {remaining !== null
      ? <p className="text-xs text-slate-500">{plural(attachments.length, "file")} saved; {plural(remaining, "slot")} left of {MAX_ATTACHMENTS}.</p>
      : <p className="text-xs text-amber-700">Saved media could not be checked, so remaining slots are unknown. The server still enforces the {MAX_ATTACHMENTS}-file limit.</p>}
    {recovered > 0 && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
      {plural(recovered, "earlier upload")} turned out to be saved already and {recovered === 1 ? "was" : "were"} removed from the queue.</p>}
    {persistWarning && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{persistWarning}</p>}
    {remaining !== null && pendingQueue.length > remaining && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
      {plural(pendingQueue.length, "file")} queued but only {plural(remaining, "slot")} left. Remove {pendingQueue.length - remaining} or the server will reject the extra uploads.</p>}

    {awaiting.length > 0 && <div className="rounded-lg bg-slate-50 p-3 text-xs">
      <p className="font-semibold text-slate-800">Interrupted uploads: manual recovery needed</p>
      <p className="mt-1 text-slate-600">These uploads were started but not confirmed before the page closed. They will not resume on their own.
        Reselect the same file to finish it; its contents are checked before the original upload is reused.</p>
      <ul className="mt-2 space-y-1">{awaiting.map(attempt => <li key={attempt.upload_id} className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{attempt.name || "Unnamed file"} ({Math.ceil(attempt.size / 1024)} KiB)</span>
        <button type="button" onClick={() => forget(attempt.upload_id)} disabled={busy}
          className="font-semibold text-primary underline disabled:opacity-50">Forget</button>
      </li>)}</ul>
    </div>}

    <MediaPicker files={items} onChange={changeQueue} onAdd={addFiles} hideCamera disabled={busy || matching}
      maxFiles={remaining ?? MAX_ATTACHMENTS} hint="Files upload to this report when you press the button below." />
    {matching && <p role="status" className="text-xs text-slate-500">Checking selected files…</p>}
    {progress && <p role="status" aria-live="polite" className="text-xs text-slate-600">{progress}</p>}
    {notice && <p role="status" className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{notice}</p>}
    {pendingQueue.length > 0 && <Button type="button" onClick={runUploads} disabled={busy || matching} className="h-11 w-full rounded-xl text-sm font-semibold">
      {busy ? "Uploading…" : errors.length ? "Retry failed uploads" : "Upload selected media"}</Button>}
  </section>;
}
