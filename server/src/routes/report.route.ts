import { getCookie } from "hono/cookie";
import { requireAuth } from "../middleware/auth";
import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { bodyLimit } from "hono/body-limit";
import { getReportPhoto, listAttachments, uploadAttachment } from "../controllers/attachment.controller";
import { MAX_GUEST_REPORT_UPLOAD_BYTES, MAX_UPLOAD_BYTES } from "../services/attachment.service";
import { reverseGeocodeCoordinates } from "../services/reverseGeocode.service";
import {
  createReportController,
  updateReportStatusController, updateReportDetailsController,
  getReportByIdController,
  listReportsController,
} from "../controllers/report.controller";

const reportRoutes = new Hono<AppEnv>();

reportRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (getCookie(c, "geofix_session")) return requireAuth(c, next);
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
reportRoutes.post("/:id/resolve", requireAuth, async (c) => {
  const incidentId = c.req.param("id")?.trim();
  if (!incidentId) return c.json({ error: "Incident ID is required." }, 400);
  const currentUser = c.get("user");
  const db = c.env.geofix167_db;

  await db.batch([
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 10, closed_at = datetime('now'), closed_by_user_id = ?, updated_at = datetime('now')
      WHERE incident_id = ?
    `).bind(currentUser?.id ?? null, incidentId),
    db.prepare(`
      UPDATE tanod_assignments
      SET assignment_status_id = 5, completed_at = COALESCE(completed_at, datetime('now'))
      WHERE incident_id = ?
    `).bind(incidentId),
    db.prepare(`
      UPDATE responder_dispatches
      SET status = 'COMPLETED'
      WHERE incident_id = ?
    `).bind(incidentId),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      VALUES (?, ?, 9, 10, ?, 'Admin marked incident as resolved after handover verification')
    `).bind(crypto.randomUUID(), incidentId, currentUser?.id ?? null),
  ]);

  return c.json({ ok: true, status: "CLOSED" });
});

reportRoutes.patch("/:id/status", updateReportStatusController);
reportRoutes.patch("/:id", updateReportDetailsController);
reportRoutes.get("/", listReportsController);
reportRoutes.get("/:id", getReportByIdController);

export default reportRoutes;

