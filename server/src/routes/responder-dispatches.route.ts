import { notify } from "../services/notifications";
import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, requireRole } from "../middleware/auth";
import type { AppEnv, UserRole } from "../types/env";
import { parseMaintenanceMeta } from "./admin-maintenance.route";
import { ensureIncidentReportSnapshot } from "../services/incidentReportSnapshot.service";
import { stripSelectedDetails } from "../utils/stripSelectedDetails";

const route = new Hono<AppEnv>();
const responderRoles: UserRole[] = ["bdrrmo", "police", "fire", "tanod"];
const roleSchema = z.enum(["bdrrmo", "police", "fire", "tanod"]);
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
const statusSchema = z.enum(["ACCEPTED", "DECLINED", "EN_ROUTE", "ON_SCENE", "COMPLETED"]);

async function recordTrackingStatus(db: AppEnv["Bindings"]["geofix167_db"], assignmentId: string, userId: string,
  status: "ACCEPTED" | "DECLINED" | "EN_ROUTE" | "ON_SCENE" | "COMPLETED") {
  const assignment = await db.prepare('SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ? UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?')
    .bind(assignmentId, assignmentId).first<{ incident_id: string }>();
  const notice = assignment && status !== "COMPLETED" ? notify(db, { type: status, actorId: userId,
    eventId: assignmentId, assignmentId, reportId: assignment.incident_id }) : null;
  if (status === "DECLINED") {
    await db.batch([db.prepare("DELETE FROM responder_locations WHERE assignment_id = ? AND responder_id = ?")
      .bind(assignmentId, userId), ...(notice ? [notice] : [])]);
    return;
  }
  const incidentStatusId = { ACCEPTED: 6, EN_ROUTE: 7, ON_SCENE: 8, COMPLETED: 10 }[status];
  await db.batch([
    db.prepare(`INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, r.incident_id, r.incident_status_id, ?, ?, ?
      FROM incident_reports r
      WHERE r.incident_id = (SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
        UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?)
        AND r.incident_status_id IN (5, 6, 7, 8, 13)`)
      .bind(crypto.randomUUID(), incidentStatusId, userId, "Responder " + status.toLowerCase().replaceAll("_", " "), assignmentId, assignmentId),
    db.prepare(`UPDATE incident_reports SET incident_status_id = ?, updated_at = datetime('now'),
      closed_at = CASE WHEN ? = 10 THEN datetime('now') ELSE closed_at END,
      closed_by_user_id = CASE WHEN ? = 10 THEN ? ELSE closed_by_user_id END
      WHERE incident_id = (SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
        UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?)
        AND incident_status_id IN (5, 6, 7, 8, 13) AND changes() = 1`)
      .bind(incidentStatusId, incidentStatusId, incidentStatusId, userId, assignmentId, assignmentId),
    ...(notice ? [notice] : []),
  ]);
  if (status === "COMPLETED") {
    const incident = await db.prepare(`SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
      UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ? LIMIT 1`)
      .bind(assignmentId, assignmentId).first<{ incident_id: string }>();
    if (incident) await ensureIncidentReportSnapshot(db, incident.incident_id, userId, "Responder marked incident completed.");
    await db.batch([
      db.prepare(`UPDATE tracking_links SET expires_at = datetime('now'), revoked_at = COALESCE(revoked_at, datetime('now'))
        WHERE report_id = (SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
          UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?)`)
        .bind(assignmentId, assignmentId),
      db.prepare(`DELETE FROM responder_locations WHERE assignment_id IN (
        SELECT tanod_assignment_id FROM tanod_assignments WHERE incident_id = (SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
          UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?)
        UNION SELECT responder_dispatch_id FROM responder_dispatches WHERE incident_id = (SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
          UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?)
      )`).bind(assignmentId, assignmentId, assignmentId, assignmentId),
    ]);
  }
}

route.use("*", requireAuth, requireRole(...responderRoles));

const FALLBACK_HOSPITALS = [
  {
    id: "hosp-bhs167",
    name: "Barangay 167 Health Station & Emergency Clinic",
    address: "Magsaysay Blvd, Barangay 167, Caloocan City",
    latitude: 14.7269,
    longitude: 121.0174,
  },
  {
    id: "hosp-cgh",
    name: "Caloocan General Hospital",
    address: "Rizal St Ext., Barangay 167, Caloocan City",
    latitude: 14.7271,
    longitude: 121.0232,
  },
  {
    id: "hosp-rmc",
    name: "Rizal Medical Center (Barangay 167 Wing)",
    address: "Magsaysay Blvd, Barangay 167, Caloocan City",
    latitude: 14.7284,
    longitude: 121.0106,
  },
];

route.get("/hospitals", async (c) => {
  const lat = Number(c.req.query("lat"));
  const lng = Number(c.req.query("lng"));
  const result = await c.env.geofix167_db.prepare(`
    SELECT hospital_id AS id, name, address, latitude, longitude
    FROM hospitals_directory
    WHERE is_active = 1
    LIMIT 50
  `).all<Record<string, unknown>>().catch(() => ({ results: [] }));

  const rawList = (result.results && result.results.length > 0)
    ? result.results
    : FALLBACK_HOSPITALS;

  const hospitals = rawList.map((h) => {
    const hLat = Number(h.latitude);
    const hLng = Number(h.longitude);
    const distanceKm = Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(hLat) && Number.isFinite(hLng)
      ? Math.hypot(hLat - lat, hLng - lng) * 111
      : null;
    return { ...h, distance_km: distanceKm == null ? null : Number(distanceKm.toFixed(2)) };
  });

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    hospitals.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
  }

  return c.json({ hospitals });
});

