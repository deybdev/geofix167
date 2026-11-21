export const MAX_ATTACHMENTS = 5;
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

export const canEditReport = report => Boolean(report && !report.is_terminal && [1, 2, 3].includes(report.status_id));
export const canUploadReport = (report, user) => Boolean(user?.id && report?.reported_by_user_id === user.id);

export function formatReportTime(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : 'Time unavailable';
}

export function validateEvidence(file) {
  const max = (file.type?.startsWith('video/') ? 25 : 10) * 1024 * 1024;
  if (!MEDIA_TYPES.includes(file.type) || !Number.isFinite(file.size) || file.size <= 0 || file.size > max) {
    throw new Error('Use JPEG, PNG or WebP photos up to 10 MiB, or MP4, WebM or MOV videos up to 25 MiB.');
  }
}

export function editPayload(description, address) {
  if (description.trim().length > 10000 || address.trim().length > 4000) {
    throw new Error('Description must be at most 10,000 characters and location at most 4,000.');
  }
  return { description_sanitized: description.trim(), location_description: address.trim() };
}

// Reconcile before and after attempts. Stable UUIDs also protect a retry when
// the server saved the file but the response (or the reconciliation GET) was lost.
export async function uploadEvidenceQueue({ reportId, items, list, upload, onSaved, onProgress }) {
  const confirmed = new Set();
  const reconcile = async () => {
    const { data } = await list(reportId);
    for (const item of items) {
      if (data.attachments.some(attachment => attachment.upload_id === item.id)) {
        confirmed.add(item.id);
        onSaved?.(item.id);
      }
    }
    return data.attachments;
  };
  let attachments = await reconcile();
  let errors = [];
  for (const item of items) {
    if (confirmed.has(item.id)) continue;
    onProgress?.(item.id);
    try {
      validateEvidence(item.file);
      await upload(reportId, item.file, item.id);
      confirmed.add(item.id);
      onSaved?.(item.id);
    } catch (error) {
      errors.push({ id: item.id, message: error.message || 'Upload failed. Retry this file.' });
    }
  }
  let listError = null;
  try { attachments = await reconcile(); } catch {
    listError = 'Uploads finished, but saved media could not be refreshed. Retry media before adding files.';
  }
  errors = errors.filter(error => !confirmed.has(error.id));
  return { attachments, errors, listError };
}
