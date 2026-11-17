import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, requireRole } from "../middleware/auth";
import type { AppEnv, UserRole } from "../types/env";

const route = new Hono<AppEnv>();
const responderRoles: UserRole[] = ["bdrrmo", "police", "fire"];
const roleSchema = z.enum(["bdrrmo", "police", "fire"]);
const dispatchSchema = z.object({
  incident_id: z.string().trim().min(1).max(100),
  incident_title: z.string().trim().min(1).max(200),
  incident_category: z.string().trim().min(1).max(50),
  incident_location: z.string().trim().max(300).optional(),
  incident_latitude: z.number().min(-90).max(90).optional(),
  incident_longitude: z.number().min(-180).max(180).optional(),
  target_roles: z.array(roleSchema).min(1),
  urgency: z.enum(["Critical", "High", "Medium", "Low"]),
  vehicle_name: z.string().trim().max(100).optional(),
});
const statusSchema = z.enum(["ACCEPTED", "EN_ROUTE", "ON_SCENE", "COMPLETED"]);

route.use("*", requireAuth, requireRole(...responderRoles));

route.get("/", async (c) => {
  const currentUser = c.get("user");
  const requestedStatus = c.req.query("status");
  const status = requestedStatus ? statusSchema.safeParse(requestedStatus) : null;
  if (status && !status.success) return c.json({ error: "Invalid dispatch status." }, 400);
  const statusClause = status ? "AND status = ?" : "";
  const bindings = status
    ? [currentUser.role, currentUser.role, status.data]
    : [currentUser.role, currentUser.role];
  const result = await c.env.geofix167_db.prepare(`
    SELECT responder_dispatch_id AS id, incident_id, incident_title, incident_category,
      incident_location, incident_latitude, incident_longitude, target_role, urgency,
      vehicle_name, status, dispatched_at
    FROM responder_dispatches
    WHERE (target_role = ? OR ? = 'bdrrmo') ${statusClause}
    ORDER BY dispatched_at DESC
    LIMIT 200
  `).bind(...bindings).all();

  return c.json({ dispatches: result.results ?? [] });
});

route.patch("/:dispatchId/status", async (c) => {
  const status = statusSchema.safeParse((await c.req.json().catch(() => null))?.status);
  const dispatchId = c.req.param("dispatchId");
  if (!status.success || !dispatchId) {
    return c.json({ error: "A valid dispatch status is required." }, 400);
  }

  const result = await c.env.geofix167_db.prepare(`
    UPDATE responder_dispatches
    SET status = ?
    WHERE responder_dispatch_id = ?
      AND (target_role = ? OR ? = 'bdrrmo')
  `).bind(status.data, dispatchId, c.get("user").role, c.get("user").role).run();

  if (!result.meta.changes) return c.json({ error: "Dispatch not found." }, 404);
  return c.json({ ok: true, status: status.data });
});

route.post("/", async (c) => {
  if (c.get("user").role !== "bdrrmo") {
    return c.json({ error: "Only BDRRMO can create dispatches." }, 403);
  }

  const body = dispatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: "Invalid dispatch request.", details: body.error.flatten() }, 400);
  }

  const statements = body.data.target_roles.map((targetRole) => c.env.geofix167_db.prepare(`
    INSERT INTO responder_dispatches
      (responder_dispatch_id, incident_id, incident_title, incident_category,
       incident_location, incident_latitude, incident_longitude,
       dispatched_by_user_id, target_role, urgency, vehicle_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    body.data.incident_id,
    body.data.incident_title,
    body.data.incident_category,
    body.data.incident_location || null,
    body.data.incident_latitude ?? null,
    body.data.incident_longitude ?? null,
    c.get("user").id,
    targetRole,
    body.data.urgency,
    body.data.vehicle_name || null,
  ));

  await c.env.geofix167_db.batch(statements);
  return c.json({ ok: true, status: "DISPATCHED" }, 201);
});

export default route;