route.get("/guest-emergencies", async (c) => {
  const result = await c.env.geofix167_db.prepare(`
    SELECT r.incident_id AS id, r.title, r.category, r.description_sanitized AS description,
      r.latitude, r.longitude, r.location_description AS location,
      r.submitted_at, r.priority_code, r.within_barangay_boundary,
      s.code AS status_code, s.display_name AS status,
      COALESCE(gs.display_name, 'Guest') AS reporter,
      CASE
        WHEN s.code = 'VERIFIED' THEN 'VERIFIED_EMERGENCY'
        WHEN datetime(r.submitted_at, '+60 seconds') <= datetime('now') THEN 'UNREVIEWED_EMERGENCY'
        ELSE 'PENDING_ADMIN_REVIEW'
      END AS routing_status
    FROM incident_reports r
    JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    WHERE r.is_emergency = 1
      AND r.guest_session_id IS NOT NULL
      AND s.code IN ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED')
    ORDER BY r.submitted_at DESC
    LIMIT 100
  `).all();

  return c.json({ emergencies: result.results ?? [] });
});

function dutyResponse(status: string) {
  return { ok: true, on_duty: status === "AVAILABLE" || status === "BUSY", availability_status: status };
}

async function ensureResponderResource(
  db: AppEnv["Bindings"]["geofix167_db"],
  user: AppEnv["Variables"]["user"],
): Promise<{ availability_status: string }> {
  const existing = await db.prepare(
    "SELECT availability_status FROM responder_resources WHERE responder_user_id = ? LIMIT 1",
  ).bind(user.id).first<{ availability_status: string }>();
  if (existing) return existing;

  const role = String(user.role || "tanod").toLowerCase();
  const resourceType = role === "police" ? "POLICE" : role === "fire" ? "FIRE" : "TANOD";
  const displayName =
    user.full_name?.trim() ||
    (role === "police" ? "PNP Patrol Unit" : role === "fire" ? "BFP Fire Unit" : "Barangay Tanod");

  await db.prepare(`
    INSERT INTO responder_resources
      (responder_resource_id, responder_user_id, resource_type, display_name, availability_status, updated_at)
    VALUES (?, ?, ?, ?, 'AVAILABLE', datetime('now'))
  `).bind(crypto.randomUUID(), user.id, resourceType, displayName).run().catch(() => {});

  return { availability_status: "AVAILABLE" };
}

route.get("/duty-status", async (c) => {
  try {
    const row = await ensureResponderResource(c.env.geofix167_db, c.get("user"));
    return c.json(dutyResponse(row.availability_status));
  } catch {
    return c.json({ error: "Unable to load duty status. Please retry." }, 503);
  }
});

route.patch("/duty-status", async (c) => {
  const body = z.object({ on_duty: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "on_duty must be a JSON boolean." }, 400);
  const currentUser = c.get("user");
  const owner = currentUser.id;
  const requested = body.data.on_duty;
  const db = c.env.geofix167_db;
  try {
    await ensureResponderResource(db, currentUser);
    const [, read] = await db.batch([
      db.prepare(`UPDATE responder_resources SET availability_status = ?, updated_at = datetime('now')
        WHERE responder_user_id = ? AND availability_status IN ('AVAILABLE', 'UNAVAILABLE')`)
        .bind(requested ? "AVAILABLE" : "UNAVAILABLE", owner),
      db.prepare("SELECT availability_status FROM responder_resources WHERE responder_user_id = ?").bind(owner),
    ]);
    const row = read?.results[0] as { availability_status: string } | undefined;
    if (!row) return c.json(dutyResponse(requested ? "AVAILABLE" : "UNAVAILABLE"));
    const result = dutyResponse(row.availability_status);
    if (result.on_duty !== requested) {
      return c.json({ error: row.availability_status === "BUSY"
        ? "Finish your active dispatch before going off duty."
        : "Your resource availability prevents this duty change." }, 409);
    }
    return c.json(result);
  } catch {
    return c.json({ error: "Unable to save duty status. Please retry." }, 503);
  }
});

