import { Hono } from "hono";
import { z } from "zod";

import { requireAuth, requireRole } from "../middleware/auth";
import type { AppEnv, UserRole } from "../types/env";

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
  if (status === "DECLINED") {
    await db.prepare("DELETE FROM responder_locations WHERE assignment_id = ? AND responder_id = ?")
      .bind(assignmentId, userId).run();
    return;
  }
  const incidentStatusId = { ACCEPTED: 6, EN_ROUTE: 7, ON_SCENE: 8, COMPLETED: 10 }[status];
  await db.batch([
    db.prepare(`INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, r.incident_id, r.incident_status_id, ?, ?, 'Responder updated live tracking status'
      FROM incident_reports r
      WHERE r.incident_id = (SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
        UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?)
        AND r.incident_status_id IN (5, 6, 7, 8, 13)
        AND EXISTS (SELECT 1 FROM tracking_links t WHERE t.report_id = r.incident_id
          AND t.revoked_at IS NULL AND datetime(t.expires_at) > datetime('now'))`)
      .bind(crypto.randomUUID(), incidentStatusId, userId, assignmentId, assignmentId),
    db.prepare(`UPDATE incident_reports SET incident_status_id = ?, updated_at = datetime('now')
      WHERE incident_id = (SELECT incident_id FROM tanod_assignments WHERE tanod_assignment_id = ?
        UNION SELECT incident_id FROM responder_dispatches WHERE responder_dispatch_id = ?)
        AND incident_status_id IN (5, 6, 7, 8, 13) AND changes() = 1`)
      .bind(incidentStatusId, assignmentId, assignmentId),
  ]);
  if (status === "COMPLETED") {
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
    SELECT rd.responder_dispatch_id AS id, rd.incident_id, rd.incident_title, rd.incident_category,
      rd.incident_location, rd.incident_latitude, rd.incident_longitude, rd.target_role, rd.urgency,
      rd.vehicle_name,
      CASE
        WHEN rd.status = 'COMPLETED' OR r.incident_status_id = 10 THEN 'COMPLETED'
        WHEN r.incident_status_id = 9 THEN 'PENDING'
        ELSE rd.status
      END AS status,
      rd.dispatched_at,
      COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), gs.display_name, 'Guest') AS reporter_name,
      COALESCE(r.callback_mobile_number, gs.contact_mobile_number, '') AS reporter_phone,
      COALESCE(r.description_sanitized, r.description_original, '') AS incident_description,
      COALESCE(r.is_emergency, 1) AS is_emergency
    FROM responder_dispatches rd
    LEFT JOIN incident_reports r ON r.incident_id = rd.incident_id
    LEFT JOIN users u ON u.user_id = r.reported_by_user_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    WHERE (rd.target_role = ? OR ? = 'bdrrmo') ${statusClause ? "AND rd.status = ?" : ""}
    ORDER BY rd.dispatched_at DESC
    LIMIT 200
  `).bind(...bindings).all();

  const dispatches = result.results ?? [];

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
        COALESCE(r.callback_mobile_number, gs.contact_mobile_number, '') AS reporter_phone,
        COALESCE(r.description_sanitized, r.description_original, '') AS incident_description,
        COALESCE(r.is_emergency, 1) AS is_emergency
      FROM tanod_assignments ta
      JOIN incident_reports r ON r.incident_id = ta.incident_id
      LEFT JOIN users u ON u.user_id = r.reported_by_user_id
      LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
      LEFT JOIN responder_resources rr ON rr.responder_resource_id = ta.responder_resource_id
      WHERE ta.tanod_user_id = ?
      ORDER BY ta.assigned_at DESC
      LIMIT 100
    `).bind(currentUser.id).all();

    return c.json({ dispatches: [...dispatches, ...(tanodResult.results ?? [])] });
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

  await c.env.geofix167_db.prepare(`
    INSERT INTO qr_handovers
      (qr_handover_id, incident_id, qr_status_id, created_by_tanod_user_id, token_hash, receiving_remarks, expires_at)
    VALUES (?, ?, 2, ?, ?, ?, datetime('now', '+2 hours'))
  `).bind(handoverId, body.incident_id, currentUser.id, tokenHash, remarksPayload).run();

  await c.env.geofix167_db.prepare(`
    UPDATE responder_dispatches
    SET status = 'ON_SCENE'
    WHERE responder_dispatch_id = ?
  `).bind(dispatchId).run();

  if (currentUser.role === "tanod") {
    await c.env.geofix167_db.prepare(`
      UPDATE tanod_assignments
      SET assignment_status_id = 4
      WHERE tanod_assignment_id = ? AND tanod_user_id = ?
    `).bind(dispatchId, currentUser.id).run();

    await c.env.geofix167_db.prepare(`
      UPDATE responder_resources
      SET availability_status = 'AVAILABLE', updated_at = datetime('now')
      WHERE responder_user_id = ?
    `).bind(currentUser.id).run().catch(() => {});
  }

  await c.env.geofix167_db.prepare(`
    UPDATE incident_reports
    SET incident_status_id = 9, updated_at = datetime('now')
    WHERE incident_id = ?
  `).bind(body.incident_id).run();

  await c.env.geofix167_db.prepare(`
    INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
    VALUES (?, ?, 8, 9, ?, ?)
  `).bind(
    crypto.randomUUID(),
    body.incident_id,
    currentUser.id,
    `Hospital QR handover generated (${body.hospital_name || "Hospital"}). ${body.further_info || ""}`.trim(),
  ).run().catch(() => {});

  return c.json({
    ok: true,
    handover_id: handoverId,
    token: rawToken,
    qr_url: `/handover?token=${rawToken}`,
    proof_media_id: mediaId,
    patient_count: Array.isArray(body.patients) ? body.patients.length : 0,
  }, 201);
});

export default route;
