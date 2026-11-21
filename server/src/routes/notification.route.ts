import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { assertOrigin } from "../services/registration-security";
import type { AppEnv } from "../types/env";

const route = new Hono<AppEnv>();
route.use("*", requireAuth, requireRole("resident"));
route.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (c.req.method !== "GET") assertOrigin(c);
  await next();
});

route.get("/", async (c) => {
  const limit = Number(c.req.query("limit") ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return c.json({ error: "Limit must be 1–50." }, 400);
  let cursor: string[] | null = null;
  const raw = c.req.query("cursor");
  if (raw) {
    try {
      const parsed = JSON.parse(atob(raw));
      if (!Array.isArray(parsed) || parsed.length !== 2 || !parsed.every(v => typeof v === "string")
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parsed[0] ?? "")
        || !/^[a-f0-9]{32}$/.test(parsed[1] ?? "")) throw new Error();
      cursor = parsed;
    } catch { return c.json({ error: "Invalid cursor." }, 400); }
  }
  const db = c.env.geofix167_db;
  const owner = c.get("user").id;
  const list = db.prepare(`SELECT notification_id AS id, title, body, type, incident_id AS ref_id,
    CASE WHEN read_at IS NULL THEN 0 ELSE 1 END AS is_read, created_at
    FROM resident_notifications WHERE recipient_user_id = ?
    ${cursor ? "AND (created_at, notification_id) < (?, ?)" : ""}
    ORDER BY created_at DESC, notification_id DESC LIMIT ?`)
    .bind(owner, ...(cursor ?? []), limit + 1);
  const results = await db.batch([list, db.prepare(`SELECT count(*) AS count FROM resident_notifications
    WHERE recipient_user_id = ? AND read_at IS NULL`).bind(owner)]);
  const rows = results[0]!.results as { id: string; created_at: string }[];
  const notifications = rows.slice(0, limit);
  const last = notifications.at(-1);
  return c.json({ notifications, unread_count: (results[1]!.results[0] as { count: number }).count,
    next_cursor: rows.length > limit && last ? btoa(JSON.stringify([last.created_at, last.id])) : null });
});

// Literal route must precede /:id/read.
route.patch("/read-all", async (c) => {
  await c.env.geofix167_db.prepare(`UPDATE resident_notifications
    SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE recipient_user_id = ? AND read_at IS NULL`).bind(c.get("user").id).run();
  return c.json({ ok: true });
});
route.patch("/:id/read", async (c) => {
  const db = c.env.geofix167_db;
  const id = c.req.param("id");
  const owner = c.get("user").id;
  const found = await db.prepare("SELECT notification_id FROM resident_notifications WHERE notification_id = ? AND recipient_user_id = ?")
    .bind(id, owner).first();
  if (!found) return c.json({ error: "Notification not found." }, 404);
  await db.prepare(`UPDATE resident_notifications SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE notification_id = ? AND recipient_user_id = ? AND read_at IS NULL`).bind(id, owner).run();
  return c.json({ ok: true });
});
export default route;
