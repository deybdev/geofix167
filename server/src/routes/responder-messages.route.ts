import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv, UserRole } from "../types/env";
import { requireAuth, requireRole } from "../middleware/auth";

const route = new Hono<AppEnv>();
const responderRoles: UserRole[] = ["bdrrmo", "police", "fire"];
const roleSchema = z.enum(["bdrrmo", "police", "fire"]);
const messageSchema = z.object({
  recipient_role: roleSchema,
  body: z.string().trim().min(1).max(2000),
});

route.use("*", requireAuth, requireRole(...responderRoles));

route.get("/", async (c) => {
  const targetRole = roleSchema.safeParse(c.req.query("with_role"));
  if (!targetRole.success || targetRole.data === c.get("user").role) {
    return c.json({ error: "A valid conversation role is required." }, 400);
  }

  const currentUser = c.get("user");
  const result = await c.env.geofix167_db.prepare(`
    SELECT m.responder_message_id AS id, m.sender_user_id, m.recipient_role,
      m.body, m.sent_at, trim(u.first_name || ' ' || u.last_name) AS sender_name,
      r.code AS sender_role
    FROM responder_messages m
    JOIN users u ON u.user_id = m.sender_user_id
    JOIN roles r ON r.role_id = u.role_id
    WHERE (m.sender_user_id = ? AND m.recipient_role = ?)
       OR (r.code = ? AND m.recipient_role = ?)
    ORDER BY m.sent_at ASC
    LIMIT 200
  `).bind(
    currentUser.id,
    targetRole.data,
    targetRole.data,
    currentUser.role,
  ).all();

  return c.json({ messages: result.results ?? [] });
});

route.post("/", async (c) => {
  const body = messageSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success || body.data.recipient_role === c.get("user").role) {
    return c.json({ error: "A valid recipient role and message are required." }, 400);
  }

  const id = crypto.randomUUID();
  await c.env.geofix167_db.prepare(`
    INSERT INTO responder_messages
      (responder_message_id, sender_user_id, recipient_role, body)
    VALUES (?, ?, ?, ?)
  `).bind(id, c.get("user").id, body.data.recipient_role, body.data.body).run();

  return c.json({
    message: {
      id,
      sender_user_id: c.get("user").id,
      sender_role: c.get("user").role,
      sender_name: c.get("user").full_name,
      recipient_role: body.data.recipient_role,
      body: body.data.body,
      sent_at: new Date().toISOString(),
    },
  }, 201);
});

export default route;