route.get("/", async (c) => {
  const currentUser = c.get("user");
  const requestedStatus = c.req.query("status");
  const status = requestedStatus ? statusSchema.safeParse(requestedStatus) : null;
  if (status && !status.success) return c.json({ error: "Invalid dispatch status." }, 400);

  // Clean up any legacy 'wdad' mock/test rows in local D1
  await c.env.geofix167_db.batch([
    c.env.geofix167_db.prepare(`DELETE FROM responder_dispatches WHERE LOWER(TRIM(incident_title)) = 'wdad'`),
    c.env.geofix167_db.prepare(`DELETE FROM incident_reports WHERE LOWER(TRIM(title)) = 'wdad' OR LOWER(TRIM(description_original)) = 'wdad'`),
  ]).catch(() => { });

  const statusClause = status
    ? status.data === "COMPLETED"
      ? "AND (rd.status = ? OR r.incident_status_id IN (9, 10))"
      : "AND rd.status = ? AND r.incident_status_id NOT IN (9, 10)"
    : "";
  const bindings = status
    ? [currentUser.role, currentUser.role, status.data]
    : [currentUser.role, currentUser.role];
  const result = currentUser.role === "tanod"
    ? { results: [] }
    : await c.env.geofix167_db.prepare(`
        SELECT rd.responder_dispatch_id AS id, rd.incident_id,
          COALESCE(r.title, rd.incident_title) AS incident_title,
          COALESCE(r.category, rd.incident_category) AS incident_category,
          COALESCE(r.location_description, rd.incident_location) AS incident_location,
          COALESCE(r.latitude, rd.incident_latitude) AS incident_latitude,
          COALESCE(r.longitude, rd.incident_longitude) AS incident_longitude,
          rd.target_role, rd.urgency, rd.vehicle_name,
          CASE
            WHEN rd.status = 'COMPLETED' OR r.incident_status_id = 10 THEN 'COMPLETED'
            WHEN r.incident_status_id = 9 THEN 'COMPLETED'
            ELSE rd.status
          END AS status,
          rd.dispatched_at,
          (
            SELECT ise.created_at FROM incident_status_events ise
            WHERE ise.incident_id = rd.incident_id AND ise.to_incident_status_id = 8
            ORDER BY ise.created_at DESC LIMIT 1
          ) AS arrived_at,
          (
            SELECT ise.created_at FROM incident_status_events ise
            WHERE ise.incident_id = rd.incident_id AND ise.to_incident_status_id IN (9, 10)
            ORDER BY ise.created_at DESC LIMIT 1
          ) AS completed_at,
          (
            SELECT ise.note FROM incident_status_events ise
            WHERE ise.incident_id = rd.incident_id AND ise.note LIKE '[AGENCY REPORT]%'
            ORDER BY ise.created_at DESC LIMIT 1
          ) AS agency_report_note,
          COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), gs.display_name, 'Guest') AS reporter_name,
          COALESCE(NULLIF(trim(r.callback_mobile_number), ''), NULLIF(trim(u.mobile_number), ''), NULLIF(trim(gs.contact_mobile_number), ''), '') AS reporter_phone,
          COALESCE(r.description_sanitized, r.description_original, '') AS incident_description,
          COALESCE(r.is_emergency, 1) AS is_emergency,
          (
            SELECT ise.note FROM incident_status_events ise
            WHERE ise.incident_id = rd.incident_id AND ise.note LIKE '[BDRRMO NOTE]%'
            ORDER BY ise.created_at DESC LIMIT 1
          ) AS tactical_note,
          CASE WHEN rd.status = 'ON_SCENE' THEN (
            SELECT ise.note FROM incident_status_events ise
            WHERE ise.incident_id = rd.incident_id AND ise.note LIKE '[COMPLETION REJECTED]%'
            ORDER BY ise.created_at DESC LIMIT 1
          ) ELSE NULL END AS completion_rejected_note
        FROM responder_dispatches rd
        JOIN incident_reports r ON r.incident_id = rd.incident_id
        LEFT JOIN users u ON u.user_id = r.reported_by_user_id
        LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
        WHERE (rd.target_role = ? OR ? = 'bdrrmo')
          AND r.incident_status_id NOT IN (11, 12)
          AND LOWER(TRIM(COALESCE(r.title, rd.incident_title, ''))) != 'wdad'
          ${statusClause}
        ORDER BY rd.dispatched_at DESC
        LIMIT 200
      `).bind(...bindings).all();

  const rawDispatches = (result.results ?? []) as Array<Record<string, unknown>>;

  const photoRows = await c.env.geofix167_db.prepare(`
    SELECT incident_id, incident_media_id AS id, COALESCE(original_filename, '') AS original_filename
    FROM incident_media
    WHERE media_type = 'PHOTO'
    ORDER BY created_at, incident_media_id
  `).all<{ incident_id: string; id: string; original_filename: string }>().catch(() => ({ results: [] }));

  const photosByIncident = new Map<string, string[]>();
  const reporterPhotosByIncident = new Map<string, string[]>();
  const responderPhotosByIncident = new Map<string, string[]>();
  for (const p of photoRows.results ?? []) {
    const list = photosByIncident.get(p.incident_id) ?? [];
    list.push(p.id);
    photosByIncident.set(p.incident_id, list);

    const isResponderProof =
      p.original_filename.includes("-resolution") ||
      p.original_filename.startsWith("transport-proof") ||
      p.original_filename.startsWith("maintenance");

    if (isResponderProof) {
      const respList = responderPhotosByIncident.get(p.incident_id) ?? [];
      respList.push(p.id);
      responderPhotosByIncident.set(p.incident_id, respList);
    } else {
      const repList = reporterPhotosByIncident.get(p.incident_id) ?? [];
      repList.push(p.id);
      reporterPhotosByIncident.set(p.incident_id, repList);
    }
  }

  const qrRows = await c.env.geofix167_db.prepare(`
    SELECT qr_handover_id, incident_id, token_hash, receiving_remarks, created_at, expires_at
    FROM qr_handovers
    ORDER BY created_at DESC
  `).all<{
    qr_handover_id: string;
    incident_id: string;
    token_hash: string;
    receiving_remarks: string | null;
    created_at: string;
    expires_at: string | null;
  }>().catch(() => ({ results: [] }));

  const qrByIncident = new Map<string, Record<string, unknown>>();
  for (const q of qrRows.results ?? []) {
    if (qrByIncident.has(q.incident_id)) continue;
    let parsedRemarks: Record<string, unknown> = {};
    if (q.receiving_remarks) {
      try {
        parsedRemarks = JSON.parse(q.receiving_remarks);
      } catch {
        parsedRemarks = { further_info: q.receiving_remarks };
      }
    }
    qrByIncident.set(q.incident_id, {
      handover_id: q.qr_handover_id,
      token: q.token_hash?.slice(0, 24) || q.qr_handover_id,
      created_at: q.created_at,
      expires_at: q.expires_at,
      ...parsedRemarks,
    });
  }

  const dispatches = rawDispatches.map((row) => {
    const incId = String(row.incident_id);
    const qrHandover = qrByIncident.get(incId) ?? null;
    const responderPhotos = responderPhotosByIncident.get(incId) ?? [];
    if (
      qrHandover &&
      typeof qrHandover.proof_media_id === "string" &&
      !responderPhotos.includes(qrHandover.proof_media_id)
    ) {
      responderPhotos.push(qrHandover.proof_media_id);
    }

    return {
      ...row,
      incident_description: stripSelectedDetails(row.incident_description),
      reporter_photo_ids: reporterPhotosByIncident.get(incId) ?? [],
      responder_photo_ids: responderPhotos,
      qr_handover: qrHandover,
    };
  });

  if (currentUser.role === "tanod") {
    const tanodResult = await c.env.geofix167_db.prepare(`
      SELECT ta.tanod_assignment_id AS id, ta.incident_id, r.title AS incident_title,
        r.category AS incident_category, r.location_description AS incident_location,
        r.latitude AS incident_latitude, r.longitude AS incident_longitude,
        'tanod' AS target_role, COALESCE(r.priority_code, 'High') AS urgency,
        rr.display_name AS vehicle_name,
        CASE
          WHEN ta.assignment_status_id = 6 OR r.incident_status_id = 10 THEN 'COMPLETED'
          WHEN r.incident_status_id = 9 THEN 'PENDING'
          WHEN ta.assignment_status_id = 1 THEN 'DISPATCHED'
          WHEN ta.assignment_status_id = 2 THEN 'ACCEPTED'
          WHEN ta.assignment_status_id = 3 THEN 'DECLINED'
          WHEN ta.assignment_status_id = 4 THEN 'EN_ROUTE'
          WHEN ta.assignment_status_id = 5 THEN 'ON_SCENE'
          ELSE 'DISPATCHED'
        END AS status,
        ta.assigned_at AS dispatched_at,
        COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), gs.display_name, 'Guest') AS reporter_name,
        COALESCE(NULLIF(trim(r.callback_mobile_number), ''), NULLIF(trim(u.mobile_number), ''), NULLIF(trim(gs.contact_mobile_number), ''), '') AS reporter_phone,
        COALESCE(r.description_sanitized, r.description_original, '') AS incident_description,
        COALESCE(r.is_emergency, 1) AS is_emergency,
        ta.notes AS raw_notes,
        CASE WHEN ta.assignment_status_id = 5 THEN (
          SELECT ise.note FROM incident_status_events ise
          WHERE ise.incident_id = ta.incident_id AND ise.note LIKE '[COMPLETION REJECTED]%'
          ORDER BY ise.created_at DESC LIMIT 1
        ) ELSE NULL END AS completion_rejected_note
      FROM tanod_assignments ta
      JOIN incident_reports r ON r.incident_id = ta.incident_id
      LEFT JOIN users u ON u.user_id = r.reported_by_user_id
      LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
      LEFT JOIN responder_resources rr ON rr.responder_resource_id = ta.responder_resource_id
      WHERE ta.tanod_user_id = ?
      ORDER BY ta.assigned_at DESC
      LIMIT 100
    `).bind(currentUser.id).all<Record<string, unknown>>();

    const mappedTanod = (tanodResult.results ?? []).map((row) => {
      const meta = parseMaintenanceMeta(String(row.raw_notes || ""));
      const isMaintenance = Number(row.is_emergency) === 0 || Boolean(meta);
      const inspectionPhotos = meta?.inspection_photo_ids ?? [];
      const repairPhotos = meta?.repair_photo_ids ?? [];
      const allPhotos = photosByIncident.get(String(row.incident_id)) ?? [];
      const reporterPhotos = allPhotos.filter(
        (pid) => !inspectionPhotos.includes(pid) && !repairPhotos.includes(pid),
      );
      const computedStatus = meta?.repair_done
        ? "COMPLETED"
        : meta?.for_funding
          ? "FOR_FUNDING"
          : meta?.inspection_done && row.status === "ACCEPTED"
            ? "EN_ROUTE"
            : String(row.status);

      return {
        ...row,
        incident_description: stripSelectedDetails(row.incident_description),
        status: computedStatus,
        is_maintenance: isMaintenance,
        for_funding: Boolean(meta?.for_funding),
        for_funding_note: meta?.for_funding_note ?? "",
        urgency: meta?.urgency || row.urgency,
        inspection_deadline: meta?.deadline ?? null,
        admin_notes: meta?.admin_notes ?? "",
        inspection_done: Boolean(meta?.inspection_done),
        inspection_note: meta?.inspection_note ?? "",
        inspection_photo_ids: inspectionPhotos,
        repair_done: Boolean(meta?.repair_done),
        repair_note: meta?.repair_note ?? "",
        repair_photo_ids: repairPhotos,
        reporter_photo_ids: reporterPhotos,
      };
    }).filter((item) => (!status ? true : item.status === status.data));

    return c.json({ dispatches: [...dispatches, ...mappedTanod] });
  }

  return c.json({ dispatches });
});

