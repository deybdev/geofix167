import { notify } from "../services/notifications";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AppEnv } from "../types/env";
import { resolveLegacyReportAddresses } from "../services/report.service";
import { stripSelectedDetails } from "../utils/stripSelectedDetails";

type MaintenanceNotesMeta = {
  type: "MAINTENANCE";
  task_code?: string;
  urgency: string;
  deadline: number;
  admin_notes: string;
  inspection_done: boolean;
  inspection_at?: string | null;
  inspection_note: string;
  inspection_photo_ids: string[];
  for_funding?: boolean;
  for_funding_at?: string | null;
  for_funding_note?: string;
  admin_check_approved?: boolean;
  repair_done: boolean;
  repair_at?: string | null;
  repair_note: string;
  repair_photo_ids: string[];
};

export function parseMaintenanceMeta(raw: string | null | undefined): MaintenanceNotesMeta | null {
  if (!raw || !raw.trim().startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === "MAINTENANCE") {
      return {
        type: "MAINTENANCE",
        task_code: parsed.task_code,
        urgency: parsed.urgency || "Standard",
        deadline: Number(parsed.deadline) || Date.now() + 3 * 86400000,
        admin_notes: String(parsed.admin_notes || ""),
        inspection_done: Boolean(parsed.inspection_done),
        inspection_at: parsed.inspection_at || null,
        inspection_note: String(parsed.inspection_note || ""),
        inspection_photo_ids: Array.isArray(parsed.inspection_photo_ids) ? parsed.inspection_photo_ids : [],
        for_funding: Boolean(parsed.for_funding),
        for_funding_at: parsed.for_funding_at || null,
        for_funding_note: String(parsed.for_funding_note || ""),
        admin_check_approved: Boolean(parsed.admin_check_approved),
        repair_done: Boolean(parsed.repair_done),
        repair_at: parsed.repair_at || null,
        repair_note: String(parsed.repair_note || ""),
        repair_photo_ids: Array.isArray(parsed.repair_photo_ids) ? parsed.repair_photo_ids : [],
      };
    }
  } catch {
    // Ignore malformed JSON
  }
  return null;
}

const route = new Hono<AppEnv>();
route.use("*", requireAuth, requireRole("admin"));

async function notifyResidentOfMaintenanceMove(
  db: AppEnv["Bindings"]["geofix167_db"],
  incidentId: string,
  title: string,
  body: string,
) {
  try {
    const row = await db.prepare(`
      SELECT reported_by_user_id FROM incident_reports WHERE incident_id = ?
    `).bind(incidentId).first<{ reported_by_user_id: string | null }>();
    if (!row?.reported_by_user_id) return;
    const notifId = crypto.randomUUID().replace(/-/g, "");
    const nowIso = new Date().toISOString();
    await db.prepare(`
      INSERT INTO resident_notifications
        (notification_id, recipient_user_id, incident_id, type, title, body, created_at)
      VALUES (?, ?, ?, 'report_update', ?, ?, ?)
    `).bind(notifId, row.reported_by_user_id, incidentId, title, body, nowIso).run();
  } catch {
    // Non-fatal if resident_notifications insert fails
  }
}

