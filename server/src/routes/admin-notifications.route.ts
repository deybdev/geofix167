import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { assertOrigin } from "../services/registration-security";
import type { AppEnv } from "../types/env";

const route = new Hono<AppEnv>();
route.use("*", requireAuth, requireRole("admin"), async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  if (c.req.method !== "GET") assertOrigin(c);
  await next();
});
const idSchema = z.string().regex(/^[a-f0-9]{32}$/);
const cursorSchema = z.tuple([z.iso.datetime(), idSchema]);
const scope = "recipient_role = 'admin' AND recipient_user_id = ? AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')";

route.get("/", async (c) => {
  const query = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    unread_only: z.enum(["true", "false", "1", "0"]).optional(),
    cursor: z.string().min(1).max(256).optional(),
  }).safeParse(c.req.query());
  if (!query.success) return c.json({ error: "Invalid notification query." }, 400);
  const { limit, unread_only, cursor } = query.data;
  let position: [string, string] | undefined;
  if (cursor) {
    try { position = cursorSchema.parse(JSON.parse(atob(cursor))); }
    catch { return c.json({ error: "Invalid notification cursor." }, 400); }
  }
  const db = c.env.geofix167_db;
  const user = c.get("user").id;
  const [page, count] = await db.batch<Record<string, unknown>>([
    db.prepare(`SELECT id, type, title, body, report_id, assignment_id, link_path, created_at, read_at
      FROM notifications WHERE ${scope}
      ${["true", "1"].includes(unread_only ?? "") ? "AND read_at IS NULL" : ""}
      ${position ? "AND (created_at, id) < (?, ?)" : ""}
      ORDER BY created_at DESC, id DESC LIMIT ?`).bind(user, ...(position ?? []), limit + 1),
    db.prepare(`SELECT count(*) AS total FROM notifications WHERE ${scope} AND read_at IS NULL`).bind(user),
  ]);
  const items = page!.results.slice(0, limit);
  const last = items.at(-1);
  return c.json({ items, unread_count: count!.results[0]?.total ?? 0,
    next_cursor: page!.results.length > limit && last ? btoa(JSON.stringify([last.created_at, last.id])) : null });
});

route.post("/read-all", async (c) => {
  await c.env.geofix167_db.prepare(`UPDATE notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE ${scope} AND read_at IS NULL`).bind(c.get("user").id).run();
  return c.json({ ok: true });
});

route.post("/:id/read", async (c) => {
  const id = idSchema.safeParse(c.req.param("id"));
  if (!id.success) return c.json({ error: "Invalid notification ID." }, 400);
  const result = await c.env.geofix167_db.prepare(`UPDATE notifications
    SET read_at = coalesce(read_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    WHERE ${scope} AND id = ?`).bind(c.get("user").id, id.data).run();
  return result.meta.changes ? c.json({ ok: true }) : c.json({ error: "Notification not found." }, 404);
});

export default route;