route.patch("/:dispatchId/status", async (c) => {
  const status = statusSchema.safeParse((await c.req.json().catch(() => null))?.status);
  const dispatchId = c.req.param("dispatchId");
  if (!status.success || !dispatchId) {
    return c.json({ error: "A valid dispatch status is required." }, 400);
  }
  if (c.get("user").role === "tanod" && status.data === "COMPLETED") {
    return c.json({ error: "Tanods cannot mark tasks as Completed. Submit proof for Admin verification." }, 403);
  }

  const result = await c.env.geofix167_db.prepare(`
    UPDATE responder_dispatches
    SET status = ?
    WHERE responder_dispatch_id = ?
      AND (target_role = ? OR ? = 'bdrrmo')
  `).bind(status.data, dispatchId, c.get("user").role, c.get("user").role).run();

  if (!result.meta.changes && c.get("user").role === "tanod") {
    const statusMap: Record<string, number> = {
      ACCEPTED: 2,
      DECLINED: 3,
      EN_ROUTE: 4,
      ON_SCENE: 5,
      COMPLETED: 6,
    };
    const tanodUpdate = await c.env.geofix167_db.prepare(`
      UPDATE tanod_assignments
      SET assignment_status_id = ?,
          accepted_at = CASE WHEN ? = 'ACCEPTED' THEN COALESCE(accepted_at, datetime('now')) ELSE accepted_at END,
          completed_at = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completed_at, datetime('now')) ELSE completed_at END
      WHERE tanod_assignment_id = ? AND tanod_user_id = ?
    `).bind(statusMap[status.data], status.data, status.data, dispatchId, c.get("user").id).run();
    if (tanodUpdate.meta.changes) {
      await c.env.geofix167_db.prepare(`INSERT INTO tanod_assignment_events
        (tanod_assignment_event_id, tanod_assignment_id, assignment_status_id, changed_by_user_id, note)
        VALUES (?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), dispatchId, statusMap[status.data], c.get("user").id, `Responder status: ${status.data}`).run();
      await recordTrackingStatus(c.env.geofix167_db, dispatchId, c.get("user").id, status.data);
      return c.json({ ok: true, status: status.data });
    }
  }

  if (!result.meta.changes) return c.json({ error: "Dispatch not found." }, 404);
  await recordTrackingStatus(c.env.geofix167_db, dispatchId, c.get("user").id, status.data);
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

  const db = c.env.geofix167_db;
  const incidentId = body.data.incident_id;
  const targetRoles = [...new Set(body.data.target_roles)];
  const report = await db.prepare(`
    SELECT r.incident_id, r.title, r.category, r.location_description,
      r.latitude, r.longitude, r.is_emergency, r.incident_status_id, s.code AS status_code
    FROM incident_reports r
    JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
    WHERE r.incident_id = ?
    LIMIT 1
  `).bind(incidentId).first<{
    incident_id: string;
    title: string;
    category: string;
    location_description: string | null;
    latitude: number | null;
    longitude: number | null;
    is_emergency: number;
    incident_status_id: number;
    status_code: string;
  }>();

  if (!report) {
    return c.json({ error: "Incident report not found." }, 404);
  }

  const existingDispatch = await db.prepare(`
    SELECT responder_dispatch_id
    FROM responder_dispatches
    WHERE incident_id = ?
    LIMIT 1
  `).bind(incidentId).first<{ responder_dispatch_id: string }>();

  if (existingDispatch || report.status_code === "DISPATCHED") {
    return c.json({ error: "This incident has already been dispatched." }, 409);
  }

  if (report.is_emergency !== 1 || report.status_code !== "FORWARDED_TO_BDRRMO") {
    return c.json({ error: "Only emergency reports forwarded to BDRRMO can be dispatched." }, 409);
  }

  const statusEventId = crypto.randomUUID();
  const title = report.title?.trim() || body.data.incident_title;
  const category = report.category?.trim() || body.data.incident_category;
  const location = report.location_description?.trim() || body.data.incident_location || null;
  const latitude = report.latitude ?? body.data.incident_latitude ?? null;
  const longitude = report.longitude ?? body.data.incident_longitude ?? null;

  const statements = [
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 13, updated_at = datetime('now')
      WHERE incident_id = ? AND is_emergency = 1 AND incident_status_id = 5
        AND NOT EXISTS (SELECT 1 FROM responder_dispatches WHERE incident_id = ?)
    `).bind(incidentId, incidentId),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, ?, 5, 13, ?, 'Emergency dispatched by BDRRMO'
      WHERE changes() = 1
    `).bind(statusEventId, incidentId, c.get("user").id),
    ...targetRoles.flatMap((targetRole) => {
      const assignmentId = crypto.randomUUID();
      return [db.prepare(`
      INSERT INTO responder_dispatches
        (responder_dispatch_id, incident_id, incident_title, incident_category,
         incident_location, incident_latitude, incident_longitude,
         dispatched_by_user_id, target_role, urgency, vehicle_name)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM incident_status_events WHERE incident_status_event_id = ?)
    `).bind(
      assignmentId,
      incidentId,
      title,
      category,
      location,
      latitude,
      longitude,
      c.get("user").id,
      targetRole,
      body.data.urgency,
      body.data.vehicle_name || null,
      statusEventId,
    ), notify(db, { type: "team_dispatched", actorId: c.get("user").id, eventId: assignmentId,
      reportId: incidentId, assignmentId, afterChange: true })];
    }),
  ];

  const results = await db.batch(statements);
  if (!results[0]?.meta.changes) {
    return c.json({ error: "This incident has already been dispatched." }, 409);
  }

  return c.json({ ok: true, incident_id: incidentId, status: "DISPATCHED" }, 201);
});

route.post("/:dispatchId/qr-handover", async (c) => {
  const dispatchId = c.req.param("dispatchId");
  const body = (await c.req.json().catch(() => null)) as {
    incident_id?: string;
    hospital_name?: string;
    further_info?: string;
    proof_photo_base64?: string;
    proof_photo_mime?: string;
    patients?: Array<{ full_name?: string; contact?: string; age?: string; sex?: string; condition?: string; notes?: string }>;
  } | null;
  if (!dispatchId || !body?.incident_id) {
    return c.json({ error: "dispatchId and incident_id are required." }, 400);
  }

  const currentUser = c.get("user");
  const handoverId = crypto.randomUUID();
  const rawToken = crypto.randomUUID();
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  let mediaId: string | null = null;
  if (body.proof_photo_base64) {
    try {
      const cleanBase64 = body.proof_photo_base64.replace(/^data:image\/\w+;base64,/, "");
      const binaryStr = atob(cleanBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i += 1) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const mime = body.proof_photo_mime === "image/png" ? "image/png" : "image/jpeg";
      const ext = mime === "image/png" ? "png" : "jpg";
      mediaId = crypto.randomUUID();
      const storageKey = `reports/${body.incident_id}/${mediaId}.${ext}`;
      const shaBuf = await crypto.subtle.digest("SHA-256", bytes.buffer);
      const shaHex = Array.from(new Uint8Array(shaBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (c.env.geofix167_uploads) {
        await c.env.geofix167_uploads.put(storageKey, bytes.buffer, {
          httpMetadata: { contentType: mime },
          customMetadata: { incidentId: body.incident_id },
        });
      }

      await c.env.geofix167_db.prepare(`
        INSERT INTO incident_media
          (incident_media_id, incident_id, uploaded_by_user_id, media_type, storage_key,
           content_type, byte_size, original_filename, upload_key, content_sha256, media_url, created_at)
        VALUES (?, ?, ?, 'PHOTO', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        mediaId,
        body.incident_id,
        currentUser.id,
        storageKey,
        mime,
        bytes.byteLength,
        `transport-proof.${ext}`,
        crypto.randomUUID(),
        shaHex,
        `/api/media/${mediaId}`,
      ).run();
    } catch (err) {
      console.error("Failed to store proof photo:", err);
    }
  }

  const remarksPayload = JSON.stringify({
    hospital_name: body.hospital_name || null,
    further_info: body.further_info || null,
    proof_media_id: mediaId,
    patients: Array.isArray(body.patients) ? body.patients : [],
  });

  await c.env.geofix167_db.batch([c.env.geofix167_db.prepare(`
    INSERT INTO qr_handovers
      (qr_handover_id, incident_id, qr_status_id, created_by_tanod_user_id, token_hash, receiving_remarks, expires_at)
    VALUES (?, ?, 2, ?, ?, ?, datetime('now', '+2 hours'))
  `).bind(handoverId, body.incident_id, currentUser.id, tokenHash, remarksPayload),
    notify(c.env.geofix167_db, { type: "handover_submitted", actorId: currentUser.id, eventId: handoverId,
      assignmentId: dispatchId, reportId: body.incident_id }),
  ]);

  await c.env.geofix167_db.prepare(`
    UPDATE responder_dispatches
    SET status = 'ON_SCENE'
    WHERE responder_dispatch_id = ?
  `).bind(dispatchId).run();

  if (currentUser.role === "tanod") {
    await c.env.geofix167_db.prepare(`
      UPDATE tanod_assignments
      SET assignment_status_id = 6, completed_at = datetime('now')
      WHERE tanod_assignment_id = ? AND tanod_user_id = ?
    `).bind(dispatchId, currentUser.id).run();

    await c.env.geofix167_db.prepare(`
      UPDATE responder_resources
      SET availability_status = 'AVAILABLE', updated_at = datetime('now')
      WHERE responder_user_id = ?
    `).bind(currentUser.id).run().catch(() => { });
  }

  const [remAgencyQr, remTanodQr] = await Promise.all([
    c.env.geofix167_db.prepare(`SELECT COUNT(*) AS cnt FROM responder_dispatches WHERE incident_id = ? AND status NOT IN ('COMPLETED', 'DECLINED')`).bind(body.incident_id).first<{ cnt: number }>(),
    c.env.geofix167_db.prepare(`SELECT COUNT(*) AS cnt FROM tanod_assignments WHERE incident_id = ? AND assignment_status_id NOT IN (3, 6)`).bind(body.incident_id).first<{ cnt: number }>(),
  ]);
  if (Number(remAgencyQr?.cnt || 0) === 0 && Number(remTanodQr?.cnt || 0) === 0) {
    await c.env.geofix167_db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 9, updated_at = datetime('now')
      WHERE incident_id = ? AND incident_status_id NOT IN (10, 11)
    `).bind(body.incident_id).run();
  }

  await c.env.geofix167_db.prepare(`
    INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
    VALUES (?, ?, 8, 9, ?, ?)
  `).bind(
    crypto.randomUUID(),
    body.incident_id,
    currentUser.id,
    `Hospital QR handover generated (${body.hospital_name || "Hospital"}). ${body.further_info || ""}`.trim(),
  ).run().catch(() => { });

  return c.json({
    ok: true,
    handover_id: handoverId,
    token: rawToken,
    qr_url: `/handover?token=${rawToken}`,
    summary_pdf_url: `/api/reports/${encodeURIComponent(body.incident_id)}/handover-summary`,
    proof_media_id: mediaId,
    patient_count: Array.isArray(body.patients) ? body.patients.length : 0,
  }, 201);
});

async function storeBase64IncidentPhoto(
  c: { env: AppEnv["Bindings"] },
  incidentId: string,
  userId: string,
  base64Data?: string,
  mimeType?: string,
  filenamePrefix = "maintenance",
): Promise<string | null> {
  if (!base64Data) return null;
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const binaryStr = atob(cleanBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i += 1) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const mime = mimeType === "image/png" ? "image/png" : "image/jpeg";
    const ext = mime === "image/png" ? "png" : "jpg";
    const mediaId = crypto.randomUUID();
    const storageKey = `reports/${incidentId}/${mediaId}.${ext}`;
    const shaBuf = await crypto.subtle.digest("SHA-256", bytes.buffer);
    const shaHex = Array.from(new Uint8Array(shaBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (c.env.geofix167_uploads) {
      await c.env.geofix167_uploads.put(storageKey, bytes.buffer, {
        httpMetadata: { contentType: mime },
        customMetadata: { incidentId },
      });
    }

    await c.env.geofix167_db.prepare(`
      INSERT INTO incident_media
        (incident_media_id, incident_id, uploaded_by_user_id, media_type, storage_key,
         content_type, byte_size, original_filename, upload_key, content_sha256, media_url, created_at)
      VALUES (?, ?, ?, 'PHOTO', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      mediaId,
      incidentId,
      userId,
      storageKey,
      mime,
      bytes.byteLength,
      `${filenamePrefix}-${mediaId.slice(0, 6)}.${ext}`,
      crypto.randomUUID(),
      shaHex,
      `/api/media/${mediaId}`,
    ).run();

    return mediaId;
  } catch (err) {
    console.error("Failed to store maintenance photo:", err);
    return null;
  }
}