route.get("/intake", async (c) => {
  const db = c.env.geofix167_db;
  try {
    await resolveLegacyReportAddresses(db);
    const result = await db.prepare(`
      SELECT r.incident_id, COALESCE(printf('GF-%03d', rr.reference_sequence), r.incident_id) AS report_id,
        r.title, r.category, r.categories, r.description_original AS description,
        r.latitude, r.longitude, r.accuracy_meters,
        r.within_barangay_boundary, r.pin_manually_adjusted, r.submitted_at,
        CASE
          WHEN r.location_description = printf('%.5f, %.5f', r.latitude, r.longitude)
            THEN CASE WHEN r.within_barangay_boundary = 0 THEN 'Pinned outside Barangay 167'
              WHEN r.within_barangay_boundary = 1 THEN 'Pinned location, Barangay 167'
              ELSE 'Pinned on map' END
          ELSE r.location_description
        END AS location,
        CASE
          WHEN r.guest_session_id IS NOT NULL THEN 'guest'
          ELSE 'resident'
        END AS reporter_type,
        COALESCE(
          NULLIF(trim(u.first_name || ' ' || u.last_name), ''),
          NULLIF(trim(gs.display_name), ''),
          CASE WHEN r.guest_session_id IS NOT NULL THEN 'Guest' ELSE 'Resident' END
        ) AS reporter_name
      FROM incident_reports r
      LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
      LEFT JOIN users u ON u.user_id = r.reported_by_user_id
      LEFT JOIN incident_report_references rr ON rr.incident_id = r.incident_id
      WHERE r.is_emergency = 0
        AND r.incident_status_id IN (1, 2, 4)
        AND NOT EXISTS (
          SELECT 1 FROM tanod_assignments ta WHERE ta.incident_id = r.incident_id
        )
      ORDER BY r.submitted_at DESC
    `).all<Record<string, unknown> & { incident_id: string }>();

    const reports = result.results ?? [];
    const photoRows = reports.length
      ? await db.prepare(`
          SELECT incident_id, incident_media_id AS id, content_type, created_at
          FROM incident_media
          WHERE media_type = 'PHOTO'
          ORDER BY created_at, incident_media_id
        `).all<{ incident_id: string; id: string; content_type: string; created_at: string }>()
      : { results: [] };

    const photosByIncident = new Map<string, { id: string; content_type: string; created_at: string }[]>();
    for (const row of photoRows.results ?? []) {
      const list = photosByIncident.get(row.incident_id) ?? [];
      list.push(row);
      photosByIncident.set(row.incident_id, list);
    }

    return c.json({
      reports: reports.map((r) => ({
        ...r,
        photos: photosByIncident.get(r.incident_id) ?? [],
      })),
    });
  } catch (error) {
    console.error("Unable to load maintenance intake:", error);
    return c.json({ error: "Maintenance intake could not be loaded." }, 500);
  }
});

