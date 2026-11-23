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
import { getIncidentReportDetails, ReportError } from "../services/report.service";

const reportRoutes = new Hono<AppEnv>();
const resolveSchema = z.object({
  closure_mode: z.enum(["proof", "no-proof"]).optional(),
  resolution_notes: z.string().trim().max(4000).optional(),
}).strict();
const chatMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

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
reportRoutes.get("/map-feed", async (c) => {
  const db = c.env.geofix167_db;
  const rows = await db.prepare(`
    SELECT r.incident_id, COALESCE(printf('GF-%03d', rr.reference_sequence), r.incident_id) AS reference_number,
      r.title, r.category, r.description_sanitized, r.is_emergency,
      r.latitude, r.longitude, r.location_description, r.incident_status_id, r.assigned_team,
      r.submitted_at, ta.notes AS maint_notes, ta.assignment_status_id
    FROM incident_reports r
    LEFT JOIN incident_report_references rr ON rr.incident_id = r.incident_id
    LEFT JOIN tanod_assignments ta ON ta.incident_id = r.incident_id
    WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      AND r.incident_status_id NOT IN (11, 12)
    ORDER BY r.submitted_at DESC
    LIMIT 100
  `).all<Record<string, unknown>>();

  const items = rows.results.map((row) => {
    const isEmergency = Number(row.is_emergency) === 1;
    const statusId = Number(row.incident_status_id);
    let stage = statusId === 10 ? "Resolved" : statusId >= 6 ? "In Progress" : "Reported";
    let inspectionDone = false;
    let repairDone = false;
    if (!isEmergency && typeof row.maint_notes === "string" && row.maint_notes.startsWith("{")) {
      try {
        const meta = JSON.parse(row.maint_notes);
        if (meta?.type === "MAINTENANCE") {
          inspectionDone = Boolean(meta.inspection_done);
          repairDone = Boolean(meta.repair_done);
          stage = statusId === 10 || Number(row.assignment_status_id) === 5
            ? "Verified Fixed"
            : meta.repair_done
              ? "Proof of Repair Submitted"
              : meta.inspection_done
                ? "Area Inspected"
                : "Assigned to Tanod";
        }
      } catch { /* ignore */ }
    }
    return {
      id: String(row.incident_id),
      reference_number: String(row.reference_number || row.incident_id),
      title: String(row.title || row.category || "Incident"),
      category: String(row.category || (isEmergency ? "emergency" : "infrastructure")),
      report_type: isEmergency ? "emergency" : "maintenance",
      description: String(row.description_sanitized || ""),
      location: String(row.location_description || "Barangay 167"),
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      status: stage,
      assigned_team: String(row.assigned_team || ""),
      inspection_done: inspectionDone,
      repair_done: repairDone,
      submitted_at: String(row.submitted_at || ""),
    };
  });

  return c.json({ items });
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
reportRoutes.get("/:id/photos/:mediaId", getReportPhoto);
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

async function ensureIncidentChatThread(db: AppEnv["Bindings"]["geofix167_db"], incidentId: string, userId: string) {
  const existing = await db.prepare(`
    SELECT incident_chat_thread_id AS id
    FROM incident_chat_threads
    WHERE incident_id = ? AND thread_type = 'INCIDENT_GROUP' AND archived_at IS NULL
    LIMIT 1
  `).bind(incidentId).first<{ id: string }>();
  if (existing) return existing.id;

  const threadId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO incident_chat_threads (incident_chat_thread_id, incident_id, thread_type, created_by_user_id)
    VALUES (?, ?, 'INCIDENT_GROUP', ?)
  `).bind(threadId, incidentId, userId).run();
  return threadId;
}

reportRoutes.get("/:id/messages", requireAuth, async (c) => {
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident report ID is required." }, 400);
  const currentUser = c.get("user");
  const db = c.env.geofix167_db;

  try {
    const report = await getIncidentReportDetails(db, id, currentUser);
    const thread = await db.prepare(`
      SELECT incident_chat_thread_id AS id
      FROM incident_chat_threads
      WHERE incident_id = ? AND thread_type = 'INCIDENT_GROUP' AND archived_at IS NULL
      LIMIT 1
    `).bind(report.incident_id).first<{ id: string }>();
    if (!thread) return c.json({ messages: [] });

    const rows = await db.prepare(`
      SELECT m.incident_chat_message_id AS id, m.sender_user_id, m.body, m.sent_at,
        COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), 'User') AS sender_name,
        COALESCE(
          (SELECT lower(ro.code) FROM user_roles ur JOIN roles ro ON ro.role_id = ur.role_id WHERE ur.user_id = u.user_id LIMIT 1),
          'resident'
        ) AS sender_role
      FROM incident_chat_messages m
      JOIN users u ON u.user_id = m.sender_user_id
      WHERE m.incident_chat_thread_id = ? AND m.deleted_at IS NULL
      ORDER BY m.sent_at ASC
      LIMIT 200
    `).bind(thread.id).all();
    return c.json({ messages: rows.results ?? [] });
  } catch (error) {
    if (error instanceof ReportError) {
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404);
    }
    console.error("Failed to load incident messages:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
});

reportRoutes.post("/:id/messages", requireAuth, async (c) => {
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident report ID is required." }, 400);
  const body = chatMessageSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "A valid message is required." }, 400);

  const currentUser = c.get("user");
  const db = c.env.geofix167_db;
  try {
    const report = await getIncidentReportDetails(db, id, currentUser);
    if (report.is_terminal === 1 || report.status_code === "CLOSED") {
      return c.json({ error: "This incident is completed. Messaging is read-only." }, 409);
    }
    if (["police", "fire"].includes(currentUser.role)) {
      const dispatch = await db.prepare(`
        SELECT status FROM responder_dispatches
        WHERE incident_id = ? AND target_role = ?
        ORDER BY dispatched_at DESC LIMIT 1
      `).bind(report.incident_id, currentUser.role).first<{ status: string }>();
      if (dispatch && ["COMPLETED", "DECLINED"].includes(dispatch.status)) {
        return c.json({ error: "This incident is completed. Messaging is read-only." }, 409);
      }
    }
    const threadId = await ensureIncidentChatThread(db, report.incident_id, currentUser.id);
    const messageId = crypto.randomUUID();
    const sentAt = new Date().toISOString();

    await db.prepare(`
      INSERT INTO incident_chat_messages (incident_chat_message_id, incident_chat_thread_id, sender_user_id, body, sent_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(messageId, threadId, currentUser.id, body.data.body, sentAt).run();

    return c.json({
      message: {
        id: messageId,
        sender_user_id: currentUser.id,
        sender_name: currentUser.full_name,
        sender_role: currentUser.role,
        body: body.data.body,
        sent_at: sentAt,
      },
    }, 201);
  } catch (error) {
    if (error instanceof ReportError) {
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404);
    }
    console.error("Failed to send incident message:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
});

reportRoutes.patch("/:id/status", updateReportStatusController);
reportRoutes.patch("/:id", updateReportDetailsController);
reportRoutes.get("/", listReportsController);
reportRoutes.get("/:id", getReportByIdController);

export default reportRoutes;

