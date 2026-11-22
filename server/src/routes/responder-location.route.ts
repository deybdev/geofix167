import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AppEnv } from "../types/env";

const route = new Hono<AppEnv>();
const locationSchema = z.object({
  assignment_id: z.string().trim().min(1).max(100),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100000).nullable().optional(),
  heading: z.number().finite().min(0).max(359.999).nullable().optional(),
}).strict();

route.use("*", requireAuth, requireRole("tanod", "bdrrmo", "police", "fire"));

route.post("/", async (c) => {
  const body = locationSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return c.json({ error: "A valid assignment and responder location are required.", details: body.error.flatten() }, 400);
  }
  const user = c.get("user");
  const db = c.env.geofix167_db;
  const now = new Date().toISOString();
  const tanodAssignment = user.role === "tanod" ? await db.prepare(`SELECT ta.incident_id, ast.code AS status
    FROM tanod_assignments ta JOIN assignment_statuses ast ON ast.assignment_status_id = ta.assignment_status_id
    WHERE ta.tanod_assignment_id = ? AND ta.tanod_user_id = ? LIMIT 1`)
    .bind(body.data.assignment_id, user.id).first<{ incident_id: string; status: string }>() : null;
  const roleDispatch = tanodAssignment ? null : await db.prepare(`SELECT incident_id, status
    FROM responder_dispatches WHERE responder_dispatch_id = ? AND target_role = ? LIMIT 1`)
    .bind(body.data.assignment_id, user.role).first<{ incident_id: string; status: string }>();
  const assignment = tanodAssignment ?? roleDispatch;
  if (!assignment) return c.json({ error: "Active assignment not found." }, 404);
  if (!["ACCEPTED", "EN_ROUTE", "ON_SCENE"].includes(assignment.status)) {
    await db.prepare("DELETE FROM responder_locations WHERE assignment_id = ? AND responder_id = ?")
      .bind(body.data.assignment_id, user.id).run();
    return c.json({ error: "Location sharing is available only for an active accepted assignment." }, 409);
  }
  const eligibleReport = await db.prepare(`SELECT r.incident_id
    FROM incident_reports r
    WHERE r.incident_id = ? AND r.incident_status_id NOT IN (10, 11) LIMIT 1`)
    .bind(assignment.incident_id).first<{ incident_id: string }>();
  if (!eligibleReport) return c.json({ error: "This incident is no longer accepting location updates." }, 409);

  await db.prepare(`INSERT INTO responder_locations
      (assignment_id, responder_id, lat, lng, accuracy, heading, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(assignment_id) DO UPDATE SET
      responder_id = excluded.responder_id, lat = excluded.lat, lng = excluded.lng,
      accuracy = excluded.accuracy, heading = excluded.heading, updated_at = excluded.updated_at`)
    .bind(body.data.assignment_id, user.id, body.data.lat, body.data.lng,
      body.data.accuracy ?? null, body.data.heading ?? null, now).run();

  return c.json({ ok: true, updated_at: now });
});

export default route;