route.post("/:dispatchId/maintenance-inspection", async (c) => {
  const dispatchId = c.req.param("dispatchId");
  const body = (await c.req.json().catch(() => null)) as {
    incident_id?: string;
    note?: string;
    photo_base64?: string;
    photo_mime?: string;
  } | null;

  if (!dispatchId || !body?.incident_id) {
    return c.json({ error: "dispatchId and incident_id are required." }, 400);
  }

  const currentUser = c.get("user");
  const db = c.env.geofix167_db;
  const existing = await db.prepare(`
    SELECT tanod_assignment_id, notes FROM tanod_assignments WHERE tanod_assignment_id = ?
  `).bind(dispatchId).first<{ tanod_assignment_id: string; notes: string | null }>();

  if (!existing) return c.json({ error: "Maintenance assignment not found." }, 404);

  const mediaId = await storeBase64IncidentPhoto(
    c,
    body.incident_id,
    currentUser.id,
    body.photo_base64,
    body.photo_mime,
    "tanod-inspection",
  );

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

  meta.inspection_done = true;
  meta.inspection_at = new Date().toISOString();
  meta.inspection_note = String(body.note || "").trim();
  if (mediaId) {
    meta.inspection_photo_ids = [...meta.inspection_photo_ids, mediaId];
  }

  await db.prepare(`
    UPDATE tanod_assignments
    SET assignment_status_id = 4, notes = ?
    WHERE tanod_assignment_id = ?
  `).bind(JSON.stringify(meta), dispatchId).run();

  try {
    const rep = await db.prepare(`SELECT reported_by_user_id FROM incident_reports WHERE incident_id = ?`)
      .bind(body.incident_id).first<{ reported_by_user_id: string | null }>();
    if (rep?.reported_by_user_id) {
      await db.prepare(`
        INSERT INTO resident_notifications
          (notification_id, recipient_user_id, incident_id, type, title, body, created_at)
        VALUES (?, ?, ?, 'report_update', ?, ?, ?)
      `).bind(
        crypto.randomUUID().replace(/-/g, ""),
        rep.reported_by_user_id,
        body.incident_id,
        "On-Site Inspection Completed",
        `Tanod completed the on-site inspection and uploaded inspection photo proof${meta.inspection_note ? `: "${meta.inspection_note}"` : "."}`,
        new Date().toISOString(),
      ).run();
    }
  } catch { /* ignore notification error */ }

  return c.json({
    ok: true,
    inspection_done: true,
    media_id: mediaId,
    inspection_photo_ids: meta.inspection_photo_ids,
  });
});

