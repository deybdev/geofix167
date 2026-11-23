import type { Context } from "hono";
import type { AppEnv } from "../types/env";
import {
  updateReportStatusSchema, updateReportDetailsSchema,
  createReportSchema,
  listReportsQuerySchema,
} from "../validators/report.schema";
import {
  getIncidentReportDetails,
  getIncidentReports,
  ReportError,
  submitIncidentReport,
  updateReportStatus, updateReportDetails,
} from "../services/report.service";
import { parseMaintenanceMeta } from "../routes/admin-maintenance.route";

async function getDispatchedUnitsForIncidents(
  db: AppEnv["Bindings"]["geofix167_db"],
  incidentIds: string[],
) {
  const unitsByIncident = new Map<
    string,
    Array<{
      id: string;
      role: string;
      name: string;
      status: string;
      dispatched_at: string | null;
      location: { lat: number; lng: number; heading: number | null; updated_at: string } | null;
    }>
  >();
  if (!incidentIds.length) return unitsByIncident;

  try {
    const [tanodRows, agencyRows, locRows] = await Promise.all([
      db.prepare(`
        SELECT ta.tanod_assignment_id AS id, ta.incident_id, ta.assignment_status_id,
          ta.assigned_at, ta.notes,
          COALESCE(rr.display_name, NULLIF(trim(u.first_name || ' ' || u.last_name), ''), 'Barangay Tanod') AS unit_name
        FROM tanod_assignments ta
        LEFT JOIN responder_resources rr ON rr.responder_resource_id = ta.responder_resource_id
        LEFT JOIN users u ON u.user_id = ta.tanod_user_id
        ORDER BY ta.assigned_at DESC
      `).all<Record<string, unknown>>(),
      db.prepare(`
        SELECT responder_dispatch_id AS id, incident_id, target_role AS department, status, dispatched_at
        FROM responder_dispatches
        ORDER BY dispatched_at DESC
      `).all<Record<string, unknown>>(),
      db.prepare(`
        SELECT assignment_id, lat, lng, heading, updated_at
        FROM responder_locations
      `).all<{ assignment_id: string; lat: number; lng: number; heading: number | null; updated_at: string }>(),
    ]);

    const locByAssign = new Map<string, { lat: number; lng: number; heading: number | null; updated_at: string }>();
    for (const loc of locRows.results ?? []) {
      locByAssign.set(loc.assignment_id, {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        heading: loc.heading == null ? null : Number(loc.heading),
        updated_at: loc.updated_at,
      });
    }

    const statusMap: Record<number, string> = {
      1: "DISPATCHED",
      2: "ACCEPTED",
      3: "DECLINED",
      4: "EN_ROUTE",
      5: "ON_SCENE",
      6: "COMPLETED",
    };

    const allowed = new Set(incidentIds);
    for (const row of tanodRows.results ?? []) {
      const incId = String(row.incident_id);
      if (!allowed.has(incId)) continue;
      if (parseMaintenanceMeta(String(row.notes || ""))) continue;
      const id = String(row.id);
      const list = unitsByIncident.get(incId) ?? [];
      list.push({
        id,
        role: "tanod",
        name: String(row.unit_name || "Barangay Tanod"),
        status: statusMap[Number(row.assignment_status_id)] || "DISPATCHED",
        dispatched_at: row.assigned_at ? String(row.assigned_at) : null,
        location: locByAssign.get(id) ?? null,
      });
      unitsByIncident.set(incId, list);
    }

    for (const row of agencyRows.results ?? []) {
      const incId = String(row.incident_id);
      if (!allowed.has(incId)) continue;
      const id = String(row.id);
      const dept = String(row.department || "police").toLowerCase();
      const list = unitsByIncident.get(incId) ?? [];
      list.push({
        id,
        role: dept,
        name: dept === "fire" ? "BFP Fire Unit" : "PNP Police Unit",
        status: String(row.status || "DISPATCHED"),
        dispatched_at: row.dispatched_at ? String(row.dispatched_at) : null,
        location: locByAssign.get(id) ?? null,
      });
      unitsByIncident.set(incId, list);
    }
  } catch {
    // Non-fatal if responder tables are empty
  }

  return unitsByIncident;
}

