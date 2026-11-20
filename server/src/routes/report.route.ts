import { getCookie } from "hono/cookie";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { bodyLimit } from "hono/body-limit";
import { getReportPhoto, listAttachments, uploadAttachment } from "../controllers/attachment.controller";
import { MAX_GUEST_REPORT_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from "../services/attachment.service";
import { reverseGeocodeCoordinates } from "../services/reverseGeocode.service";
import { ensureIncidentReportSnapshot } from "../services/incidentReportSnapshot.service";
import {
  createReportController,
  updateReportStatusController, updateReportDetailsController,
  getReportByIdController,
  listReportsController,
} from "../controllers/report.controller";

const reportRoutes = new Hono<AppEnv>();
const resolveSchema = z.object({
  closure_mode: z.enum(["proof", "no-proof"]).optional(),
  resolution_notes: z.string().trim().max(4000).optional(),
}).strict();

reportRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (c.req.header("Authorization")?.startsWith("Bearer ") || getCookie(c, "geofix_session")) {
    return requireAuth(c, next);
  }
  await next();
});
reportRoutes.get("/public", async (c) => {
  const result = await c.env.geofix167_db.prepare(
    "SELECT community_feed_post_id AS id, title, body AS description, published_at FROM community_feed_posts WHERE published_at IS NOT NULL AND datetime(published_at) <= datetime('now') AND archived_at IS NULL ORDER BY published_at DESC LIMIT 100"
  ).all();
  return c.json({ reports: result.results, count: result.results.length });
});
reportRoutes.get("/reverse-geocode", async (c) => {
  const latitude = Number(c.req.query("lat"));
  const longitude = Number(c.req.query("lng"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return c.json({ error: "A valid latitude and longitude are required." }, 400);
  }

  try {
    const address = await reverseGeocodeCoordinates(latitude, longitude);
    return c.json({ address, attribution: "© OpenStreetMap contributors" }, 200, {
      "Cache-Control": "public, max-age=86400",
    });
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return c.json({ error: "Street lookup is temporarily unavailable." }, 502);
  }
});
reportRoutes.post("/", bodyLimit({
  maxSize: MAX_GUEST_REPORT_UPLOAD_BYTES,
  onError: c => c.json({ error: "Guest report photos exceed the 6 MiB total limit." }, 413),
}), createReportController);
reportRoutes.get("/:id/attachments", requireAuth, listAttachments);
reportRoutes.get("/:id/photos/:mediaId", requireAuth, getReportPhoto);
reportRoutes.post("/:id/attachments", requireAuth, bodyLimit({
  maxSize: MAX_UPLOAD_BYTES,
  onError: c => c.json({ error: "Upload exceeds the 25 MiB video limit." }, 413),
}), uploadAttachment);
reportRoutes.post("/:id/resolve", requireAuth, requireRole("admin"), async (c) => {
  const incidentId = c.req.param("id")?.trim();
  if (!incidentId) return c.json({ error: "Incident ID is required." }, 400);
  const currentUser = c.get("user");
  const db = c.env.geofix167_db;
  const body = resolveSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid resolution details.", details: body.error.flatten() }, 400);

  const report = await db.prepare(`SELECT r.incident_id, r.incident_status_id, r.closed_at
    FROM incident_reports r LEFT JOIN incident_report_references ref ON ref.incident_id = r.incident_id
    WHERE r.incident_id = ? OR printf('GF-%03d', ref.reference_sequence) = ?
    ORDER BY CASE WHEN r.incident_id = ? THEN 0 ELSE 1 END LIMIT 1`)
    .bind(incidentId, incidentId, incidentId)
    .first<{ incident_id: string; incident_status_id: number; closed_at: string | null }>();
  if (!report) return c.json({ error: "Incident report not found." }, 404);
  if (report.closed_at) {
    const snapshot = await ensureIncidentReportSnapshot(db, report.incident_id, currentUser.id, body.data.resolution_notes);
    return c.json({ ok: true, status: "CLOSED", snapshot });
  }

  const eventId = crypto.randomUUID();
  const note = body.data.resolution_notes || "Admin marked incident as resolved after verification.";
  const metadata = JSON.stringify({ closure_mode: body.data.closure_mode ?? null, resolution_notes: note });

  await db.batch([
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 10, closed_at = datetime('now'), closed_by_user_id = ?, updated_at = datetime('now')
      WHERE incident_id = ? AND closed_at IS NULL
    `).bind(currentUser.id, report.incident_id),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, ?, ?, 10, ?, ? WHERE changes() = 1
    `).bind(eventId, report.incident_id, report.incident_status_id, currentUser.id, note),
    db.prepare(`
      UPDATE tanod_assignments
      SET assignment_status_id = 6, completed_at = COALESCE(completed_at, datetime('now'))
      WHERE incident_id = ? AND completed_at IS NULL
        AND EXISTS (SELECT 1 FROM incident_reports WHERE incident_id = ? AND closed_at IS NOT NULL)
    `).bind(report.incident_id, report.incident_id),
    db.prepare(`
      UPDATE responder_dispatches
      SET status = 'COMPLETED'
      WHERE incident_id = ? AND EXISTS (SELECT 1 FROM incident_reports WHERE incident_id = ? AND closed_at IS NOT NULL)
    `).bind(report.incident_id, report.incident_id),
    db.prepare(`INSERT INTO tanod_assignment_events
      (tanod_assignment_event_id, tanod_assignment_id, assignment_status_id, changed_by_user_id, note, created_at)
      SELECT ? || ':' || assignment.tanod_assignment_id, assignment.tanod_assignment_id, 6, ?, 'Incident resolved', datetime('now')
      FROM tanod_assignments assignment WHERE assignment.incident_id = ?
        AND EXISTS (SELECT 1 FROM incident_status_events WHERE incident_status_event_id = ?)`)
      .bind(eventId, currentUser.id, report.incident_id, eventId),
    db.prepare(`UPDATE responder_resources SET availability_status = 'AVAILABLE', updated_at = datetime('now')
      WHERE responder_resource_id IN (SELECT assignment.responder_resource_id FROM tanod_assignments assignment
        JOIN tanod_assignment_events event ON event.tanod_assignment_id = assignment.tanod_assignment_id
        WHERE event.tanod_assignment_event_id = ? || ':' || assignment.tanod_assignment_id)
      AND NOT EXISTS (SELECT 1 FROM tanod_assignments active
        WHERE active.responder_resource_id = responder_resources.responder_resource_id
          AND active.completed_at IS NULL AND active.assignment_status_id IN (1, 2, 4, 5))`).bind(eventId),
    db.prepare(`INSERT INTO audit_logs
      (audit_log_id, actor_user_id, action, entity_type, entity_id, incident_id, metadata_json)
      SELECT ?, ?, 'INCIDENT_RESOLVED', 'INCIDENT_REPORT', ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM incident_status_events WHERE incident_status_event_id = ?)`)
      .bind(crypto.randomUUID(), currentUser.id, report.incident_id, report.incident_id, metadata, eventId),
    db.prepare(`UPDATE tracking_links SET expires_at = datetime('now'),
      revoked_at = COALESCE(revoked_at, datetime('now')) WHERE report_id = ?
      AND EXISTS (SELECT 1 FROM incident_status_events WHERE incident_status_event_id = ?)`)
      .bind(report.incident_id, eventId),
    db.prepare(`DELETE FROM responder_locations WHERE assignment_id IN (
      SELECT tanod_assignment_id FROM tanod_assignments WHERE incident_id = ?
      UNION SELECT responder_dispatch_id FROM responder_dispatches WHERE incident_id = ?
    ) AND EXISTS (SELECT 1 FROM incident_status_events WHERE incident_status_event_id = ?)`)
      .bind(report.incident_id, report.incident_id, eventId),
  ]);

  const snapshot = await ensureIncidentReportSnapshot(db, report.incident_id, currentUser.id, note);
  if (!snapshot) return c.json({ error: "The incident was closed, but its report snapshot could not be generated." }, 500);
  return c.json({ ok: true, status: "CLOSED", snapshot });
});