route.post("/ingest", async (c) => {
  const db = c.env.geofix167_db;
  const body = (await c.req.json().catch(() => null)) as {
    incident_id?: string;
    unit_id?: string;
    tanod_name?: string;
    task_code?: string;
    urgency?: string;
    deadline?: number;
    admin_notes?: string;
  } | null;

  if (!body?.incident_id) {
    return c.json({ error: "incident_id is required." }, 400);
  }

  const report = await db.prepare("SELECT is_emergency, incident_status_id FROM incident_reports WHERE incident_id = ?")
    .bind(body.incident_id).first<{ is_emergency: number; incident_status_id: number }>();
  if (!report) return c.json({ error: "Report not found." }, 404);
  if (report.is_emergency) return c.json({ error: "Sudden incidents cannot be assigned as Tanod maintenance tasks." }, 409);
  if ([10, 11, 12].includes(Number(report.incident_status_id))) {
    return c.json({ error: "Closed or rejected reports cannot be assigned." }, 409);
  }

  const existingAssignment = await db.prepare(`
    SELECT tanod_assignment_id FROM tanod_assignments
    WHERE incident_id = ? AND assignment_status_id NOT IN (3, 6, 7)
    LIMIT 1
  `).bind(body.incident_id).first<{ tanod_assignment_id: string }>();
  if (existingAssignment) {
    return c.json({ error: "This maintenance report is already assigned to a Tanod." }, 409);
  }

  let resource = body.unit_id
    ? await db.prepare(`
        SELECT responder_resource_id, responder_user_id, display_name
        FROM responder_resources
        WHERE responder_resource_id = ?
      `).bind(body.unit_id).first<{ responder_resource_id: string; responder_user_id: string | null; display_name: string }>()
    : null;

  if (!resource) {
    resource = await db.prepare(`
      SELECT responder_resource_id, responder_user_id, display_name
      FROM responder_resources
      WHERE resource_type = 'TANOD' AND responder_user_id IS NOT NULL
      ORDER BY CASE WHEN availability_status = 'AVAILABLE' THEN 0 ELSE 1 END, display_name
      LIMIT 1
    `).first<{ responder_resource_id: string; responder_user_id: string | null; display_name: string }>();
  }

  let tanodUserId = resource?.responder_user_id ?? null;
  if (!tanodUserId) {
    const fallbackUser = await db.prepare(`
      SELECT u.user_id
      FROM users u
      JOIN roles ro ON ro.role_id = u.role_id
      WHERE lower(ro.code) = 'tanod'
      LIMIT 1
    `).first<{ user_id: string }>();
    tanodUserId = fallbackUser?.user_id ?? null;
  }
  if (!tanodUserId) {
    return c.json({ error: "No Tanod account is available for maintenance assignment." }, 409);
  }

  const assignmentId = crypto.randomUUID();
  const meta: MaintenanceNotesMeta = {
    type: "MAINTENANCE",
    task_code: body.task_code || undefined,
    urgency: body.urgency || "Standard",
    deadline: Number(body.deadline) || Date.now() + 3 * 86400000,
    admin_notes: String(body.admin_notes || `Dispatched by Admin (${body.urgency || "Standard"})`),
    inspection_done: false,
    inspection_note: "",
    inspection_photo_ids: [],
    admin_check_approved: false,
    repair_done: false,
    repair_note: "",
    repair_photo_ids: [],
  };

  await db.batch([
    db.prepare(`
      INSERT INTO tanod_assignments
        (tanod_assignment_id, incident_id, tanod_user_id, responder_resource_id, assignment_status_id, assigned_by_user_id, notes)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).bind(
      assignmentId,
      body.incident_id,
      tanodUserId,
      resource?.responder_resource_id ?? null,
      c.get("user").id,
      JSON.stringify(meta),
    ),
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 6,
          assigned_team = ?,
          priority_code = ?,
          updated_at = datetime('now')
      WHERE incident_id = ?
    `).bind(
      body.tanod_name || resource?.display_name || "Assigned Tanod",
      body.urgency === "Urgent" ? "P2" : "P3",
      body.incident_id,
    ),
    notify(db, { type: "team_dispatched", actorId: c.get("user").id, eventId: assignmentId,
      reportId: body.incident_id, assignmentId, linkPath: "/admin/maintenance-tasks" }),
  ]);

  if (resource?.responder_resource_id) {
    await db.prepare(`
      UPDATE responder_resources
      SET availability_status = 'BUSY', updated_at = datetime('now')
      WHERE responder_resource_id = ?
    `).bind(resource.responder_resource_id).run().catch(() => {});
  }

  const assignedName = body.tanod_name || resource?.display_name || "Assigned Tanod";
  await notifyResidentOfMaintenanceMove(
    db,
    body.incident_id,
    "Maintenance Task Assigned",
    `Your maintenance report has been assigned to ${assignedName} for on-site inspection.`,
  );

  return c.json({
    ok: true,
    assignment_id: assignmentId,
    tanod_name: assignedName,
  }, 201);
});

