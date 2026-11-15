import type { Context } from "hono";
import type { AppEnv } from "../types/env";
import { getIncidentReportDetails, ReportError } from "../services/report.service";
import { attachmentResponse, findUpload, MAX_ATTACHMENTS, validateMedia, type Attachment } from "../services/attachment.service";

function failure(c: Context<AppEnv>, error: unknown) {
  if (error instanceof ReportError) return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404 | 409 | 413 | 415 | 503);
  console.error("Attachment operation failed:", error);
  return c.json({ error: "Unable to save media. Your report is saved; retry the upload." }, 500);
}

export async function listAttachments(c: Context<AppEnv>) {
  try {
    const report = await getIncidentReportDetails(c.env.geofix167_db, c.req.param("id") ?? "", c.get("user"));
    const rows = await c.env.geofix167_db.prepare("SELECT * FROM incident_media WHERE incident_id = ? AND media_type IN ('PHOTO', 'VIDEO') ORDER BY created_at, incident_media_id")
      .bind(report.incident_id).all<Attachment>();
    return c.json({ attachments: await Promise.all(rows.results.map(row => attachmentResponse(row, c.env.MEDIA_SIGNING_SECRET))) });
  } catch (error) { return failure(c, error); }
}

export async function uploadAttachment(c: Context<AppEnv>) {
  try {
    const user = c.get("user");
    if (!user) throw new ReportError("Authentication required.", 401);
    const db = c.env.geofix167_db;
    const report = await getIncidentReportDetails(db, c.req.param("id") ?? "", user);
    if (report.reported_by_user_id !== user.id) throw new ReportError("Only the reporting resident can upload attachments.", 403);
    if (!c.req.header("Content-Type")?.toLowerCase().startsWith("multipart/form-data;")) {
      throw new ReportError("Send multipart/form-data with one file and an upload_id.", 415);
    }
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    const uploadId = form?.get("upload_id");
    if (!(file instanceof File) || form?.getAll("file").length !== 1 ||
      typeof uploadId !== "string" || form?.getAll("upload_id").length !== 1 ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(uploadId) ||
      [...form!.values()].filter(value => value instanceof File).length !== 1) {
      throw new ReportError("Provide exactly one file and a UUID upload_id.", 400);
    }
    const format = await validateMedia(file);
    const fileBytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", fileBytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const replay = async () => {
      const existing = await findUpload(db, report.incident_id, uploadId);
      if (existing && (existing.content_sha256 !== hash || existing.content_type !== file.type)) {
        throw new ReportError("This upload_id was already used for another file.", 409);
      }
      return existing;
    };
    const existing = await replay();
    if (existing) return c.json({ attachment: await attachmentResponse(existing, c.env.MEDIA_SIGNING_SECRET), idempotent_replay: true }, 200);
    const count = await db.prepare("SELECT count(*) AS total FROM incident_media WHERE incident_id = ?")
      .bind(report.incident_id).first<{ total: number }>();
    if ((count?.total ?? 0) >= MAX_ATTACHMENTS) throw new ReportError(`A report can have at most ${MAX_ATTACHMENTS} attachments.`, 409);
    const id = crypto.randomUUID();
    const row: Attachment = {
      incident_media_id: id, incident_id: report.incident_id, media_type: format.type,
      storage_key: `reports/${report.incident_id}/${id}.${format.extension}`,
      content_type: file.type, byte_size: file.size,
      original_filename: file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 255),
      upload_key: uploadId, content_sha256: hash, media_url: `/api/media/${id}`, created_at: new Date().toISOString(),
    };
    // Validate signing configuration before writing to either storage system.
    const response = await attachmentResponse(row, c.env.MEDIA_SIGNING_SECRET);
    await c.env.geofix167_uploads.put(row.storage_key, fileBytes, {
      httpMetadata: { contentType: file.type }, customMetadata: { incidentId: report.incident_id },
    });
    try {
      // Count and insertion share one SQL statement, so concurrent requests cannot exceed the cap.
      const result = await db.prepare(`INSERT INTO incident_media
        (incident_media_id, incident_id, uploaded_by_user_id, media_type, storage_key, content_type,
         byte_size, original_filename, upload_key, content_sha256, media_url, created_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE (SELECT count(*) FROM incident_media WHERE incident_id = ?) < ?
        ON CONFLICT(incident_id, upload_key) DO NOTHING`)
        .bind(id, row.incident_id, user.id, row.media_type, row.storage_key, row.content_type,
          row.byte_size, row.original_filename, uploadId, hash, row.media_url, row.created_at,
          row.incident_id, MAX_ATTACHMENTS).run();
      if (!result.meta.changes) {
        const winner = await replay();
        if (!winner) throw new ReportError(`A report can have at most ${MAX_ATTACHMENTS} attachments.`, 409);
        await c.env.geofix167_uploads.delete(row.storage_key);
        return c.json({ attachment: await attachmentResponse(winner, c.env.MEDIA_SIGNING_SECRET), idempotent_replay: true }, 200);
      }
    } catch (error) {
      // A request may fail after D1 committed. Never delete an object referenced by D1.
      const persisted = await findUpload(db, report.incident_id, uploadId);
      if (persisted?.storage_key === row.storage_key) {
        return c.json({ attachment: response, idempotent_replay: true }, 200);
      }
      await c.env.geofix167_uploads.delete(row.storage_key).catch(cleanupError => console.error("R2 cleanup failed", row.storage_key, cleanupError));
      throw error;
    }
    return c.json({ attachment: response, idempotent_replay: false }, 201);
  } catch (error) { return failure(c, error); }
}
