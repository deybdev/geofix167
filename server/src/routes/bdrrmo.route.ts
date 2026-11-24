import { notify } from "../services/notifications";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import { ensureIncidentReportSnapshot } from "../services/incidentReportSnapshot.service";
import { stripSelectedDetails } from "../utils/stripSelectedDetails";
import type { AppEnv } from "../types/env";

const route = new Hono<AppEnv>();
route.use("*", requireAuth, requireRole("bdrrmo", "admin"));

function isFireCategory(category = "", title = "") {
  return /fire|burn|smoke|blaze|sunog/i.test(`${category} ${title}`);
}

function isCrimeCategory(category = "", title = "") {
  return /crime|theft|robbery|assault|fight|weapon|violence|holdup|hold-up|stab|shoot/i.test(`${category} ${title}`);
}

route.get("/overview", async (c) => {
  const db = c.env.geofix167_db;

  const [incidentRows, dispatchRows, tanodAssignRows, unitRows, locationRows, handoverRows, eventRows, mediaRows] = await Promise.all([
    db.prepare(`
      SELECT r.incident_id, COALESCE(printf('GF-%03d', rr.reference_sequence), r.incident_id) AS reference_number,
        r.title, r.category, r.description_sanitized, r.description_original,
        r.latitude, r.longitude, r.location_description, r.submitted_at, r.closed_at, r.priority_code,
        r.is_emergency, r.incident_status_id, s.code AS status_code, s.display_name AS status_label,
        COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), gs.display_name, 'Guest') AS reporter_name,
        COALESCE(r.callback_mobile_number, gs.contact_mobile_number, '') AS reporter_phone,
        CASE
          WHEN s.code = 'FORWARDED_TO_BDRRMO' OR s.code = 'VERIFIED' THEN 'VERIFIED_EMERGENCY'
          WHEN s.code IN ('SUBMITTED', 'UNDER_REVIEW') AND datetime(r.submitted_at, '+60 seconds') <= datetime('now') THEN 'BDRRMO_ESCALATION'
          ELSE 'ACTIVE'
        END AS review_type
      FROM incident_reports r
      JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
      LEFT JOIN incident_report_references rr ON rr.incident_id = r.incident_id
      LEFT JOIN users u ON u.user_id = r.reported_by_user_id
      LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
      WHERE r.is_emergency = 1
        AND (
          s.code IN ('FORWARDED_TO_BDRRMO', 'VERIFIED', 'ASSIGNED', 'EN_ROUTE', 'ON_SCENE', 'FOR_CLOSURE_REVIEW', 'CLOSED')
          OR r.incident_status_id IN (4, 5, 6, 7, 8, 9, 10, 13, 14)
          OR (s.code IN ('SUBMITTED', 'UNDER_REVIEW') AND datetime(r.submitted_at, '+60 seconds') <= datetime('now'))
        )
      ORDER BY r.submitted_at DESC
      LIMIT 100
    `).all<Record<string, unknown>>(),

    db.prepare(`
      SELECT responder_dispatch_id AS id, incident_id, target_role, status,
        urgency, vehicle_name, dispatched_at
      FROM responder_dispatches
      ORDER BY dispatched_at DESC
      LIMIT 200
    `).all<Record<string, unknown>>(),

    db.prepare(`
      SELECT ta.tanod_assignment_id AS id, ta.incident_id, ta.tanod_user_id,
        ta.responder_resource_id, ta.assignment_status_id, ta.assigned_at, ta.accepted_at, ta.completed_at,
        rr.display_name AS unit_name,
        COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), rr.display_name, 'Tanod') AS responder_name,
        CASE ta.assignment_status_id
          WHEN 1 THEN 'OFFERED'
          WHEN 2 THEN 'ACCEPTED'
          WHEN 3 THEN 'DECLINED'
          WHEN 4 THEN 'EN_ROUTE'
          WHEN 5 THEN 'ON_SCENE'
          WHEN 6 THEN 'COMPLETED'
          ELSE 'OFFERED'
        END AS status_code
      FROM tanod_assignments ta
      JOIN incident_reports r ON r.incident_id = ta.incident_id
      LEFT JOIN responder_resources rr ON rr.responder_resource_id = ta.responder_resource_id
      LEFT JOIN users u ON u.user_id = ta.tanod_user_id
      WHERE r.is_emergency = 1
      ORDER BY ta.assigned_at DESC
      LIMIT 200
    `).all<Record<string, unknown>>(),

    db.prepare(`
      SELECT rr.responder_resource_id AS id, rr.display_name, rr.resource_type,
        rr.availability_status, rr.responder_user_id, rr.updated_at,
        COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), rr.display_name) AS responder_name
      FROM responder_resources rr
      LEFT JOIN users u ON u.user_id = rr.responder_user_id
      WHERE rr.resource_type IN ('TANOD', 'VEHICLE')
      ORDER BY rr.display_name
    `).all<Record<string, unknown>>(),

    db.prepare(`
      SELECT assignment_id, responder_id, lat, lng, accuracy, heading, updated_at
      FROM responder_locations
    `).all<Record<string, unknown>>().catch(() => ({ results: [] })),

    db.prepare(`
      SELECT qh.qr_handover_id AS id, qh.incident_id,
        COALESCE(printf('GF-%03d', rr.reference_sequence), qh.incident_id) AS reference_number,
        qs.code AS qr_status_code,
        qh.receiving_officer_name, qh.receiving_remarks, qh.created_at, qh.accepted_at, qh.expires_at
      FROM qr_handovers qh
      JOIN qr_statuses qs ON qs.qr_status_id = qh.qr_status_id
      LEFT JOIN incident_report_references rr ON rr.incident_id = qh.incident_id
      ORDER BY qh.created_at DESC
      LIMIT 100
    `).all<Record<string, unknown>>().catch(() => ({ results: [] })),

    db.prepare(`
      SELECT incident_status_event_id AS id, incident_id, note, created_at
      FROM incident_status_events
      WHERE note IS NOT NULL AND trim(note) != ''
      ORDER BY created_at DESC
      LIMIT 300
    `).all<Record<string, unknown>>().catch(() => ({ results: [] })),

    db.prepare(`
      SELECT incident_id, incident_media_id AS id, original_filename, uploaded_by_user_id, created_at
      FROM incident_media
      WHERE media_type = 'PHOTO'
      ORDER BY created_at ASC
    `).all<Record<string, unknown>>().catch(() => ({ results: [] })),
  ]);

  const locByAssignment = new Map<string, Record<string, unknown>>();
  for (const loc of locationRows.results ?? []) {
    locByAssignment.set(String(loc.assignment_id), loc);
  }

  const eventsByIncident = new Map<string, Array<{ id: string; note: string; created_at: string }>>();
  for (const ev of eventRows.results ?? []) {
    const key = String(ev.incident_id);
    const list = eventsByIncident.get(key) ?? [];
    list.push({ id: String(ev.id), note: String(ev.note), created_at: String(ev.created_at) });
    eventsByIncident.set(key, list);
  }

  const photosByIncident = new Map<string, Array<{ id: string; filename: string; by_staff: boolean; created_at: string }>>();
  for (const m of mediaRows.results ?? []) {
    const key = String(m.incident_id);
    const list = photosByIncident.get(key) ?? [];
    const fname = String(m.original_filename || "evidence.jpg");
    list.push({
      id: String(m.id),
      filename: fname,
      by_staff: /^(fire|police|tanod|transport-proof|maintenance)/i.test(fname),
      created_at: String(m.created_at),
    });
    photosByIncident.set(key, list);
  }

  const unitsByIncident = new Map<string, Array<Record<string, unknown>>>();
  for (const rd of dispatchRows.results ?? []) {
    const key = String(rd.incident_id);
    const list = unitsByIncident.get(key) ?? [];
    const loc = locByAssignment.get(String(rd.id)) ?? null;
    list.push({
      id: String(rd.id),
      incident_id: key,
      role: String(rd.target_role),
      label: rd.target_role === "fire" ? "BFP (Fire)" : rd.target_role === "police" ? "Police (PNP)" : String(rd.target_role).toUpperCase(),
      status: String(rd.status),
      vehicle_name: rd.vehicle_name || null,
      dispatched_at: rd.dispatched_at,
      location: loc ? { lat: Number(loc.lat), lng: Number(loc.lng), heading: loc.heading, updated_at: loc.updated_at } : null,
    });
    unitsByIncident.set(key, list);
  }

  for (const ta of tanodAssignRows.results ?? []) {
    const key = String(ta.incident_id);
    const list = unitsByIncident.get(key) ?? [];
    const loc = locByAssignment.get(String(ta.id)) ?? null;
    list.push({
      id: String(ta.id),
      incident_id: key,
      role: "tanod",
      label: `Tanod Transport (${ta.responder_name || ta.unit_name || "Tanod"})`,
      status: String(ta.status_code),
      vehicle_name: ta.unit_name || null,
      dispatched_at: ta.assigned_at,
      accepted_at: ta.accepted_at || null,
      completed_at: ta.completed_at || null,
      location: loc ? { lat: Number(loc.lat), lng: Number(loc.lng), heading: loc.heading, updated_at: loc.updated_at } : null,
    });
    unitsByIncident.set(key, list);
  }

  const incidents = (incidentRows.results ?? []).map((row) => {
    const incId = String(row.incident_id);
    const units = unitsByIncident.get(incId) ?? [];
    const events = eventsByIncident.get(incId) ?? [];
    const photos = photosByIncident.get(incId) ?? [];
    const tacticalNotes = events.filter((e) => e.note.startsWith("[BDRRMO NOTE]"));
    const backupAlerts = events.filter((e) => e.note.startsWith("[BACKUP REQUEST]"));
    const agencyReports = events.filter((e) => e.note.startsWith("[AGENCY REPORT]"));
    const verifiedEvent = events.find((e) => e.note.startsWith("[BDRRMO VERIFIED]"));

    const rawStatus = String(row.status_code || "FORWARDED_TO_BDRRMO");
    const mappedStatus = ["SUBMITTED", "UNDER_REVIEW", "VERIFIED"].includes(rawStatus)
      ? "FORWARDED_TO_BDRRMO"
      : rawStatus;

    const latestCompletionEvent = agencyReports[0]?.created_at
      || events.find((e) => e.note.startsWith("Hospital QR handover generated"))?.created_at
      || null;
    const completedAt = latestCompletionEvent || (row.closed_at ? String(row.closed_at) : null);

    return {
      id: String(row.reference_number || incId),
      incidentId: incId,
      serverBacked: true,
      title: String(row.title || "Emergency Incident"),
      category: String(row.category || "Emergency"),
      location: String(row.location_description || "Barangay 167"),
      lat: row.latitude == null ? null : Number(row.latitude),
      lng: row.longitude == null ? null : Number(row.longitude),
      priorityCode: String(row.priority_code || "P1"),
      incidentStatusCode: mappedStatus,
      reviewType: String(row.review_type || "VERIFIED_EMERGENCY"),
      submittedAt: String(row.submitted_at || ""),
      closedAt: row.closed_at ? String(row.closed_at) : null,
      completedAt,
      reporterName: String(row.reporter_name || "Guest"),
      reporterPhone: String(row.reporter_phone || ""),
      description: stripSelectedDetails(row.description_sanitized || row.description_original) || "No description provided.",
      lockedDepartments: {
        fire: isFireCategory(String(row.category || ""), String(row.title || "")),
        police: isCrimeCategory(String(row.category || ""), String(row.title || "")),
      },
      dispatchedUnits: units,
      tacticalNotes,
      backupAlerts,
      agencyReports,
      bdrrmoVerified: Boolean(verifiedEvent),
      bdrrmoVerificationNote: verifiedEvent?.note.replace("[BDRRMO VERIFIED] ", "") || null,
      photos,
    };
  });

  const roleUserRows = await db.prepare(`
    SELECT lower(ro.code) AS role_code, COUNT(DISTINCT u.user_id) AS total
    FROM users u
    JOIN roles ro ON ro.role_id = u.role_id
    LEFT JOIN responder_resources rr ON rr.responder_user_id = u.user_id
    WHERE lower(ro.code) IN ('fire', 'police', 'tanod')
      AND COALESCE(rr.availability_status, 'AVAILABLE') = 'AVAILABLE'
    GROUP BY lower(ro.code)
  `).all<{ role_code: string; total: number }>();

  const roleTotals: Record<string, number> = { fire: 0, police: 0, tanod: 0 };
  for (const r of roleUserRows.results ?? []) {
    roleTotals[r.role_code] = Number(r.total) || 0;
  }

  const activeFireCount = (dispatchRows.results ?? []).filter(
    (d) => String(d.target_role) === "fire" && !["COMPLETED", "CANCELLED", "DECLINED"].includes(String(d.status)),
  ).length;
  const activePoliceCount = (dispatchRows.results ?? []).filter(
    (d) => String(d.target_role) === "police" && !["COMPLETED", "CANCELLED", "DECLINED"].includes(String(d.status)),
  ).length;
  const allResponders = unitRows.results ?? [];
  const availableTanods = allResponders.filter(
    (r) => r.resource_type === "TANOD" && r.availability_status === "AVAILABLE",
  ).length;

  return c.json({
    incidents,
    responders: allResponders,
    handovers: handoverRows.results ?? [],
    departmentCounts: {
      fire: Math.max(0, (roleTotals.fire ?? 0) - activeFireCount),
      police: Math.max(0, (roleTotals.police ?? 0) - activePoliceCount),
      tanod: availableTanods,
    },
  });
});