route.get("/tasks", async (c) => {
  const db = c.env.geofix167_db;
  const rows = await db.prepare(`
    SELECT ta.tanod_assignment_id, ta.incident_id, ta.assignment_status_id,
      ta.assigned_at, ta.accepted_at, ta.completed_at, ta.notes,
      r.title, r.category, r.categories, r.description_sanitized, r.description_original,
      r.latitude, r.longitude, r.location_description, r.accuracy_meters,
      r.submitted_at, r.incident_status_id, r.assigned_team,
      COALESCE(printf('GF-%03d', rr_ref.reference_sequence), r.incident_id) AS report_id,
      rr.display_name AS resource_name,
      CASE WHEN r.guest_session_id IS NOT NULL THEN 'guest' ELSE 'resident' END AS reporter_type,
      COALESCE(
        NULLIF(trim(u.first_name || ' ' || u.last_name), ''),
        NULLIF(trim(gs.display_name), ''),
        'Reporter'
      ) AS reporter_name
    FROM tanod_assignments ta
    JOIN incident_reports r ON r.incident_id = ta.incident_id
    LEFT JOIN incident_report_references rr_ref ON rr_ref.incident_id = r.incident_id
    LEFT JOIN responder_resources rr ON rr.responder_resource_id = ta.responder_resource_id
    LEFT JOIN users u ON u.user_id = r.reported_by_user_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    WHERE r.is_emergency = 0
    ORDER BY ta.assigned_at DESC
    LIMIT 100
  `).all<Record<string, unknown>>();

  const photoRows = await db.prepare(`
    SELECT incident_id, incident_media_id AS id
    FROM incident_media
    WHERE media_type = 'PHOTO'
    ORDER BY created_at, incident_media_id
  `).all<{ incident_id: string; id: string }>().catch(() => ({ results: [] }));

  const photosByIncident = new Map<string, string[]>();
  for (const p of photoRows.results ?? []) {
    const list = photosByIncident.get(p.incident_id) ?? [];
    list.push(p.id);
    photosByIncident.set(p.incident_id, list);
  }

  const tasks = (rows.results ?? []).map((row) => {
    const meta = parseMaintenanceMeta(String(row.notes || "")) || {
      type: "MAINTENANCE" as const,
      urgency: "Standard",
      deadline: Date.now() + 3 * 86400000,
      admin_notes: "",
      inspection_done: false,
      inspection_note: "",
      inspection_photo_ids: [],
      admin_check_approved: false,
      repair_done: false,
      repair_note: "",
      repair_photo_ids: [],
    };
    const isResolved = Number(row.incident_status_id) === 10 || Number(row.assignment_status_id) === 6;
    const status = isResolved
      ? "Verified Fixed"
      : meta.admin_check_approved
        ? "Awaiting Verification"
        : meta.for_funding
          ? "For Funding"
          : "In Progress";

    const allPhotoIds = photosByIncident.get(String(row.incident_id)) ?? [];
    const reporterPhotoIds = allPhotoIds.filter(
      (pid) => !meta.inspection_photo_ids.includes(pid) && !meta.repair_photo_ids.includes(pid),
    );

    return {
      assignment_id: String(row.tanod_assignment_id),
      incident_id: String(row.incident_id),
      id: (meta.task_code || `TASK-${String(row.report_id).replace(/^GF-/, "167-")}`).replace(
        /^TASK-167-(?:167)+/i,
        "TASK-167-",
      ),
      originReportId: String(row.report_id),
      issue: String(row.title || "Maintenance Task"),
      category: String(row.category || "Maintenance"),
      categories: row.categories,
      location: String(row.location_description || "Barangay 167"),
      lat: row.latitude == null ? null : Number(row.latitude),
      lng: row.longitude == null ? null : Number(row.longitude),
      reporter: {
        name: String(row.reporter_name || "Reporter"),
        type: String(row.reporter_type || "guest"),
      },
      narration: stripSelectedDetails(row.description_sanitized || row.description_original || ""),
      team: String(row.assigned_team || row.resource_name || "Assigned Tanod"),
      priority: meta.urgency,
      deadline: meta.deadline,
      status,
      for_funding: Boolean(meta.for_funding),
      for_funding_at: meta.for_funding_at || null,
      for_funding_note: meta.for_funding_note || "",
      admin_notes: meta.admin_notes,
      reporter_photo_ids: reporterPhotoIds,
      inspection_done: meta.inspection_done,
      inspection_at: meta.inspection_at || null,
      inspection_note: meta.inspection_note,
      inspection_photo_ids: meta.inspection_photo_ids,
      admin_check_approved: Boolean(meta.admin_check_approved),
      repair_done: meta.repair_done,
      repair_at: meta.repair_at || null,
      repair_note: meta.repair_note,
      repair_photo_ids: meta.repair_photo_ids,
      fast_track_pending: Boolean(meta.repair_done && !meta.admin_check_approved && !isResolved),
      submitted_at: String(row.submitted_at || row.assigned_at || ""),
    };
  });

  return c.json({ tasks });
});