route.post("/:dispatchId/maintenance-repair", async (c) => {
  const dispatchId = c.req.param("dispatchId");
  const body = (await c.req.json().catch(() => null)) as {
    incident_id?: string;
    note?: string;
    photo_base64?: string;
    photo_mime?: string;
  } | null;

  if (!dispatchId || !body?.incident_id) {
    return c.json({ error: "dispatchId and incident_id are required." }, 400);
  }

  const currentUser = c.get("user");
  const db = c.env.geofix167_db;
  const existing = await db.prepare(`
    SELECT tanod_assignment_id, incident_id, notes FROM tanod_assignments WHERE tanod_assignment_id = ? AND incident_id = ? AND tanod_user_id = ?
  `).bind(dispatchId, body.incident_id, currentUser.id).first<{ tanod_assignment_id: string; incident_id: string; notes: string | null }>();

  if (!existing) return c.json({ error: "Maintenance assignment not found." }, 404);

  const mediaId = await storeBase64IncidentPhoto(
    c,
    body.incident_id,
    currentUser.id,
    body.photo_base64,
    body.photo_mime,
    "tanod-repair",
  );

  const meta = parseMaintenanceMeta(existing.notes) || {
    type: "MAINTENANCE" as const,
    urgency: "Standard",
    deadline: Date.now() + 3 * 86400000,
    admin_notes: "",
    inspection_done: true,
    inspection_note: "",
    inspection_photo_ids: [],
    admin_check_approved: false,
    repair_done: false,
    repair_note: "",
    repair_photo_ids: [],
  };

  meta.repair_done = true;
  meta.repair_at = new Date().toISOString();
  meta.repair_note = String(body.note || "").trim();
  if (mediaId) {
    meta.repair_photo_ids = [...meta.repair_photo_ids, mediaId];
  }

  await db.batch([db.prepare(`
    UPDATE tanod_assignments
    SET notes = ?
    WHERE tanod_assignment_id = ?
  `).bind(JSON.stringify(meta), dispatchId),
    notify(db, { type: "resolution_ready", linkPath: "/admin/maintenance-tasks", actorId: c.get("user").id, eventId: dispatchId,
      assignmentId: dispatchId, reportId: existing.incident_id, afterChange: true }),
  ]);

  try {
    const rep = await db.prepare(`SELECT reported_by_user_id FROM incident_reports WHERE incident_id = ?`)
      .bind(body.incident_id).first<{ reported_by_user_id: string | null }>();
    if (rep?.reported_by_user_id) {
      await db.prepare(`
        INSERT INTO resident_notifications
          (notification_id, recipient_user_id, incident_id, type, title, body, created_at)
        VALUES (?, ?, ?, 'report_update', ?, ?, ?)
      `).bind(
        crypto.randomUUID().replace(/-/g, ""),
        rep.reported_by_user_id,
        body.incident_id,
        "Proof of Repair Submitted",
        `Tanod uploaded final proof of repair photos${meta.repair_note ? `: "${meta.repair_note}"` : " and submitted the task for Admin verification."}`,
        new Date().toISOString(),
      ).run();
    }
  } catch { /* ignore notification error */ }

  return c.json({
    ok: true,
    repair_done: true,
    media_id: mediaId,
    repair_photo_ids: meta.repair_photo_ids,
  });
});

