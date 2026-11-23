import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppEnv } from "../types/env";
import { requireAuth, requireRole } from "../middleware/auth";
import { ReportError } from "../services/report.error";
import { MAX_VIDEO_BYTES, validateMedia } from "../services/attachment.service";
import { attachAnnouncementMedia, MAX_ANNOUNCEMENT_MEDIA, mediaPayload, type AnnouncementMedia } from "../services/announcement-media.service";
import catalog from "../shared/announcementCatalog.json";

const route = new Hono<AppEnv>();
const adminOnly = [requireAuth, requireRole("admin")];
route.use("*", ...adminOnly);
type AnnouncementRow = { id: string; [key: string]: unknown };
const idSchema = z.string().trim().min(1).max(64);
const mediaIdSchema = z.string().uuid();
const manilaToday = () => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid event date.").nullable().optional();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional();
const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  details: z.string().trim().min(1).max(10000),
  category: z.enum(catalog.categories),
  event_date: dateSchema,
  event_time: timeSchema,
  venue: z.string().trim().max(200).nullable().optional(),
}).strict();

async function streamAnnouncementMedia(c: import("hono").Context<AppEnv>, row: AnnouncementMedia, publicFeed: boolean) {
  const objectHead = await c.env.geofix167_uploads.head(row.storage_key);
  if (!objectHead) return c.notFound();
  const cacheControl = publicFeed ? "public, max-age=3600" : "private, no-store";
  const headers = new Headers({
    "Content-Type": row.content_type,
    "Content-Length": String(objectHead.size),
    "Cache-Control": cacheControl,
    "Accept-Ranges": "bytes",
    "ETag": objectHead.httpEtag,
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename="${row.original_filename.replace(/[\"\\\r\n]/g, "_")}"`,
  });
  let range: { offset: number; length: number } | undefined;
  const rangeHeader = c.req.header("Range");
  const ifRange = c.req.header("If-Range");
  if (rangeHeader && (!ifRange || ifRange === objectHead.httpEtag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    const start = match?.[1] ? Number(match[1]) : Math.max(0, objectHead.size - Number(match?.[2]));
    const end = match?.[1] && match[2] ? Math.min(Number(match[2]), objectHead.size - 1) : objectHead.size - 1;
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= objectHead.size || end < start) {
      headers.set("Content-Range", `bytes */${objectHead.size}`);
      headers.delete("Content-Length");
      return new Response(null, { status: 416, headers });
    }
    range = { offset: start, length: end - start + 1 };
    headers.set("Content-Range", `bytes ${start}-${end}/${objectHead.size}`);
    headers.set("Content-Length", String(range.length));
  }
  const object = await c.env.geofix167_uploads.get(row.storage_key, range ? { range } : undefined);
  if (!object) return c.notFound();
  return new Response(object.body, { status: range ? 206 : 200, headers });
}

route.get("/", async (c) => {
  const status = c.req.query("status");
  const search = (c.req.query("q") ?? "").trim().slice(0, 160);
  if (status && !["draft", "published", "archived"].includes(status)) return c.json({ error: "Invalid announcement status." }, 400);
  const clauses = ["1 = 1"];
  const values: string[] = [];
  if (status) { clauses.push("status = ?"); values.push(status); }
  if (search) { clauses.push("(title LIKE ? OR details LIKE ? OR venue LIKE ?)"); values.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const rows = await c.env.geofix167_db.prepare(`SELECT * FROM announcements WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id`)
    .bind(...values).all<AnnouncementRow>();
  return c.json({ announcements: await attachAnnouncementMedia(c.env.geofix167_db, rows.results ?? [], false) });
});

route.get("/:id/media/:mediaId", async (c) => {
  const announcementId = idSchema.safeParse(c.req.param("id"));
  const mediaId = mediaIdSchema.safeParse(c.req.param("mediaId"));
  if (!announcementId.success || !mediaId.success) return c.json({ error: "Announcement media not found." }, 404);
  const row = await c.env.geofix167_db.prepare("SELECT * FROM announcement_media WHERE announcement_id = ? AND media_id = ?")
    .bind(announcementId.data, mediaId.data).first<AnnouncementMedia>();
  if (!row) return c.json({ error: "Announcement media not found." }, 404);
  return streamAnnouncementMedia(c, row, false);
});

route.post("/:id/media", bodyLimit({
  maxSize: MAX_VIDEO_BYTES + 64 * 1024,
  onError: (c) => c.json({ error: "Videos must be 25 MiB or smaller." }, 413),
}), async (c) => {
  const announcementId = idSchema.safeParse(c.req.param("id"));
  if (!announcementId.success) return c.json({ error: "Announcement not found." }, 404);
  const announcement = await c.env.geofix167_db.prepare("SELECT id FROM announcements WHERE id = ? AND status != 'archived'")
    .bind(announcementId.data).first<{ id: string }>();
  if (!announcement) return c.json({ error: "Announcement not found." }, 404);
  if (!c.req.header("Content-Type")?.toLowerCase().startsWith("multipart/form-data;")) {
    return c.json({ error: "Send multipart/form-data with one photo or video file." }, 415);
  }
  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || form?.getAll("file").length !== 1
    || [...(form?.values() ?? [])].filter((value) => value instanceof File).length !== 1) {
    return c.json({ error: "Select one photo or video to upload." }, 400);
  }
  let format: Awaited<ReturnType<typeof validateMedia>>;
  try { format = await validateMedia(file); }
  catch (error) {
    if (error instanceof ReportError) return c.json({ error: error.message }, error.status as 400 | 413 | 415);
    throw error;
  }
  const mediaId = crypto.randomUUID();
  const extension = file.type === "image/jpeg" ? "jpg" : (file.type.split("/")[1] ?? "bin").replace("quicktime", "mov");
  const storageKey = `announcements/${announcementId.data}/${mediaId}.${extension}`;
  const originalFilename = file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 255) || `announcement.${extension}`;
  const createdAt = new Date().toISOString();
  try {
    await c.env.geofix167_uploads.put(storageKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { announcementId: announcementId.data, mediaId },
    });
    const result = await c.env.geofix167_db.prepare(`INSERT INTO announcement_media
      (media_id, announcement_id, storage_key, media_type, content_type, byte_size, original_filename, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (SELECT count(*) FROM announcement_media WHERE announcement_id = ?) < ?`)
      .bind(mediaId, announcementId.data, storageKey, format.type, file.type, file.size, originalFilename, createdAt,
        announcementId.data, MAX_ANNOUNCEMENT_MEDIA).run();
    if (!result.meta.changes) {
      await c.env.geofix167_uploads.delete(storageKey);
      return c.json({ error: `An announcement can have up to ${MAX_ANNOUNCEMENT_MEDIA} photos or videos.` }, 409);
    }
  } catch (error) {
    await c.env.geofix167_uploads.delete(storageKey).catch((cleanupError) => console.error("Announcement media cleanup failed", storageKey, cleanupError));
    throw error;
  }
  const row = await c.env.geofix167_db.prepare("SELECT * FROM announcement_media WHERE media_id = ?")
    .bind(mediaId).first<AnnouncementMedia>();
  if (!row) return c.json({ error: "The uploaded file could not be recorded." }, 500);
  return c.json({ media: mediaPayload(row, false) }, 201);
});

route.post("/", async (c) => {
  const body = announcementSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Check the announcement fields.", details: body.error.flatten() }, 400);
  const id = crypto.randomUUID();
  await c.env.geofix167_db.prepare(`INSERT INTO announcements
    (id, title, details, category, event_date, event_time, venue, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`)
    .bind(id, body.data.title, body.data.details, body.data.category, body.data.event_date ?? null, body.data.event_time ?? null, body.data.venue?.trim() || null, c.get("user").id).run();
  const announcement = await c.env.geofix167_db.prepare("SELECT * FROM announcements WHERE id = ?").bind(id).first();
  return c.json({ announcement }, 201);
});

route.patch("/:id", async (c) => {
  const id = idSchema.safeParse(c.req.param("id"));
  const body = announcementSchema.safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return c.json({ error: "Check the announcement fields.", details: body.success ? undefined : body.error.flatten() }, 400);
  const result = await c.env.geofix167_db.prepare(`UPDATE announcements SET title = ?, details = ?, category = ?, event_date = ?, event_time = ?, venue = ?, updated_at = datetime('now') WHERE id = ? AND status != 'archived'`)
    .bind(body.data.title, body.data.details, body.data.category, body.data.event_date ?? null, body.data.event_time ?? null, body.data.venue?.trim() || null, id.data).run();
  if (!result.meta.changes) return c.json({ error: "Announcement not found." }, 404);
  const announcement = await c.env.geofix167_db.prepare("SELECT * FROM announcements WHERE id = ?").bind(id.data).first();
  return c.json({ announcement });
});

route.post("/:id/publish", async (c) => {
  const id = idSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Announcement not found." }, 404);
  const draft = await c.env.geofix167_db.prepare("SELECT event_date FROM announcements WHERE id = ? AND status = 'draft'").bind(id.data).first<{ event_date: string | null }>();
  if (!draft) return c.json({ error: "Only a draft announcement can be published." }, 409);
  if (draft.event_date && draft.event_date < manilaToday()) return c.json({ error: "An announcement with a past event date cannot be published. Choose today or a future date." }, 400);
  const result = await c.env.geofix167_db.prepare(`UPDATE announcements SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'draft'`)
    .bind(id.data).run();
  if (!result.meta.changes) return c.json({ error: "Only a draft announcement can be published." }, 409);
  return c.json({ ok: true });
});

route.post("/:id/unpublish", async (c) => {
  const id = idSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Announcement not found." }, 404);
  const result = await c.env.geofix167_db.prepare(`UPDATE announcements SET status = 'draft', published_at = NULL, updated_at = datetime('now') WHERE id = ? AND status = 'published'`)
    .bind(id.data).run();
  if (!result.meta.changes) return c.json({ error: "Published announcement not found." }, 404);
  return c.json({ ok: true });
});

route.delete("/:id", async (c) => {
  const id = idSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Announcement not found." }, 404);
  const result = await c.env.geofix167_db.prepare(`UPDATE announcements SET status = 'archived', updated_at = datetime('now') WHERE id = ? AND status != 'archived'`)
    .bind(id.data).run();
  if (!result.meta.changes) return c.json({ error: "Announcement not found." }, 404);
  return c.json({ ok: true });
});

export const publicAnnouncementRoutes = new Hono<AppEnv>();
publicAnnouncementRoutes.get("/", async (c) => {
  const category = c.req.query("category");
  const search = (c.req.query("q") ?? "").trim().slice(0, 160);
  const limit = Math.min(30, Math.max(1, Number(c.req.query("limit") ?? 10) || 10));
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
  if (category && !catalog.categories.includes(category)) return c.json({ error: "Invalid announcement category." }, 400);
  const clauses = ["status = 'published'"];
  const values: (string | number)[] = [];
  if (category) { clauses.push("category = ?"); values.push(category); }
  if (search) { clauses.push("(title LIKE ? OR details LIKE ? OR venue LIKE ?)"); values.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const rows = await c.env.geofix167_db.prepare(`SELECT id, title, details, category, event_date, event_time, venue, published_at FROM announcements WHERE ${clauses.join(" AND ")} ORDER BY published_at DESC LIMIT ? OFFSET ?`)
    .bind(...values, limit, offset).all<AnnouncementRow>();
  return c.json({ announcements: await attachAnnouncementMedia(c.env.geofix167_db, rows.results ?? [], true), limit, offset });
});
publicAnnouncementRoutes.get("/:id", async (c) => {
  const announcement = await c.env.geofix167_db.prepare(`SELECT id, title, details, category, event_date, event_time, venue, published_at FROM announcements WHERE id = ? AND status = 'published'`)
    .bind(c.req.param("id")).first();
  if (!announcement) return c.json({ error: "Announcement not found." }, 404);
  const [withMedia] = await attachAnnouncementMedia(c.env.geofix167_db, [announcement as { id: string }], true);
  return c.json({ announcement: withMedia });
});
publicAnnouncementRoutes.get("/:id/media/:mediaId", async (c) => {
  const announcementId = idSchema.safeParse(c.req.param("id"));
  const mediaId = mediaIdSchema.safeParse(c.req.param("mediaId"));
  if (!announcementId.success || !mediaId.success) return c.json({ error: "Announcement media not found." }, 404);
  const row = await c.env.geofix167_db.prepare(`SELECT m.* FROM announcement_media m
    INNER JOIN announcements a ON a.id = m.announcement_id
    WHERE a.id = ? AND a.status = 'published' AND m.media_id = ?`)
    .bind(announcementId.data, mediaId.data).first<AnnouncementMedia>();
  if (!row) return c.json({ error: "Announcement media not found." }, 404);
  return streamAnnouncementMedia(c, row, true);
});

export default route;