route.patch("/tasks/:assignmentId", async (c) => {
  const db = c.env.geofix167_db;
  const assignmentId = c.req.param("assignmentId");
  const body = (await c.req.json().catch(() => null)) as {
    admin_notes?: string;
    admin_check_approved?: boolean;
    for_funding?: boolean;
    for_funding_note?: string;
    verified_fixed?: boolean;
    inspection_photo_ids?: string[];
    repair_photo_ids?: string[];
  } | null;

  const existing = await db.prepare(`
    SELECT tanod_assignment_id, incident_id, responder_resource_id, notes
    FROM tanod_assignments
    WHERE tanod_assignment_id = ? AND EXISTS (SELECT 1 FROM incident_reports r WHERE r.incident_id = tanod_assignments.incident_id AND r.is_emergency = 0)
  `).bind(assignmentId).first<{
    tanod_assignment_id: string;
    incident_id: string;
    responder_resource_id: string | null;
    notes: string | null;
  }>();

  if (!existing) return c.json({ error: "Maintenance task not found." }, 404);

  const meta = parseMaintenanceMeta(existing.notes) || {
    type: "MAINTENANCE" as const,
    urgency: "Standard",
    deadline: Date.now() + 3 * 86400000,
    admin_notes: "",
    inspection_done: false,
    inspection_note: "",
    inspection_photo_ids: [],
    admin_check_approved: false,
    repair_done: false,
    repair_note: "",
    repair_photo_ids: [],
  };

  const newlyAwaiting = !meta.admin_check_approved && body?.admin_check_approved === true && !body?.verified_fixed;
  if (typeof body?.admin_notes === "string") meta.admin_notes = body.admin_notes;
  if (typeof body?.for_funding === "boolean") {
    meta.for_funding = body.for_funding;
    meta.for_funding_at = body.for_funding ? new Date().toISOString() : null;
    if (typeof body.for_funding_note === "string") {
      meta.for_funding_note = body.for_funding_note.trim();
    }
  }
  if (typeof body?.admin_check_approved === "boolean") {
    meta.admin_check_approved = body.admin_check_approved;
    if (body.admin_check_approved) {
      meta.inspection_done = true;
      meta.for_funding = false;
    }
  }
  if (body?.verified_fixed) {
    meta.for_funding = false;
  }
  if (Array.isArray(body?.inspection_photo_ids)) meta.inspection_photo_ids = body.inspection_photo_ids;
  if (Array.isArray(body?.repair_photo_ids)) meta.repair_photo_ids = body.repair_photo_ids;

  await db.batch([db.prepare(`
    UPDATE tanod_assignments
    SET notes = ?,
        assignment_status_id = CASE WHEN ? = 1 THEN 6 ELSE assignment_status_id END,
        completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, datetime('now')) ELSE completed_at END
    WHERE tanod_assignment_id = ?
  `).bind(
    JSON.stringify(meta),
    body?.verified_fixed ? 1 : 0,
    body?.verified_fixed ? 1 : 0,
    assignmentId,
  ), ...(newlyAwaiting ? [notify(db, { type: "maintenance_verification", actorId: c.get("user").id,
    eventId: assignmentId, assignmentId, reportId: existing.incident_id, afterChange: true })] : [])]);

  if (body?.verified_fixed) {
    await db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 10, closed_at = datetime('now'), closed_by_user_id = ?, updated_at = datetime('now')
      WHERE incident_id = ?
    `).bind(c.get("user").id, existing.incident_id).run();

    if (existing.responder_resource_id) {
      await db.prepare(`
        UPDATE responder_resources
        SET availability_status = 'AVAILABLE', updated_at = datetime('now')
        WHERE responder_resource_id = ?
      `).bind(existing.responder_resource_id).run().catch(() => {});
    }

    await notifyResidentOfMaintenanceMove(
      db,
      existing.incident_id,
      "Maintenance Report Verified Fixed",
      "Your maintenance report has been repaired and verified fixed by Admin. Thank you for reporting!",
    );
  } else if (body?.for_funding === true) {
    await notifyResidentOfMaintenanceMove(
      db,
      existing.incident_id,
      "Maintenance Report Marked For Funding",
      `Admin reviewed the Tanod's inspection photo and set your maintenance report status to For Funding while materials/budget are being arranged${meta.for_funding_note ? `: "${meta.for_funding_note}"` : "."}`,
    );
  } else if (body?.admin_check_approved) {
    await notifyResidentOfMaintenanceMove(
      db,
      existing.incident_id,
      "On-Site Inspection Verified",
      "Admin verified the Tanod's on-site inspection photos. Repair work is now in progress.",
    );
  }

  return c.json({ ok: true, meta });
});