route.post("/:dispatchId/complete-agency", async (c) => {
  const dispatchId = c.req.param("dispatchId");
  const body = (await c.req.json().catch(() => null)) as {
    incident_id?: string;
    summary?: string;
    proof_photo_base64?: string;
    proof_photo_mime?: string;
    persons?: Array<{
      full_name?: string;
      contact?: string;
      role_in_incident?: string;
      age?: string;
      sex?: string;
      condition?: string;
      notes?: string;
    }>;
  } | null;

  if (!dispatchId || !body?.incident_id) {
    return c.json({ error: "dispatchId and incident_id are required." }, 400);
  }

  const currentUser = c.get("user");
  const db = c.env.geofix167_db;
  const mediaId = await storeBase64IncidentPhoto(
    c,
    body.incident_id,
    currentUser.id,
    body.proof_photo_base64,
    body.proof_photo_mime,
    `${currentUser.role}-resolution`,
  );

  const reportType = currentUser.role === "police"
    ? "Police Criminal / Incident Report"
    : currentUser.role === "fire"
      ? "BFP Fire Scene Report"
      : "Tanod Scene Completion Report";
  const personsList = Array.isArray(body.persons) ? body.persons : [];
  const personsSummary = personsList
    .filter((p) => p?.full_name?.trim())
    .map((p) => `${p.full_name?.trim()}${p.role_in_incident ? ` (${p.role_in_incident})` : ""}${p.contact ? ` [${p.contact}]` : ""}`)
    .join(", ");
  const personsSuffix = personsSummary ? ` | Involved Persons: ${personsSummary}` : "";
  const summaryText = String(body.summary || "Scene resolved and proof photo attached.").trim();
  const payloadNote = `[AGENCY REPORT] ${reportType} by ${currentUser.role.toUpperCase()} (${personsList.length} person(s)). ${summaryText}${personsSuffix}`;

  await db.batch([
    ...(currentUser.role === "tanod"
      ? [
        db.prepare(`
          UPDATE tanod_assignments
          SET assignment_status_id = 6, completed_at = datetime('now')
          WHERE tanod_assignment_id = ?
        `).bind(dispatchId),
      ]
      : [
        db.prepare(`
          UPDATE responder_dispatches
          SET status = 'COMPLETED'
          WHERE responder_dispatch_id = ?
        `).bind(dispatchId),
      ]),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      VALUES (?, ?, 8, 9, ?, ?)
    `).bind(crypto.randomUUID(), body.incident_id, currentUser.id, payloadNote),
    db.prepare(`
      UPDATE responder_resources
      SET availability_status = 'AVAILABLE', updated_at = datetime('now')
      WHERE responder_user_id = ?
    `).bind(currentUser.id),
  ]);

  const [remAgency, remTanod] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS cnt FROM responder_dispatches WHERE incident_id = ? AND status NOT IN ('COMPLETED', 'DECLINED')`).bind(body.incident_id).first<{ cnt: number }>(),
    db.prepare(`SELECT COUNT(*) AS cnt FROM tanod_assignments WHERE incident_id = ? AND assignment_status_id NOT IN (3, 6)`).bind(body.incident_id).first<{ cnt: number }>(),
  ]);
  if (Number(remAgency?.cnt || 0) === 0 && Number(remTanod?.cnt || 0) === 0) {
    await db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 9, updated_at = datetime('now')
      WHERE incident_id = ? AND incident_status_id NOT IN (10, 11)
    `).bind(body.incident_id).run();
    await notify(db, {
      type: "resolution_ready",
      actorId: currentUser.id,
      eventId: `${body.incident_id}:${dispatchId}`,
      assignmentId: dispatchId,
      reportId: body.incident_id,
      afterChange: false,
    }).run().catch(() => {});
  }

  return c.json({
    ok: true,
    status: "COMPLETED",
    summary_pdf_url: `/api/reports/${encodeURIComponent(body.incident_id)}/handover-summary`,
    proof_media_id: mediaId,
  }, 201);
});

route.post("/:dispatchId/request-backup", async (c) => {
  const dispatchId = c.req.param("dispatchId");
  const body = (await c.req.json().catch(() => null)) as {
    incident_id?: string;
    requested_support?: string;
    reason?: string;
  } | null;

  if (!dispatchId || !body?.incident_id) {
    return c.json({ error: "dispatchId and incident_id are required." }, 400);
  }

  const currentUser = c.get("user");
  await c.env.geofix167_db.prepare(`
    INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
    VALUES (?, ?, 8, 8, ?, ?)
  `).bind(
    crypto.randomUUID(),
    body.incident_id,
    currentUser.id,
    `[BACKUP REQUEST] ${currentUser.role.toUpperCase()} requested ${body.requested_support || "Tanod Emergency Transport"}: ${body.reason || "Field support needed on scene"}`,
  ).run();

  return c.json({ ok: true }, 201);
});

route.post("/:dispatchId/arrive", async (c) => {
  const dispatchId = c.req.param("dispatchId");
  const body = (await c.req.json().catch(() => null)) as {
    incident_id?: string;
  } | null;

  if (!dispatchId) {
    return c.json({ error: "dispatchId is required." }, 400);
  }

  const currentUser = c.get("user");
  const db = c.env.geofix167_db;

  const tanodRow = await db.prepare(`
    SELECT tanod_assignment_id, incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
  `).bind(dispatchId).first<{ tanod_assignment_id: string; incident_id: string }>();

  const agencyRow = !tanodRow
    ? await db.prepare(`
        SELECT responder_dispatch_id, incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?
      `).bind(dispatchId).first<{ responder_dispatch_id: string; incident_id: string }>()
    : null;

  const incidentId = body?.incident_id || tanodRow?.incident_id || agencyRow?.incident_id;
  if (!incidentId) {
    return c.json({ error: "Dispatch assignment not found." }, 404);
  }

  const nowIso = new Date().toISOString();
  const statements = [];

  if (tanodRow) {
    statements.push(
      db.prepare(`
        UPDATE tanod_assignments
        SET assignment_status_id = 5
        WHERE tanod_assignment_id = ?
      `).bind(dispatchId),
    );
  } else if (agencyRow) {
    statements.push(
      db.prepare(`
        UPDATE responder_dispatches
        SET status = 'ON_SCENE'
        WHERE responder_dispatch_id = ?
      `).bind(dispatchId),
    );
  }

  statements.push(
    db.prepare(`
      UPDATE incident_reports
      SET incident_status_id = 8, updated_at = datetime('now')
      WHERE incident_id = ? AND incident_status_id NOT IN (9, 10, 11)
    `).bind(incidentId),
    db.prepare(`
      INSERT INTO incident_status_events
        (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      VALUES (?, ?, 7, 8, ?, ?)
    `).bind(
      crypto.randomUUID(),
      incidentId,
      currentUser.id,
      `${currentUser.role.toUpperCase()} arrived on scene`,
    ),
  );

  statements.push(notify(db, { type: "ON_SCENE", actorId: currentUser.id, eventId: dispatchId,
    assignmentId: dispatchId, reportId: incidentId }));
  await db.batch(statements);

  return c.json({ ok: true, status: "ON_SCENE", arrived_at: nowIso });
});

export default route;