export async function createReportController(c: Context<AppEnv>) {
  const contentType = c.req.header("Content-Type")?.toLowerCase() ?? "";
  let body: unknown = null;
  let photos: File[] = [];
  if (contentType.startsWith("multipart/form-data;")) {
    const form = await c.req.formData().catch(() => null);
    const reportText = form?.get("report");
    const photoValues = form?.getAll("photos") ?? [];
    const allowedFields = new Set(["report", "photos"]);
    const hasUnexpectedField = form && [...form.keys()].some((key) => !allowedFields.has(key));
    if (!form || typeof reportText !== "string" || form.getAll("report").length !== 1 || hasUnexpectedField
      || photoValues.some((value) => !(value instanceof File))
      || [...form.values()].filter((value) => value instanceof File).length !== photoValues.length) {
      return c.json({ error: "Send a report JSON field and up to three photo files." }, 400);
    }
    try { body = JSON.parse(reportText); }
    catch { return c.json({ error: "The report details are not valid JSON." }, 400); }
    photos = photoValues as File[];
  } else {
    body = await c.req.json().catch(() => null);
  }
  const validation = createReportSchema.safeParse(body);

  if (!validation.success) {
    const fieldErrors = validation.error.flatten().fieldErrors;
    const firstFieldError = Object.values(fieldErrors).flat().find((message) => Boolean(message));
    return c.json(
      {
        error: firstFieldError ?? "Invalid incident report payload.",
        details: fieldErrors,
      },
      400,
    );
  }

  try {
    const result = await submitIncidentReport(
      c.env.geofix167_db,
      validation.data,
      c.get("user"),
      c.req.header("X-Guest-Token"),
      photos,
      c.env.geofix167_uploads,
      c.env.FRONTEND_ORIGIN,
    );

    return c.json(
      {
        report: {
          ...result.report,
          status_events: result.status_events,
        },
        idempotent_replay: result.idempotent_replay,
        ...(result.tracking_url ? { tracking_url: result.tracking_url } : {}),
      },
      result.idempotent_replay ? 200 : 201,
    );
  } catch (error) {
    if (error instanceof ReportError) {
      return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404 | 409 | 413 | 415 | 500 | 503);
    }

    console.error("Failed to submit incident report:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}

export async function listReportsController(c: Context<AppEnv>) {
  const rawQuery = {
    status_id: c.req.query("status_id") || undefined,
    is_emergency: c.req.query("is_emergency") || undefined,
    incident_category: c.req.query("incident_category") || undefined,
  };

  const validation = listReportsQuerySchema.safeParse(rawQuery);

  if (!validation.success) {
    return c.json(
      {
        error: "Invalid query parameters.",
        details: validation.error.flatten().fieldErrors,
      },
      400,
    );
  }

  try {
    const reports = await getIncidentReports(
      c.env.geofix167_db,
      validation.data,
      c.get("user"),
    );

    const photosByReport = new Map<string, { id: string; filename: string; by_staff: boolean; content_type: string; created_at: string }[]>();
    for (let offset = 0; offset < reports.length; offset += 50) {
      const batch = reports.slice(offset, offset + 50);
      if (!batch.length) continue;
      const placeholders = batch.map(() => "?").join(",");
      const photos = await c.env.geofix167_db.prepare(`SELECT incident_id, incident_media_id AS id, original_filename, uploaded_by_user_id, content_type, created_at
        FROM incident_media WHERE media_type = 'PHOTO' AND incident_id IN (${placeholders})
        ORDER BY created_at, incident_media_id`).bind(...batch.map((report) => report.incident_id))
        .all<{ incident_id: string; id: string; original_filename: string | null; uploaded_by_user_id: string | null; content_type: string; created_at: string }>();
      for (const photo of photos.results ?? []) {
        const list = photosByReport.get(photo.incident_id) ?? [];
        const fname = String(photo.original_filename || "evidence.jpg");
        const isStaffProof = /^(fire|police|tanod)-/i.test(fname);
        list.push({
          id: photo.id,
          filename: fname,
          by_staff: isStaffProof,
          content_type: photo.content_type,
          created_at: photo.created_at,
        });
        photosByReport.set(photo.incident_id, list);
      }
    }
    const [unitsByIncident, eventRows] = await Promise.all([
      getDispatchedUnitsForIncidents(
        c.env.geofix167_db,
        reports.map((r) => r.incident_id),
      ),
      c.env.geofix167_db.prepare(`
        SELECT incident_id, incident_status_event_id AS id, coalesce(note, '') AS note, created_at,
          s.display_name AS status, e.changed_by_user_id AS actor
        FROM incident_status_events e JOIN incident_statuses s ON s.incident_status_id = e.to_incident_status_id
        WHERE ? = 'admin' OR note LIKE '[AGENCY REPORT]%' OR note LIKE '[BDRRMO VERIFIED]%' OR note LIKE '[BDRRMO NOTE]%'
        ORDER BY created_at DESC
      `).bind(c.get("user")?.role ?? "").all<{ incident_id: string; id: string; note: string; created_at: string; status: string; actor: string | null }>(),
    ]);

    const historyByIncident = new Map<string, typeof eventRows.results>();
    const agencyByIncident = new Map<string, Array<{ id: string; note: string; created_at: string }>>();
    const verifiedByIncident = new Map<string, string>();
    for (const ev of eventRows.results ?? []) {
      if (c.get("user")?.role === "admin") {
        const history = historyByIncident.get(ev.incident_id) ?? [];
        history.push(ev);
        historyByIncident.set(ev.incident_id, history);
      }
      if (ev.note.startsWith("[AGENCY REPORT]")) {
        const list = agencyByIncident.get(ev.incident_id) ?? [];
        list.push({ id: ev.id, note: ev.note, created_at: ev.created_at });
        agencyByIncident.set(ev.incident_id, list);
      } else if (ev.note.startsWith("[BDRRMO VERIFIED]") && !verifiedByIncident.has(ev.incident_id)) {
        verifiedByIncident.set(ev.incident_id, ev.note.replace("[BDRRMO VERIFIED] ", ""));
      }
    }

    const reportsWithPhotos = reports
      .map((report) => {
        const list = photosByReport.get(report.incident_id) ?? [];
        const firstPhoto = list[0];
        const verifiedNote = verifiedByIncident.get(report.incident_id) ?? null;
        return {
          ...report,
          ...(c.get("user")?.role === "admin" ? { history: historyByIncident.get(report.incident_id) ?? [] } : {}),
          photos: list,
          photo_count: list.length,
          photo_url: firstPhoto
            ? `/api/reports/${encodeURIComponent(report.incident_id)}/photos/${encodeURIComponent(firstPhoto.id)}`
            : null,
          dispatched_units: unitsByIncident.get(report.incident_id) ?? [],
          agency_reports: agencyByIncident.get(report.incident_id) ?? [],
          bdrrmo_verified: Boolean(verifiedNote),
          bdrrmo_verification_note: verifiedNote,
        };
      });

    return c.json({
      reports: reportsWithPhotos,
      count: reportsWithPhotos.length,
    });
  } catch (error) {
    if (error instanceof ReportError) return c.json({ error: error.message }, error.status as 401 | 403 | 404);
    console.error("Failed to list incident reports:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}

export async function getReportByIdController(c: Context<AppEnv>) {
  const id = c.req.param("id");

  if (!id || !id.trim()) {
    return c.json({ error: "Incident report ID is required." }, 400);
  }

  try {
    const db = c.env.geofix167_db;
    const report = await getIncidentReportDetails(db, id, c.get("user"), c.req.header("X-Guest-Token"));

    const [photoRows, maintRow, unitsByIncident] = await Promise.all([
      db.prepare(`
        SELECT incident_media_id AS id
        FROM incident_media
        WHERE incident_id = ? AND media_type = 'PHOTO'
        ORDER BY created_at, incident_media_id
      `).bind(report.incident_id).all<{ id: string }>().catch(() => ({ results: [] })),
      db.prepare(`
        SELECT ta.tanod_assignment_id, ta.assignment_status_id, ta.assigned_at, ta.completed_at, ta.notes,
          COALESCE(rr.display_name, NULLIF(trim(u.first_name || ' ' || u.last_name), ''), 'Assigned Tanod') AS tanod_name
        FROM tanod_assignments ta
        LEFT JOIN responder_resources rr ON rr.responder_resource_id = ta.responder_resource_id
        LEFT JOIN users u ON u.user_id = ta.tanod_user_id
        WHERE ta.incident_id = ?
        ORDER BY ta.assigned_at DESC
        LIMIT 1
      `).bind(report.incident_id).first<Record<string, unknown>>().catch(() => null),
      getDispatchedUnitsForIncidents(db, [report.incident_id]),
    ]);

    const allPhotoIds = (photoRows.results ?? []).map((p) => p.id);
    const meta = maintRow ? parseMaintenanceMeta(String(maintRow.notes || "")) : null;
    const reporterPhotoIds = meta
      ? allPhotoIds.filter((pid) => !meta.inspection_photo_ids.includes(pid) && !meta.repair_photo_ids.includes(pid))
      : allPhotoIds;
    const firstPhotoId = reporterPhotoIds[0] || allPhotoIds[0] || null;
    const photoUrl = firstPhotoId
      ? `/api/reports/${encodeURIComponent(report.incident_id)}/photos/${encodeURIComponent(firstPhotoId)}`
      : null;

    const isVerifiedFixed = Number(report.incident_status_id) === 10 || (maintRow && Number(maintRow.assignment_status_id) === 5 && meta?.repair_done);
    const maintenanceProgress = meta
      ? {
          assignment_id: String(maintRow?.tanod_assignment_id || ""),
          assigned_tanod: String(maintRow?.tanod_name || report.assigned_team || "Assigned Tanod"),
          urgency: meta.urgency,
          deadline: meta.deadline,
          admin_notes: meta.admin_notes,
          inspection_done: meta.inspection_done,
          inspection_at: meta.inspection_at || null,
          inspection_note: meta.inspection_note,
          inspection_photo_urls: meta.inspection_photo_ids.map(
            (pid) => `/api/reports/${encodeURIComponent(report.incident_id)}/photos/${encodeURIComponent(pid)}`,
          ),
          admin_check_approved: Boolean(meta.admin_check_approved),
          repair_done: meta.repair_done,
          repair_at: meta.repair_at || null,
          repair_note: meta.repair_note,
          repair_photo_urls: meta.repair_photo_ids.map(
            (pid) => `/api/reports/${encodeURIComponent(report.incident_id)}/photos/${encodeURIComponent(pid)}`,
          ),
          verified_fixed: Boolean(isVerifiedFixed),
          stage: isVerifiedFixed
            ? "Verified Fixed"
            : meta.repair_done
              ? "Awaiting Verification"
              : meta.inspection_done
                ? "Area Inspected"
                : "Assigned to Tanod",
        }
      : null;

    return c.json({
      report: {
        ...report,
        photo_url: photoUrl,
        maintenance_progress: maintenanceProgress,
        dispatched_units: unitsByIncident.get(report.incident_id) ?? [],
      },
    });
  } catch (error) {
    if (error instanceof ReportError) {
      return c.json({ error: error.message }, error.status as 404 | 400 | 500);
    }

    console.error("Failed to fetch incident report details:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}


export async function updateReportStatusController(c: Context<AppEnv>) {
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident report ID is required." }, 400);
  const validation = updateReportStatusSchema.safeParse(await c.req.json().catch(() => null));
  if (!validation.success) return c.json({ error: "Invalid status update.", details: validation.error.flatten() }, 400);
  try {
    const report = await updateReportStatus(c.env.geofix167_db, id, validation.data, c.get("user"));
    return c.json({ report });
  } catch (error) {
    if (error instanceof ReportError) return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404 | 409);
    console.error("Failed to update incident status:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}
export async function updateReportDetailsController(c: Context<AppEnv>) {
  const id = c.req.param("id")?.trim();
  if (!id) return c.json({ error: "Incident report ID is required." }, 400);
  const validation = updateReportDetailsSchema.safeParse(await c.req.json().catch(() => null));
  if (!validation.success) return c.json({ error: "Invalid details update.", details: validation.error.flatten() }, 400);
  try {
    const report = await updateReportDetails(c.env.geofix167_db, id, validation.data,
      c.get("user"), c.req.header("X-Guest-Token"));
    return c.json({ report });
  } catch (error) {
    if (error instanceof ReportError) return c.json({ error: error.message }, error.status as 400 | 401 | 403 | 404 | 409);
    console.error("Failed to update incident details:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}