route.post("/incidents/:incidentId/dispatch", requireRole("bdrrmo"), async (c) => {
  const db = c.env.geofix167_db;
  const incidentId = c.req.param("incidentId");
  const body = (await c.req.json().catch(() => null)) as {
    departments?: string[];
    tanod_unit_id?: string | null;
    tactical_note?: string;
    urgency?: string;
  } | null;

  const incident = await db.prepare(`
    SELECT incident_id, title, category, location_description, latitude, longitude, priority_code,
      is_emergency, incident_status_id
    FROM incident_reports
    WHERE incident_id = ?
  `).bind(incidentId).first<{
    incident_id: string;
    title: string;
    category: string | null;
    location_description: string | null;
    latitude: number | null;
    longitude: number | null;
    priority_code: string | null;
    is_emergency: number;
    incident_status_id: number;
  }>();

  if (!incident) return c.json({ error: "Incident not found." }, 404);
  if (incident.is_emergency !== 1) {
    return c.json({ error: "Only emergency incidents can be dispatched by BDRRMO." }, 409);
  }
  if ([10, 11, 12].includes(Number(incident.incident_status_id))) {
    return c.json({ error: "Closed or rejected incidents cannot be dispatched." }, 409);
  }

  const selectedDepts = new Set<string>(
    (body?.departments ?? []).filter((d) => d === "police" || d === "fire" || d === "tanod"),
  );

  if (selectedDepts.size === 0 && !body?.tanod_unit_id) {
    return c.json({ error: "Select at least one department (BFP, Police, or Tanod)." }, 400);
  }

  const [existingAgencyRows, existingTanodRow] = await Promise.all([
    db.prepare(`
      SELECT lower(target_role) AS role
      FROM responder_dispatches
      WHERE incident_id = ? AND status NOT IN ('COMPLETED', 'DECLINED', 'CANCELLED')
    `).bind(incident.incident_id).all<{ role: string }>(),
    db.prepare(`
      SELECT tanod_assignment_id
      FROM tanod_assignments
      WHERE incident_id = ? AND assignment_status_id NOT IN (3, 6, 7)
      LIMIT 1
    `).bind(incident.incident_id).first<{ tanod_assignment_id: string }>(),
  ]);
  const activeAgencyRoles = new Set((existingAgencyRows.results ?? []).map((r) => r.role));

  const currentUser = c.get("user");
  const urgencyLabel = body?.urgency || (incident.priority_code === "P1" ? "Critical" : "High");
  const statements = [];
  const dispatchedDepts: string[] = [];

  for (const role of selectedDepts) {
    if (role === "tanod" || activeAgencyRoles.has(role)) continue;
    dispatchedDepts.push(role);
    const assignmentId = crypto.randomUUID();
    statements.push(
      db.prepare(`
        INSERT INTO responder_dispatches
          (responder_dispatch_id, incident_id, incident_title, incident_category,
           incident_location, incident_latitude, incident_longitude,
           dispatched_by_user_id, target_role, urgency, vehicle_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DISPATCHED')
      `).bind(
        assignmentId,
        incident.incident_id,
        incident.title,
        incident.category || "Emergency",
        incident.location_description || "Barangay 167",
        incident.latitude,
        incident.longitude,
        currentUser.id,
        role,
        urgencyLabel,
        role === "fire" ? "BFP Fire Unit" : "PNP Patrol Unit",
      ),
      notify(db, { type: "team_dispatched", actorId: currentUser.id, eventId: assignmentId, assignmentId,
        reportId: incidentId, recipientRole: "responder", body: role.toUpperCase() + " dispatched to " + incident.title }),
    );
  }

  let tanodDispatched = false;
  if ((body?.tanod_unit_id || selectedDepts.has("tanod")) && !existingTanodRow) {
    const resource = body?.tanod_unit_id
      ? await db.prepare(`
          SELECT responder_resource_id, responder_user_id, display_name
          FROM responder_resources
          WHERE responder_resource_id = ? AND responder_user_id IS NOT NULL
            AND availability_status = 'AVAILABLE'
        `).bind(body.tanod_unit_id).first<{
          responder_resource_id: string;
          responder_user_id: string;
          display_name: string;
        }>()
      : await db.prepare(`
          SELECT responder_resource_id, responder_user_id, display_name
          FROM responder_resources
          WHERE resource_type = 'TANOD' AND responder_user_id IS NOT NULL
            AND availability_status = 'AVAILABLE'
          ORDER BY updated_at ASC
          LIMIT 1
        `).first<{
          responder_resource_id: string;
          responder_user_id: string;
          display_name: string;
        }>();

    if (resource) {
      tanodDispatched = true;
      const assignmentId = crypto.randomUUID();
      statements.push(
        db.prepare(`
          INSERT INTO tanod_assignments
            (tanod_assignment_id, incident_id, tanod_user_id, responder_resource_id, assignment_status_id, assigned_by_user_id, notes)
          VALUES (?, ?, ?, ?, 1, ?, 'BDRRMO Emergency Transport Dispatch')
        `).bind(
          assignmentId,
          incident.incident_id,
          resource.responder_user_id,
          resource.responder_resource_id,
          currentUser.id,
        ),
        db.prepare(`
          UPDATE responder_resources
          SET availability_status = 'BUSY', updated_at = datetime('now')
          WHERE responder_resource_id = ?
        `).bind(resource.responder_resource_id),
        notify(db, { type: "team_dispatched", actorId: currentUser.id, eventId: assignmentId,
          assignmentId, reportId: incidentId, recipientRole: "responder", recipientUserId: resource.responder_user_id,
          body: resource.display_name + " dispatched to " + incident.title }),
      );
    }
  }

  if (dispatchedDepts.length === 0 && !tanodDispatched) {
    return c.json({
      error: activeAgencyRoles.size > 0 || existingTanodRow
        ? "Selected department(s) are already dispatched to this incident."
        : "No available responder units to dispatch.",
    }, 409);
  }

  statements.push(
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 6, updated_at = datetime('now')
      WHERE incident_id = ? AND incident_status_id NOT IN (7, 8, 9, 10, 11, 12)
    `).bind(incident.incident_id),
  );

  if (body?.tactical_note?.trim()) {
    statements.push(
      db.prepare(`
        INSERT INTO incident_status_events
          (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
        VALUES (?, ?, ?, 6, ?, ?)
      `).bind(
        crypto.randomUUID(),
        incident.incident_id,
        incident.incident_status_id,
        currentUser.id,
        `[BDRRMO NOTE] ${body.tactical_note.trim()}`,
      ),
    );
  }

  await db.batch(statements);
  return c.json({
    ok: true,
    dispatched_departments: dispatchedDepts,
    tanod_dispatched: tanodDispatched,
  }, 201);
});

route.post("/incidents/:incidentId/reject", async (c) => {
  const db = c.env.geofix167_db;
  const incidentId = c.req.param("incidentId");
  const currentUser = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    reason?: string;
    false_report?: boolean;
  } | null;

  const isFalseReport = Boolean(body?.false_report);
  const reason =
    String(body?.reason || "").trim() ||
    (isFalseReport ? "Flagged as false report by BDRRMO" : "Rejected by BDRRMO");
  const note = isFalseReport ? `[FALSE REPORT] ${reason}` : `[REJECTED] ${reason}`;

  await db.batch([
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 11, closed_at = datetime('now'), closed_by_user_id = ?, updated_at = datetime('now')
      WHERE incident_id = ?
    `).bind(currentUser.id, incidentId),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      VALUES (?, ?, 5, 11, ?, ?)
    `).bind(crypto.randomUUID(), incidentId, currentUser.id, note),
    db.prepare(`
      UPDATE responder_dispatches
      SET status = 'CANCELLED'
      WHERE incident_id = ? AND status NOT IN ('COMPLETED', 'DECLINED', 'CANCELLED')
    `).bind(incidentId),
    db.prepare(`
      UPDATE tanod_assignments
      SET assignment_status_id = 7, completed_at = COALESCE(completed_at, datetime('now'))
      WHERE incident_id = ? AND assignment_status_id NOT IN (3, 6, 7)
    `).bind(incidentId),
    db.prepare(`
      UPDATE responder_resources
      SET availability_status = 'AVAILABLE', updated_at = datetime('now')
      WHERE responder_resource_id IN (
        SELECT responder_resource_id FROM tanod_assignments WHERE incident_id = ?
      )
    `).bind(incidentId),
    db.prepare(`
      UPDATE tracking_links
      SET expires_at = datetime('now'), revoked_at = COALESCE(revoked_at, datetime('now'))
      WHERE report_id = ?
    `).bind(incidentId),
    db.prepare(`
      DELETE FROM responder_locations
      WHERE assignment_id IN (
        SELECT tanod_assignment_id FROM tanod_assignments WHERE incident_id = ?
        UNION SELECT responder_dispatch_id FROM responder_dispatches WHERE incident_id = ?
      )
    `).bind(incidentId, incidentId),
  ]);

  try {
    const rep = await db.prepare(`SELECT reported_by_user_id FROM incident_reports WHERE incident_id = ?`)
      .bind(incidentId).first<{ reported_by_user_id: string | null }>();
    if (rep?.reported_by_user_id) {
      await db.prepare(`
        INSERT INTO resident_notifications
          (notification_id, recipient_user_id, incident_id, type, title, body, created_at)
        VALUES (?, ?, ?, 'report_update', ?, ?, ?)
      `).bind(
        crypto.randomUUID().replace(/-/g, ""),
        rep.reported_by_user_id,
        incidentId,
        isFalseReport ? "Report Flagged as False Report" : "Submitted Report Rejected",
        `Your submitted report was rejected by BDRRMO${reason ? `: "${reason}"` : "."} Open the report to modify and resubmit or discard it.`,
        new Date().toISOString(),
      ).run();
    }
  } catch { /* ignore notification error */ }

  return c.json({ ok: true, status: "REJECTED", false_report: isFalseReport });
});

route.post("/incidents/:incidentId/reject-completion", async (c) => {
  const db = c.env.geofix167_db;
  const incidentId = c.req.param("incidentId");
  const currentUser = c.get("user");
  const body = (await c.req.json().catch(() => null)) as {
    reason?: string;
    target_role?: "fire" | "police" | "tanod";
    photo_label?: string;
    photo_id?: string;
  } | null;
  const targetRole = body?.target_role;
  const photoId = body?.photo_id?.trim() || null;
  const photoPrefix = body?.photo_label ? `${body.photo_label} rejected: ` : "";
  const reason = `${photoPrefix}${body?.reason?.trim() || "Proof of completion photo did not meet BDRRMO verification requirements. Please refill and resubmit."}`;

  if (photoId) {
    const mediaRow = await db.prepare(`
      SELECT storage_key FROM incident_media
      WHERE incident_media_id = ? AND incident_id = ?
      LIMIT 1
    `).bind(photoId, incidentId).first<{ storage_key: string | null }>().catch(() => null);

    if (mediaRow?.storage_key && c.env.geofix167_uploads) {
      await c.env.geofix167_uploads.delete(mediaRow.storage_key).catch(() => {});
    }
  }

  const statements = [];
  if (photoId) {
    statements.push(
      db.prepare(`
        DELETE FROM incident_media
        WHERE incident_media_id = ? AND incident_id = ?
      `).bind(photoId, incidentId),
    );
  }
  if (!targetRole || targetRole === "fire" || targetRole === "police") {
    statements.push(
      targetRole
        ? db.prepare(`
            UPDATE responder_dispatches
            SET status = 'ON_SCENE'
            WHERE incident_id = ? AND lower(target_role) = ? AND status != 'DECLINED'
          `).bind(incidentId, targetRole)
        : db.prepare(`
            UPDATE responder_dispatches
            SET status = 'ON_SCENE'
            WHERE incident_id = ? AND status != 'DECLINED'
          `).bind(incidentId),
    );
  }
  if (!targetRole || targetRole === "tanod") {
    statements.push(
      db.prepare(`
        UPDATE tanod_assignments
        SET assignment_status_id = 5, completed_at = NULL
        WHERE incident_id = ? AND assignment_status_id != 3
      `).bind(incidentId),
    );
  }
  statements.push(
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 8, updated_at = datetime('now')
      WHERE incident_id = ? AND incident_status_id NOT IN (10, 11, 12)
    `).bind(incidentId),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      VALUES (?, ?, 9, 8, ?, ?)
    `).bind(crypto.randomUUID(), incidentId, currentUser.id, `[COMPLETION REJECTED] ${reason}`),
  );

  await db.batch(statements);

  return c.json({ ok: true, status: "ON_SCENE", target_role: targetRole || "all", reason });
});

route.post("/incidents/:incidentId/note", async (c) => {
  const incidentId = c.req.param("incidentId");
  const body = (await c.req.json().catch(() => null)) as { note?: string } | null;
  if (!incidentId || !body?.note?.trim()) {
    return c.json({ error: "A tactical note is required." }, 400);
  }

  await c.env.geofix167_db.prepare(`
    INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
    VALUES (?, ?, 6, 6, ?, ?)
  `).bind(
    crypto.randomUUID(),
    incidentId,
    c.get("user").id,
    `[BDRRMO NOTE] ${body.note.trim()}`,
  ).run();

  return c.json({ ok: true }, 201);
});

route.post("/incidents/:incidentId/close", async (c) => {
  const db = c.env.geofix167_db;
  const incidentId = c.req.param("incidentId");
  const currentUser = c.get("user");

  // Completion-gated closure: require ALL dispatched responders to have submitted completion reports
  const [unfinishedAgency, unfinishedTanod, totalAgency, totalTanod] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS cnt FROM responder_dispatches WHERE incident_id = ? AND status NOT IN ('COMPLETED', 'DECLINED')`).bind(incidentId).first<{ cnt: number }>(),
    db.prepare(`SELECT COUNT(*) AS cnt FROM tanod_assignments WHERE incident_id = ? AND assignment_status_id NOT IN (3, 6)`).bind(incidentId).first<{ cnt: number }>(),
    db.prepare(`SELECT COUNT(*) AS cnt FROM responder_dispatches WHERE incident_id = ? AND status != 'DECLINED'`).bind(incidentId).first<{ cnt: number }>(),
    db.prepare(`SELECT COUNT(*) AS cnt FROM tanod_assignments WHERE incident_id = ? AND assignment_status_id != 3`).bind(incidentId).first<{ cnt: number }>(),
  ]);

  const totalDispatched = Number(totalAgency?.cnt || 0) + Number(totalTanod?.cnt || 0);
  const remainingUnfinished = Number(unfinishedAgency?.cnt || 0) + Number(unfinishedTanod?.cnt || 0);

  if (totalDispatched === 0 || remainingUnfinished > 0) {
    return c.json({
      error: totalDispatched === 0
        ? "Cannot close yet — no responders have been dispatched."
        : `Cannot close yet — ${remainingUnfinished} dispatched responder(s) have not submitted their completion report.`,
    }, 409);
  }

  await db.batch([
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 10, closed_at = datetime('now'), closed_by_user_id = ?, updated_at = datetime('now')
      WHERE incident_id = ?
    `).bind(currentUser.id, incidentId),
    db.prepare(`
      UPDATE responder_dispatches
      SET status = 'COMPLETED'
      WHERE incident_id = ?
    `).bind(incidentId),
    db.prepare(`
      UPDATE tanod_assignments
      SET assignment_status_id = 6, completed_at = COALESCE(completed_at, datetime('now'))
      WHERE incident_id = ?
    `).bind(incidentId),
    db.prepare(`
      UPDATE responder_resources
      SET availability_status = 'AVAILABLE', updated_at = datetime('now')
      WHERE responder_resource_id IN (
        SELECT responder_resource_id FROM tanod_assignments WHERE incident_id = ?
      )
    `).bind(incidentId),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      VALUES (?, ?, 9, 10, ?, 'BDRRMO verified completion and authorized closure')
    `).bind(crypto.randomUUID(), incidentId, currentUser.id),
    db.prepare(`
      UPDATE tracking_links
      SET expires_at = datetime('now'), revoked_at = COALESCE(revoked_at, datetime('now'))
      WHERE report_id = ?
    `).bind(incidentId),
    db.prepare(`
      DELETE FROM responder_locations
      WHERE assignment_id IN (
        SELECT tanod_assignment_id FROM tanod_assignments WHERE incident_id = ?
        UNION SELECT responder_dispatch_id FROM responder_dispatches WHERE incident_id = ?
      )
    `).bind(incidentId, incidentId),
  ]);

  try {
    const rep = await db.prepare(`SELECT reported_by_user_id, title FROM incident_reports WHERE incident_id = ?`)
      .bind(incidentId).first<{ reported_by_user_id: string | null; title: string | null }>();
    if (rep?.reported_by_user_id) {
      await db.prepare(`
        INSERT INTO resident_notifications
          (notification_id, recipient_user_id, incident_id, type, title, body, created_at)
        VALUES (?, ?, ?, 'report_update', ?, ?, ?)
      `).bind(
        crypto.randomUUID().replace(/-/g, ""),
        rep.reported_by_user_id,
        incidentId,
        "Emergency Incident Resolved",
        `Your emergency report${rep.title ? ` ("${rep.title}")` : ""} has been verified and closed by BDRRMO.`,
        new Date().toISOString(),
      ).run();
    }
  } catch { /* ignore notification error */ }

  // Generate summarized completion report snapshot so Admin receives only the summary once closed
  await ensureIncidentReportSnapshot(db, incidentId, currentUser.id, "BDRRMO verified completion and authorized closure").catch(() => null);

  return c.json({ ok: true, status: "CLOSED" });
});

