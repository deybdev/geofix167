import { uploadEvidenceQueue, validateEvidence } from './residentReport';

export function prepareReportPhoto(asset, { randomUUID, fileInfo }) {
  const info = fileInfo(asset.uri);
  const extension = asset.uri.split(/[?#]/)[0].split('.').pop().toLowerCase();
  const type = asset.mimeType || info.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' })[extension];
  const file = {
    uri: asset.uri,
    name: asset.fileName || `photo-${randomUUID()}.${({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[type] || extension}`,
    type,
    size: asset.fileSize ?? info.size,
  };
  validateEvidence(file);
  return { id: randomUUID(), file };
}

// The caller retains this session until every file is confirmed saved.
export async function submitResidentEvidence(session, { payload, items, create, list, upload, randomUUID }) {
  if (session.busy || session.complete) return null;
  session.busy = true;
  try {
    if (!session.report) {
      if (!session.payload) {
        items.forEach(item => validateEvidence(item.file));
        session.payload = { ...payload, idempotency_key: randomUUID() };
        session.pending = [...items];
      }
      // The server replays the same owner/key after an ambiguous response loss.
      // Freeze the payload so retry cannot silently submit changed details.
      const result = await create(session.payload);
      session.report = result.data.report;
    }
    const reportId = session.report.public_id;
    if (!reportId) throw new Error('The created report has no reference ID. Please contact support.');
    const result = await uploadEvidenceQueue({
      reportId, items: [...session.pending], list, upload, onProgress: undefined,
      onSaved: id => { session.pending = session.pending.filter(item => item.id !== id); },
    });
    session.pending = session.pending.map(item => ({ ...item, error: result.errors.find(error => error.id === item.id)?.message }));
    session.complete = session.pending.length === 0;
    return session;
  } catch (error) {
    // These responses reject creation before a report is saved; allow edits.
    if (!session.report && [400, 401, 403, 413, 415, 422].includes(error.status)) {
      session.payload = null;
    }
    throw error;
  } finally {
    session.busy = false;
  }
}

export function pendingEvidenceMessage(session) {
  return `Report submitted. Some photos still need to upload.\n${session.report.reference_number || session.report.public_id || ''}\n${session.pending.map(item => item.file.name).join('\n')}`;
}
