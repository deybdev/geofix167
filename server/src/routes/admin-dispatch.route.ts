import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AppEnv } from "../types/env";

const route = new Hono<AppEnv>();
const adminOnly = [requireAuth, requireRole("admin")];
const idSchema = z.string().trim().min(1).max(64);
const verifySchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED"]),
  reason: z.string().trim().max(500).optional(),
}).refine((value) => value.decision !== "REJECTED" || Boolean(value.reason), {
  message: "A reason is required when rejecting a report.", path: ["reason"],
});
const dispatchSchema = z.object({ unit_id: idSchema });
const helpSchema = z.object({ note: z.string().trim().max(500).optional() });

route.use("*", ...adminOnly);

route.get("/reports", async (c) => {
  const result = await c.env.geofix167_db.prepare(`
    SELECT r.incident_id AS id, r.title, r.category, r.description_sanitized AS description,
      r.description_original, r.latitude, r.longitude, r.location_description AS location,
      r.submitted_at, r.is_emergency, r.priority_code,
      s.code AS status_code, s.display_name AS status,
      COALESCE(trim(u.first_name || ' ' || u.last_name), gs.display_name, 'Guest') AS reporter,
      (SELECT json_object('media_id', m.incident_media_id, 'media_type', m.media_type,
         'content_type', m.content_type, 'storage_key', m.storage_key)
       FROM incident_media m WHERE m.incident_id = r.incident_id AND m.media_type = 'PHOTO'
       ORDER BY m.created_at DESC LIMIT 1) AS photo
    FROM incident_reports r
    JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
    LEFT JOIN users u ON u.user_id = r.reported_by_user_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    WHERE s.code IN ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED')
    ORDER BY r.submitted_at DESC
  `).all();
  return c.json({ reports: result.results ?? [] });
});

route.get("/units", async (c) => {
  const result = await c.env.geofix167_db.prepare(`
    SELECT rr.responder_resource_id AS id, rr.display_name, rr.resource_type,
      rr.availability_status, rr.responder_user_id,
      u.mobile_number, trim(u.first_name || ' ' || u.last_name) AS responder_name
    FROM responder_resources rr
    LEFT JOIN users u ON u.user_id = rr.responder_user_id
    WHERE rr.resource_type IN ('TANOD', 'VEHICLE')
    ORDER BY rr.display_name
  `).all();
  return c.json({ units: result.results ?? [] });
});

route.get("/reports/:reportId/photos/:mediaId", async (c) => {
  const reportId = idSchema.safeParse(c.req.param("reportId"));
  const mediaId = idSchema.safeParse(c.req.param("mediaId"));
  if (!reportId.success || !mediaId.success) return c.json({ error: "Invalid report or photo ID." }, 400);
  const photo = await c.env.geofix167_db.prepare(`
    SELECT storage_key, content_type FROM incident_media
    WHERE incident_id = ? AND incident_media_id = ? AND media_type = 'PHOTO'
  `).bind(reportId.data, mediaId.data).first<{ storage_key: string; content_type: string }>();
  if (!photo) return c.json({ error: "Report photo not found." }, 404);
  const object = await c.env.geofix167_uploads.get(photo.storage_key);
  if (!object) return c.json({ error: "Report photo is unavailable." }, 404);
  c.header("Cache-Control", "private, no-store");
  c.header("Content-Type", photo.content_type);
  return c.body(object.body);
});

route.post("/reports/:reportId/verify", async (c) => {
  const id = idSchema.safeParse(c.req.param("reportId"));
  const body = verifySchema.safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return c.json({ error: "Invalid verification request.", details: body.success ? undefined : body.error.flatten() }, 400);
  const db = c.env.geofix167_db;
  const statusCode = body.data.decision;
  const statusId = statusCode === "VERIFIED" ? 4 : 11;
  const note = body.data.reason || "Report verified by administrator.";
  const eventId = crypto.randomUUID();
  const result = await db.batch([
    db.prepare(`INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, r.incident_id, r.incident_status_id, ?, ?, ? FROM incident_reports r
      JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
      WHERE r.incident_id = ? AND s.code IN ('SUBMITTED', 'UNDER_REVIEW')`)
      .bind(eventId, statusId, c.get("user").id, note, id.data),
    db.prepare(`UPDATE incident_reports SET incident_status_id = ?, updated_at = datetime('now')
      WHERE incident_id = ? AND incident_status_id IN (1, 2)`)
      .bind(statusId, id.data),
  ]);
  if (!result[1]?.meta.changes) return c.json({ error: "This report is no longer pending verification." }, 409);
  return c.json({ ok: true, status: statusCode });
});

