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
import { stripSelectedDetails } from "../utils/stripSelectedDetails";

const incidentChatRooms = new Map<string, Set<WebSocket>>();

function joinIncidentRoom(incidentId: string, ws: WebSocket) {
  let room = incidentChatRooms.get(incidentId);
  if (!room) {
    room = new Set();
    incidentChatRooms.set(incidentId, room);
  }
  room.add(ws);
}

function leaveIncidentRoom(incidentId: string, ws: WebSocket) {
  const room = incidentChatRooms.get(incidentId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) incidentChatRooms.delete(incidentId);
}

function broadcastIncidentChatMessage(incidentId: string, message: Record<string, unknown>) {
  const room = incidentChatRooms.get(incidentId);
  if (!room || room.size === 0) return;
  const payload = JSON.stringify({ type: "message", message });
  for (const socket of [...room]) {
    try {
      socket.send(payload);
    } catch {
      room.delete(socket);
    }
  }
}

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
              : meta.for_funding
                ? "For Funding"
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
      description: stripSelectedDetails(row.description_sanitized),
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
reportRoutes.get("/:id/handover-summary", async (c) => {
  const id = c.req.param("id")?.trim();
  if (!id) return c.text("Incident ID is required.", 400);
  const db = c.env.geofix167_db;

  const esc = (val: unknown) =>
    String(val ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const report = await db.prepare(`
    SELECT r.incident_id, COALESCE(printf('GF-%03d', ref.reference_sequence), r.incident_id) AS reference_number,
      r.title, r.category, r.priority_code, r.location_description, r.latitude, r.longitude,
      COALESCE(r.description_sanitized, r.description_original, '') AS description,
      r.submitted_at, r.closed_at,
      s.display_name AS status_name,
      COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), gs.display_name, 'Guest Reporter') AS reporter_name,
      COALESCE(r.callback_mobile_number, gs.contact_mobile_number, '') AS reporter_phone
    FROM incident_reports r
    JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
    LEFT JOIN incident_report_references ref ON ref.incident_id = r.incident_id
    LEFT JOIN users u ON u.user_id = r.reported_by_user_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    WHERE r.incident_id = ? OR printf('GF-%03d', ref.reference_sequence) = ?
    ORDER BY CASE WHEN r.incident_id = ? THEN 0 ELSE 1 END
    LIMIT 1
  `).bind(id, id, id).first<Record<string, unknown>>();

  if (!report) return c.text("Incident report not found.", 404);
  const incidentId = String(report.incident_id);

  const [handoverRow, agencyEvents, photoRows] = await Promise.all([
    db.prepare(`
      SELECT qr_handover_id, receiving_remarks, created_at
      FROM qr_handovers
      WHERE incident_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(incidentId).first<{ qr_handover_id: string; receiving_remarks: string | null; created_at: string }>().catch(() => null),
    db.prepare(`
      SELECT note, created_at
      FROM incident_status_events
      WHERE incident_id = ? AND note LIKE '[AGENCY REPORT]%'
      ORDER BY created_at DESC
    `).bind(incidentId).all<{ note: string; created_at: string }>().catch(() => ({ results: [] })),
    db.prepare(`
      SELECT incident_media_id AS id, COALESCE(original_filename, 'photo.jpg') AS filename, created_at
      FROM incident_media
      WHERE incident_id = ? AND media_type = 'PHOTO'
      ORDER BY created_at ASC
    `).bind(incidentId).all<{ id: string; filename: string; created_at: string }>().catch(() => ({ results: [] })),
  ]);

  let parsedHandover: Record<string, unknown> = {};
  if (handoverRow?.receiving_remarks) {
    try {
      parsedHandover = JSON.parse(handoverRow.receiving_remarks) as Record<string, unknown>;
    } catch {
      parsedHandover = { further_info: handoverRow.receiving_remarks };
    }
  }

  const patients = Array.isArray(parsedHandover.patients)
    ? (parsedHandover.patients as Array<Record<string, unknown>>)
    : [];
  const hospitalName = typeof parsedHandover.hospital_name === "string" ? parsedHandover.hospital_name : "";
  const reportType = typeof parsedHandover.report_type === "string" ? parsedHandover.report_type : "Emergency Incident Handover Summary";
  const furtherInfo = stripSelectedDetails(parsedHandover.further_info);
  const cleanDescription = stripSelectedDetails(report.description);

  const photoContext = (fname: string, idx: number) => {
    if (/^fire-/i.test(fname)) return "BFP Completion Proof Photo";
    if (/^police-/i.test(fname)) return "Police Completion Proof Photo";
    if (/^(tanod-|transport-proof)/i.test(fname)) return "Tanod Transport / Handover Proof Photo";
    return `Incident Scene Photo #${idx + 1} (Submitted by Reporter)`;
  };

  const personsHtml = patients.length > 0
    ? patients.map((p, idx) => `
      <tr>
        <td><strong>${idx === 0 ? "Reporter's Information" : `Additional Person #${idx}`}</strong></td>
        <td>${esc(p.full_name || "N/A")}</td>
        <td>${esc(p.contact || "—")}</td>
        <td>${esc(p.age || "—")}</td>
        <td>${esc(p.sex || "—")}</td>
        <td>${esc(p.condition || p.role_in_incident || "—")}</td>
        <td>${esc(p.notes || "—")}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="7" style="text-align:center;color:#64748b;">No additional patient/person records attached.</td></tr>`;

  const photosHtml = (photoRows.results ?? []).length > 0
    ? `<div class="photo-grid">${(photoRows.results ?? []).map((p, idx) => `
      <figure class="photo-card">
        <img src="/api/reports/${encodeURIComponent(incidentId)}/photos/${encodeURIComponent(p.id)}" alt="${esc(p.filename)}" />
        <figcaption><strong>${esc(photoContext(p.filename, idx))}</strong><span>${esc(p.created_at || "")}</span></figcaption>
      </figure>
    `).join("")}</div>`
    : `<p class="muted">No photographic evidence attached.</p>`;

  const agencyHtml = (agencyEvents.results ?? []).length > 0
    ? `<section class="card"><h2>Responder Resolution Log</h2><ul>${(agencyEvents.results ?? [])
      .map((ev) => `<li><strong>${esc(ev.created_at)}:</strong> ${esc(stripSelectedDetails(ev.note.replace(/^\[AGENCY REPORT\]\s*/, "")))}</li>`)
      .join("")}</ul></section>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>GeoFix 167 — Incident Summary (${esc(report.reference_number)})</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 24px; }
  .sheet { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 28px; box-shadow: 0 4px 20px rgba(15,23,42,.06); }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #1f7a4d; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #1f7a4d; }
  h1 { margin: 4px 0 0; font-size: 20px; }
  .sub { color: #475569; font-size: 12px; margin-top: 4px; }
  .btn-print { background: #1f7a4d; color: #fff; border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 700; font-size: 12px; cursor: pointer; }
  .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-bottom: 18px; font-size: 12px; }
  .meta div strong { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; }
  .card { margin-bottom: 18px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #1f7a4d; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin: 0 0 10px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #334155; }
  .photo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .photo-card { margin: 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fff; break-inside: avoid; }
  .photo-card img { width: 100%; height: 220px; object-fit: cover; display: block; background: #e2e8f0; }
  .photo-card figcaption { padding: 8px 10px; font-size: 11px; color: #334155; display: flex; justify-content: space-between; gap: 8px; }
  .photo-card figcaption span { color: #64748b; font-size: 10px; }
  .muted { color: #64748b; font-size: 12px; }
  ul { margin: 0; padding-left: 18px; font-size: 12px; line-height: 1.5; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: 0; box-shadow: none; padding: 0; max-width: none; }
    .btn-print { display: none; }
  }
</style>
</head>
<body>
  <main class="sheet">
    <header class="top">
      <div>
        <div class="brand">GeoFix 167 • Barangay 167, Caloocan City</div>
        <h1>${esc(reportType)}</h1>
        <div class="sub">Reference: <strong>${esc(report.reference_number)}</strong> • Generated ${esc(new Date().toLocaleString("en-PH"))}</div>
      </div>
      <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
    </header>

    <section class="meta">
      <div><strong>Incident Title</strong>${esc(report.title || "Emergency Incident")}</div>
      <div><strong>Category &amp; Priority</strong>${esc(report.category || "Emergency")} (${esc(report.priority_code || "P1")})</div>
      <div><strong>Status</strong>${esc(report.status_name || "Active")}</div>
      <div><strong>Reported At</strong>${esc(report.submitted_at || "—")}</div>
      <div><strong>Location</strong>${esc(report.location_description || "Barangay 167")}</div>
      <div><strong>Coordinates</strong>${report.latitude != null && report.longitude != null ? `${esc(report.latitude)}, ${esc(report.longitude)}` : "—"}</div>
      <div><strong>Reporter</strong>${esc(report.reporter_name)}${report.reporter_phone ? ` (${esc(report.reporter_phone)})` : ""}</div>
      ${hospitalName ? `<div><strong>Receiving Hospital</strong>${esc(hospitalName)}</div>` : ""}
    </section>

    <section class="card">
      <h2>Incident Description &amp; Handover Notes</h2>
      <div class="box">${esc(furtherInfo || cleanDescription || "No additional description provided.")}</div>
    </section>

    <section class="card">
      <h2>Involved Persons / Patient Information</h2>
      <table>
        <thead>
          <tr><th>Role</th><th>Full Name</th><th>Contact</th><th>Age</th><th>Sex</th><th>Condition / Type</th><th>Notes</th></tr>
        </thead>
        <tbody>${personsHtml}</tbody>
      </table>
    </section>

    ${agencyHtml}

    <section class="card">
      <h2>Attached Photographic Evidence</h2>
      ${photosHtml}
    </section>
  </main>
</body>
</html>`;

  return c.html(html, 200);
});
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

async function ensureIncidentChatTables(db: AppEnv["Bindings"]["geofix167_db"]) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS incident_chat_threads (
        incident_chat_thread_id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL REFERENCES incident_reports(incident_id) ON DELETE CASCADE,
        thread_type TEXT NOT NULL CHECK (thread_type IN ('INCIDENT_GROUP', 'DIRECT_SUPPORT')),
        created_by_user_id TEXT REFERENCES users(user_id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        archived_at TEXT
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS incident_chat_messages (
        incident_chat_message_id TEXT PRIMARY KEY,
        incident_chat_thread_id TEXT NOT NULL REFERENCES incident_chat_threads(incident_chat_thread_id) ON DELETE CASCADE,
        sender_user_id TEXT NOT NULL REFERENCES users(user_id),
        body TEXT NOT NULL,
        sent_at TEXT NOT NULL DEFAULT (datetime('now')),
        edited_at TEXT,
        deleted_at TEXT
      )
    `),
  ]).catch(() => {});
}

async function ensureIncidentChatThread(db: AppEnv["Bindings"]["geofix167_db"], incidentId: string, userId: string) {
  await ensureIncidentChatTables(db);
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

async function resolveIncidentForChat(
  db: AppEnv["Bindings"]["geofix167_db"],
  id: string,
  currentUser: AppEnv["Variables"]["user"],
): Promise<{ incident_id: string; is_closed: boolean }> {
  const report = await db.prepare(`
    SELECT r.incident_id, r.reported_by_user_id, r.incident_status_id
    FROM incident_reports r
    LEFT JOIN incident_report_references ref ON ref.incident_id = r.incident_id
    WHERE r.incident_id = ? OR printf('GF-%03d', ref.reference_sequence) = ?
    ORDER BY CASE WHEN r.incident_id = ? THEN 0 ELSE 1 END
    LIMIT 1
  `).bind(id, id, id).first<{
    incident_id: string;
    reported_by_user_id: string | null;
    incident_status_id: number;
  }>();

  if (!report) {
    throw new ReportError("Incident report not found.", 404);
  }

  const role = String(currentUser.role || "").toLowerCase();
  const isOwner = report.reported_by_user_id === currentUser.id;
  const isStaff = role === "admin" || role === "bdrrmo";
  let isAssignedResponder = false;

  if (!isOwner && !isStaff && ["police", "fire", "tanod"].includes(role)) {
    const [agencyMatch, tanodMatch] = await Promise.all([
      db.prepare(`
        SELECT responder_dispatch_id
        FROM responder_dispatches
        WHERE incident_id = ? AND lower(target_role) = ?
        LIMIT 1
      `).bind(report.incident_id, role).first().catch(() => null),
      db.prepare(`
        SELECT tanod_assignment_id
        FROM tanod_assignments
        WHERE incident_id = ? AND tanod_user_id = ?
        LIMIT 1
      `).bind(report.incident_id, currentUser.id).first().catch(() => null),
    ]);
    isAssignedResponder = Boolean(agencyMatch || tanodMatch);
  }

  if (!isOwner && !isStaff && !isAssignedResponder) {
    throw new ReportError("You do not have access to this incident chat.", 403);
  }

  return {
    incident_id: report.incident_id,
    is_closed: [10, 11, 12].includes(Number(report.incident_status_id)),
  };
}

reportRoutes.get("/:id/messages/ws", requireAuth, async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade." }, 426);
  }
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident report ID is required." }, 400);
  const currentUser = c.get("user");
  const db = c.env.geofix167_db;

  try {
    await ensureIncidentChatTables(db);
    const report = await resolveIncidentForChat(db, id, currentUser);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    joinIncidentRoom(report.incident_id, server);

    server.addEventListener("close", () => {
      leaveIncidentRoom(report.incident_id, server);
    });
    server.addEventListener("error", () => {
      leaveIncidentRoom(report.incident_id, server);
    });
    server.addEventListener("message", async (event) => {
      try {
        const parsed = JSON.parse(String(event.data || "{}")) as { type?: string; body?: string };
        if (parsed.type === "ping") {
          server.send(JSON.stringify({ type: "pong" }));
          return;
        }
        const text = String(parsed.body || "").trim();
        if (!text || text.length > 2000) return;
        const threadId = await ensureIncidentChatThread(db, report.incident_id, currentUser.id);
        const messageId = crypto.randomUUID();
        const sentAt = new Date().toISOString();
        await db.prepare(`
          INSERT INTO incident_chat_messages (incident_chat_message_id, incident_chat_thread_id, sender_user_id, body, sent_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(messageId, threadId, currentUser.id, text, sentAt).run();
        broadcastIncidentChatMessage(report.incident_id, {
          id: messageId,
          sender_user_id: currentUser.id,
          sender_name: currentUser.full_name,
          sender_role: currentUser.role,
          body: text,
          sent_at: sentAt,
        });
      } catch {
        // Ignore malformed WS frames
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  } catch (error) {
    if (error instanceof ReportError) {
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404);
    }
    return c.json({ error: "Unable to establish WebSocket connection." }, 500);
  }
});

reportRoutes.get("/:id/messages", requireAuth, async (c) => {
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident report ID is required." }, 400);
  const currentUser = c.get("user");
  const db = c.env.geofix167_db;

  try {
    await ensureIncidentChatTables(db);
    const report = await resolveIncidentForChat(db, id, currentUser);
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
        COALESCE(lower(ro.code), 'resident') AS sender_role
      FROM incident_chat_messages m
      LEFT JOIN users u ON u.user_id = m.sender_user_id
      LEFT JOIN roles ro ON ro.role_id = u.role_id
      WHERE m.incident_chat_thread_id = ? AND m.deleted_at IS NULL
      ORDER BY m.sent_at ASC
      LIMIT 200
    `).bind(thread.id).all();
    return c.json({ messages: rows.results ?? [] });
  } catch (error) {
    if (error instanceof ReportError) {
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404);
    }
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Failed to load incident messages:", detail);
    return c.json({ error: `Unable to load messages: ${detail}` }, 500);
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
    await ensureIncidentChatTables(db);
    const report = await resolveIncidentForChat(db, id, currentUser);
    if (report.is_closed) {
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

    const savedMessage = {
      id: messageId,
      sender_user_id: currentUser.id,
      sender_name: currentUser.full_name,
      sender_role: currentUser.role,
      body: body.data.body,
      sent_at: sentAt,
    };
    broadcastIncidentChatMessage(report.incident_id, savedMessage);

    return c.json({ message: savedMessage }, 201);
  } catch (error) {
    if (error instanceof ReportError) {
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404);
    }
    console.error("Failed to send incident message:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
});

reportRoutes.delete("/:id", requireAuth, async (c) => {
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident report ID is required." }, 400);
  const currentUser = c.get("user");
  const db = c.env.geofix167_db;

  const report = await db.prepare(`
    SELECT incident_id, reported_by_user_id, incident_status_id
    FROM incident_reports
    WHERE incident_id = ?
    LIMIT 1
  `).bind(id).first<{ incident_id: string; reported_by_user_id: string | null; incident_status_id: number }>();

  if (!report || report.reported_by_user_id !== currentUser.id) {
    return c.json({ error: "Incident report not found." }, 404);
  }
  if (![1, 2, 3, 11].includes(Number(report.incident_status_id))) {
    return c.json({ error: "Only rejected or pending draft reports can be discarded." }, 409);
  }

  await db.prepare(`DELETE FROM incident_reports WHERE incident_id = ?`).bind(report.incident_id).run();
  return c.json({ ok: true, discarded: true });
});

reportRoutes.patch("/:id/status", updateReportStatusController);
reportRoutes.patch("/:id", updateReportDetailsController);
reportRoutes.get("/", listReportsController);
reportRoutes.get("/:id", getReportByIdController);

export default reportRoutes;