route.get("/completed-tasks", async (c) => {
  const db = c.env.geofix167_db;
  const toIso = (val: unknown) => {
    const text = String(val || "").trim();
    if (!text) return null;
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text.replace(" ", "T") + "Z" : text;
  };

  const [reports, dispatches, tanods, events, mediaRows] = await Promise.all([
    db.prepare(`
      SELECT r.incident_id, COALESCE(printf('GF-%03d', rr.reference_sequence), r.incident_id) AS reference_number,
        r.title, r.category, r.categories, r.location_description, r.assigned_team,
        r.submitted_at, r.closed_at, r.updated_at
      FROM incident_reports r
      LEFT JOIN incident_report_references rr ON rr.incident_id = r.incident_id
      WHERE r.is_emergency = 1 AND (r.incident_status_id = 10 OR r.closed_at IS NOT NULL)
      ORDER BY COALESCE(r.closed_at, r.updated_at) DESC
      LIMIT 200
    `).all<Record<string, unknown>>(),
    db.prepare(`
      SELECT incident_id, target_role, dispatched_at
      FROM responder_dispatches
      WHERE status != 'DECLINED'
      ORDER BY dispatched_at ASC
    `).all<{ incident_id: string; target_role: string; dispatched_at: string }>(),
    db.prepare(`
      SELECT incident_id, assigned_at
      FROM tanod_assignments
      WHERE assignment_status_id != 3
      ORDER BY assigned_at ASC
    `).all<{ incident_id: string; assigned_at: string }>(),
    db.prepare(`
      SELECT incident_id, to_incident_status_id, note, created_at
      FROM incident_status_events
      ORDER BY created_at ASC
    `).all<{ incident_id: string; to_incident_status_id: number; note: string | null; created_at: string }>(),
    db.prepare(`
      SELECT incident_id, incident_media_id AS id, COALESCE(original_filename, 'photo.jpg') AS filename
      FROM incident_media
      WHERE media_type = 'PHOTO'
      ORDER BY created_at ASC
    `).all<{ incident_id: string; id: string; filename: string }>().catch(() => ({ results: [] })),
  ]);

  const photosByInc = new Map<string, Array<{ id: string; url: string; label: string }>>();
  for (const m of mediaRows.results ?? []) {
    const list = photosByInc.get(m.incident_id) ?? [];
    const label = /^fire-/i.test(m.filename)
      ? "BFP Completion Proof"
      : /^police-/i.test(m.filename)
        ? "Police Completion Proof"
        : /^transport-proof/i.test(m.filename)
          ? "Tanod Transport Proof"
          : /^tanod-/i.test(m.filename)
            ? "Tanod Completion Proof"
            : "Incident Scene Photo";
    list.push({
      id: m.id,
      url: `/api/reports/${encodeURIComponent(m.incident_id)}/photos/${encodeURIComponent(m.id)}`,
      label,
    });
    photosByInc.set(m.incident_id, list);
  }

  const teamsByInc = new Map<string, Set<string>>();
  const dispatchedAtByInc = new Map<string, string>();
  for (const d of dispatches.results ?? []) {
    const set = teamsByInc.get(d.incident_id) ?? new Set<string>();
    set.add(d.target_role === "fire" ? "BFP (Fire)" : d.target_role === "police" ? "Police (PNP)" : d.target_role.toUpperCase());
    teamsByInc.set(d.incident_id, set);
    if (!dispatchedAtByInc.has(d.incident_id) && d.dispatched_at) dispatchedAtByInc.set(d.incident_id, d.dispatched_at);
  }
  for (const t of tanods.results ?? []) {
    const set = teamsByInc.get(t.incident_id) ?? new Set<string>();
    set.add("Barangay Tanod");
    teamsByInc.set(t.incident_id, set);
    if (!dispatchedAtByInc.has(t.incident_id) && t.assigned_at) dispatchedAtByInc.set(t.incident_id, t.assigned_at);
  }

  const arrivedAtByInc = new Map<string, string>();
  const outcomeByInc = new Map<string, string>();
  for (const ev of events.results ?? []) {
    if (Number(ev.to_incident_status_id) === 8 && !arrivedAtByInc.has(ev.incident_id)) {
      arrivedAtByInc.set(ev.incident_id, ev.created_at);
    }
    const note = String(ev.note || "").trim();
    if (note.startsWith("[AGENCY REPORT]")) {
      outcomeByInc.set(ev.incident_id, stripSelectedDetails(note.replace(/^\[AGENCY REPORT\]\s*/, "")));
    } else if (Number(ev.to_incident_status_id) === 10 && note && !outcomeByInc.has(ev.incident_id)) {
      outcomeByInc.set(ev.incident_id, note);
    }
  }

  const tasks = (reports.results ?? []).map((row) => {
    const incId = String(row.incident_id);
    let categories: string[] = [];
    if (typeof row.categories === "string" && row.categories.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(row.categories);
        if (Array.isArray(parsed)) categories = parsed.map(String).filter(Boolean);
      } catch { /* fallback below */ }
    }
    if (!categories.length) {
      categories = [String(row.category || row.title || "Emergency")];
    }

    const reported = toIso(row.submitted_at) || new Date().toISOString();
    const resolved = toIso(row.closed_at || row.updated_at) || reported;
    const dispatched = toIso(dispatchedAtByInc.get(incId)) || reported;
    const arrived = toIso(arrivedAtByInc.get(incId)) || resolved;
    const startMs = Date.parse(reported);
    const arriveMs = Date.parse(arrived);
    const responseMinutes = Number.isFinite(startMs) && Number.isFinite(arriveMs)
      ? Math.max(0, Math.round((arriveMs - startMs) / 60000))
      : 0;
    const teamList = teamsByInc.get(incId);

    return {
      id: String(row.reference_number || incId),
      incidentId: incId,
      categories,
      location: String(row.location_description || "Barangay 167"),
      team: teamList && teamList.size > 0 ? [...teamList].join(", ") : String(row.assigned_team || "BDRRMO Response"),
      reported,
      dispatched,
      arrived,
      resolved,
      responseMinutes,
      outcome: outcomeByInc.get(incId) || "Verified and closed by BDRRMO.",
      photos: photosByInc.get(incId) ?? [],
    };
  });

  return c.json({ tasks });
});

export default route;