reportRoutes.get("/:id/report-snapshot", requireAuth, requireRole("admin"), async (c) => {
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident ID is required." }, 400);
  const db = c.env.geofix167_db;
  const report = await db.prepare(`SELECT r.incident_id, r.closed_at, status.code AS status
    FROM incident_reports r JOIN incident_statuses status ON status.incident_status_id = r.incident_status_id
    LEFT JOIN incident_report_references ref ON ref.incident_id = r.incident_id
    WHERE r.incident_id = ? OR printf('GF-%03d', ref.reference_sequence) = ?
    ORDER BY CASE WHEN r.incident_id = ? THEN 0 ELSE 1 END LIMIT 1`)
    .bind(id, id, id).first<{ incident_id: string; closed_at: string | null; status: string }>();
  if (!report) return c.json({ error: "Incident report not found." }, 404);
  if (!report.closed_at || report.status !== "CLOSED") {
    return c.json({ error: "The printable incident report is available after the incident is resolved." }, 409);
  }
  const snapshot = await ensureIncidentReportSnapshot(db, report.incident_id, c.get("user").id);
  if (!snapshot) return c.json({ error: "Incident report snapshot could not be loaded." }, 500);
  return c.json({ snapshot });
});

reportRoutes.patch("/:id/status", updateReportStatusController);
reportRoutes.patch("/:id", updateReportDetailsController);
reportRoutes.get("/", listReportsController);
reportRoutes.get("/:id", getReportByIdController);

export default reportRoutes;