route.post("/reports/:reportId/dispatch", async (c) => {
  const id = idSchema.safeParse(c.req.param("reportId"));
  const body = dispatchSchema.safeParse(await c.req.json().catch(() => null));
  if (!id.success || !body.success) return c.json({ error: "A valid report ID and available unit are required." }, 400);
  const db = c.env.geofix167_db;
  const assignmentId = crypto.randomUUID();
  const assignmentEventId = crypto.randomUUID();
  const incidentEventId = crypto.randomUUID();
  const statements = [
    db.prepare(`INSERT INTO tanod_assignments
      (tanod_assignment_id, incident_id, tanod_user_id, responder_resource_id, assignment_status_id, assigned_by_user_id, notes)
      SELECT ?, r.incident_id, rr.responder_user_id, rr.responder_resource_id, 1, ?, 'Admin dispatch'
      FROM incident_reports r JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
      JOIN responder_resources rr ON rr.responder_resource_id = ?
      WHERE r.incident_id = ? AND s.code IN ('SUBMITTED', 'VERIFIED')
        AND rr.availability_status = 'AVAILABLE' AND rr.responder_user_id IS NOT NULL`)
      .bind(assignmentId, c.get("user").id, body.data.unit_id, id.data),
    db.prepare(`INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, a.incident_id, r.incident_status_id, 13, ?, 'Responder dispatched by administrator'
      FROM tanod_assignments a JOIN incident_reports r ON r.incident_id = a.incident_id
      WHERE a.tanod_assignment_id = ?`).bind(incidentEventId, c.get("user").id, assignmentId),
    db.prepare(`UPDATE incident_reports SET incident_status_id = 13, updated_at = datetime('now')
      WHERE incident_id = ? AND EXISTS (SELECT 1 FROM tanod_assignments WHERE tanod_assignment_id = ?)`)
      .bind(id.data, assignmentId),
    db.prepare(`UPDATE responder_resources SET availability_status = 'BUSY', updated_at = datetime('now')
      WHERE responder_resource_id = ? AND availability_status = 'AVAILABLE'
        AND EXISTS (SELECT 1 FROM tanod_assignments WHERE tanod_assignment_id = ?)`)
      .bind(body.data.unit_id, assignmentId),
    db.prepare(`INSERT INTO tanod_assignment_events
      (tanod_assignment_event_id, tanod_assignment_id, assignment_status_id, changed_by_user_id, note)
      SELECT ?, ?, 1, ?, 'Dispatched by administrator'
      WHERE EXISTS (SELECT 1 FROM tanod_assignments WHERE tanod_assignment_id = ?)`)
      .bind(assignmentEventId, assignmentId, c.get("user").id, assignmentId),
  ];
  const result = await db.batch(statements);
  if (!result[0]?.meta.changes) {
    const report = await db.prepare(`SELECT s.code AS status FROM incident_reports r
      JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id WHERE r.incident_id = ?`)
      .bind(id.data).first<{ status: string }>();
    const unit = await db.prepare("SELECT availability_status FROM responder_resources WHERE responder_resource_id = ?")
      .bind(body.data.unit_id).first<{ availability_status: string }>();
    if (!report) return c.json({ error: "Report not found." }, 404);
    if (!unit) return c.json({ error: "Responder unit not found." }, 404);
    if (unit.availability_status !== "AVAILABLE") return c.json({ error: "That unit is no longer available." }, 409);
    return c.json({ error: "Only pending or verified reports can be dispatched." }, 409);
  }
  return c.json({ ok: true, assignment_id: assignmentId, status: "DISPATCHED" }, 201);
});

route.post("/reports/:reportId/request-drrmo", async (c) => {
  const id = idSchema.safeParse(c.req.param("reportId"));
  const body = helpSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!id.success || !body.success) return c.json({ error: "Invalid DRRMO request." }, 400);
  const db = c.env.geofix167_db;
  const supportId = crypto.randomUUID();
  const supportEventId = crypto.randomUUID();
  const incidentEventId = crypto.randomUUID();
  const result = await db.batch([
    db.prepare(`INSERT INTO external_support_requests
      (external_support_request_id, incident_id, requested_organization_id, support_request_status_id, requested_by_user_id, request_reason)
      SELECT ?, r.incident_id, 'org_caloocan_city_drrmo', 1, ?, ?
      FROM incident_reports r JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
      WHERE r.incident_id = ? AND s.code IN ('SUBMITTED', 'VERIFIED')`)
      .bind(supportId, c.get("user").id, body.data.note || "All Barangay 167 units are deployed.", id.data),
    db.prepare(`INSERT INTO support_request_events
      (support_request_event_id, external_support_request_id, support_request_status_id, changed_by_user_id, note)
      SELECT ?, ?, 1, ?, 'DRRMO support requested by administrator'
      WHERE EXISTS (SELECT 1 FROM external_support_requests WHERE external_support_request_id = ?)`)
      .bind(supportEventId, supportId, c.get("user").id, supportId),
    db.prepare(`INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, r.incident_id, r.incident_status_id, 14, ?, 'Awaiting City Hall DRRMO support'
      FROM incident_reports r WHERE r.incident_id = ? AND EXISTS
        (SELECT 1 FROM external_support_requests WHERE external_support_request_id = ?)`)
      .bind(incidentEventId, c.get("user").id, id.data, supportId),
    db.prepare(`UPDATE incident_reports SET incident_status_id = 14, updated_at = datetime('now')
      WHERE incident_id = ? AND incident_status_id IN (1, 2, 4)
        AND EXISTS (SELECT 1 FROM external_support_requests WHERE external_support_request_id = ?)`)
      .bind(id.data, supportId),
  ]);
  if (!result[0]?.meta.changes) {
    const exists = await db.prepare("SELECT incident_id FROM incident_reports WHERE incident_id = ?").bind(id.data).first();
    if (!exists) return c.json({ error: "Report not found." }, 404);
    return c.json({ error: "Only pending or verified reports can request DRRMO support." }, 409);
  }
  return c.json({ ok: true, request_id: supportId, status: "REQUESTED" }, 201);
});

export default route;
