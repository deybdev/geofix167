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
    );

    return c.json(
      {
        report: {
          ...result.report,
          status_events: result.status_events,
        },
        idempotent_replay: result.idempotent_replay,
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

    const photosByReport = new Map<string, { id: string; content_type: string; created_at: string }[]>();
    for (let offset = 0; offset < reports.length; offset += 50) {
      const batch = reports.slice(offset, offset + 50);
      if (!batch.length) continue;
      const placeholders = batch.map(() => "?").join(",");
      const photos = await c.env.geofix167_db.prepare(`SELECT incident_id, incident_media_id AS id, content_type, created_at
        FROM incident_media WHERE media_type = 'PHOTO' AND incident_id IN (${placeholders})
        ORDER BY created_at, incident_media_id`).bind(...batch.map((report) => report.incident_id))
        .all<{ incident_id: string; id: string; content_type: string; created_at: string }>();
      for (const photo of photos.results ?? []) {
        const list = photosByReport.get(photo.incident_id) ?? [];
        list.push({ id: photo.id, content_type: photo.content_type, created_at: photo.created_at });
        photosByReport.set(photo.incident_id, list);
      }
    }
    const reportsWithPhotos = reports.map((report) => ({
      ...report,
      photos: photosByReport.get(report.incident_id) ?? [],
      photo_count: photosByReport.get(report.incident_id)?.length ?? 0,
    }));

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
    const report = await getIncidentReportDetails(c.env.geofix167_db, id, c.get("user"), c.req.header("X-Guest-Token"));
    return c.json({ report });
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