route.get("/false-reports", async (c) => {
  const db = c.env.geofix167_db;
  const rows = await db.prepare(`
    SELECT r.incident_id,
      COALESCE(printf('GF-%03d', ref.reference_sequence), r.incident_id) AS reference_number,
      r.title, r.category, r.is_emergency, r.location_description,
      r.description_sanitized, r.description_original,
      r.submitted_at, r.closed_at, r.reported_by_user_id,
      u.account_status_id AS reporter_account_status_id,
      COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), gs.display_name, 'Guest') AS reporter_name,
      COALESCE(NULLIF(trim(u.mobile_number), ''), NULLIF(trim(r.callback_mobile_number), ''), gs.contact_mobile_number, '') AS reporter_phone,
      COALESCE(u.email, '') AS reporter_email,
      CASE WHEN r.guest_session_id IS NOT NULL THEN 'guest' ELSE 'resident' END AS reporter_type,
      (
        SELECT e.note FROM incident_status_events e
        WHERE e.incident_id = r.incident_id AND e.to_incident_status_id = 11
        ORDER BY e.created_at DESC LIMIT 1
      ) AS rejection_note,
      (
        SELECT trim(cu.first_name || ' ' || cu.last_name) FROM users cu
        WHERE cu.user_id = r.closed_by_user_id
      ) AS rejected_by_name
    FROM incident_reports r
    LEFT JOIN incident_report_references ref ON ref.incident_id = r.incident_id
    LEFT JOIN users u ON u.user_id = r.reported_by_user_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    WHERE r.incident_status_id = 11
    ORDER BY COALESCE(r.closed_at, r.updated_at, r.submitted_at) DESC
    LIMIT 200
  `).all<Record<string, unknown>>();

  const reports = (rows.results ?? []).map((row) => {
    const rawNote = String(row.rejection_note || "").trim();
    const isFalseFlag = /^\[FALSE REPORT\]/i.test(rawNote);
    const reason = rawNote.replace(/^\[(FALSE REPORT|REJECTED)\]\s*/i, "").trim() || "Rejected during review.";
    return {
      incident_id: String(row.incident_id),
      reference_number: String(row.reference_number || row.incident_id),
      title: String(row.title || row.category || "Report"),
      category: String(row.category || "General"),
      report_type: Number(row.is_emergency) === 1 ? "Emergency" : "Maintenance",
      location: String(row.location_description || "Barangay 167"),
      description: stripSelectedDetails(row.description_sanitized || row.description_original || ""),
      submitted_at: String(row.submitted_at || ""),
      rejected_at: String(row.closed_at || row.submitted_at || ""),
      is_false_report: isFalseFlag,
      reason,
      rejected_by: String(row.rejected_by_name || "Staff"),
      reporter: {
        user_id: row.reported_by_user_id ? String(row.reported_by_user_id) : null,
        name: String(row.reporter_name || "Guest"),
        phone: String(row.reporter_phone || ""),
        email: String(row.reporter_email || ""),
        type: String(row.reporter_type || "guest"),
        account_status_id: row.reporter_account_status_id == null ? null : Number(row.reporter_account_status_id),
      },
    };
  });

  return c.json({ reports });
});

export default route;
