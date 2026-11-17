import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types/env";
import { requireAuth, requireRole } from "../middleware/auth";
import catalog from "../shared/announcementCatalog.json";

const route = new Hono<AppEnv>();
const adminOnly = [requireAuth, requireRole("admin")];
route.use("*", ...adminOnly);
const idSchema = z.string().trim().min(1).max(64);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid event date.").nullable().optional();
const announcementSchema = z.object({
  title: z.string().trim().min(1).max(160),
  details: z.string().trim().min(1).max(10000),
  category: z.enum(catalog.categories),
  event_date: dateSchema,
  venue: z.string().trim().max(200).nullable().optional(),
}).strict();

route.get("/", async (c) => {
  const status = c.req.query("status");
  const search = (c.req.query("q") ?? "").trim().slice(0, 160);
  if (status && !["draft", "published", "archived"].includes(status)) return c.json({ error: "Invalid announcement status." }, 400);
  const clauses = ["1 = 1"];
  const values: string[] = [];
  if (status) { clauses.push("status = ?"); values.push(status); }
  if (search) { clauses.push("(title LIKE ? OR details LIKE ? OR venue LIKE ?)"); values.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const rows = await c.env.geofix167_db.prepare(`SELECT * FROM announcements WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC, id`)
    .bind(...values).all();
  return c.json({ announcements: rows.results ?? [] });
});

route.post("/", async (c) => {
  const body = announcementSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Check the announcement fields.", details: body.error.flatten() }, 400);
  const id = crypto.randomUUID();
  await c.env.geofix167_db.prepare(`INSERT INTO announcements
    (id, title, details, category, event_date, venue, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`)
    .bind(id, body.data.title, body.data.details, body.data.category, body.data.event_date ?? null, body.data.venue?.trim() || null, c.get("user").id).run();
  const announcement = await c.env.geofix167_db.prepare("SELECT * FROM announcements WHERE id = ?").bind(id).first();
  return c.json({ announcement }, 201);
});

route.patch("/:id", async (c) => {
  const id = idSchema.safeParse(c.req.param("id"));
  const body = announcementSchema.safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return c.json({ error: "Check the announcement fields.", details: body.success ? undefined : body.error.flatten() }, 400);
  const result = await c.env.geofix167_db.prepare(`UPDATE announcements SET title = ?, details = ?, category = ?, event_date = ?, venue = ?, updated_at = datetime('now') WHERE id = ? AND status != 'archived'`)
    .bind(body.data.title, body.data.details, body.data.category, body.data.event_date ?? null, body.data.venue?.trim() || null, id.data).run();
  if (!result.meta.changes) return c.json({ error: "Announcement not found." }, 404);
  const announcement = await c.env.geofix167_db.prepare("SELECT * FROM announcements WHERE id = ?").bind(id.data).first();
  return c.json({ announcement });
});

route.post("/:id/publish", async (c) => {
  const id = idSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Announcement not found." }, 404);
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
  const rows = await c.env.geofix167_db.prepare(`SELECT id, title, details, category, event_date, venue, published_at FROM announcements WHERE ${clauses.join(" AND ")} ORDER BY published_at DESC LIMIT ? OFFSET ?`)
    .bind(...values, limit, offset).all();
  return c.json({ announcements: rows.results ?? [], limit, offset });
});
publicAnnouncementRoutes.get("/:id", async (c) => {
  const announcement = await c.env.geofix167_db.prepare(`SELECT id, title, details, category, event_date, venue, published_at FROM announcements WHERE id = ? AND status = 'published'`)
    .bind(c.req.param("id")).first();
  if (!announcement) return c.json({ error: "Announcement not found." }, 404);
  return c.json({ announcement });
});

export default route;
