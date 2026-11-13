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
  const body = await c.req.json().catch(() => null);
  const validation = createReportSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      {
        error: "Invalid incident report payload.",
        details: validation.error.flatten().fieldErrors,
      },
      400,
    );
  }

  try {
    const result = await submitIncidentReport(
      c.env.geofix167_db,
      validation.data,
      c.get("user"),
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
      return c.json({ error: error.message }, error.status as 400 | 404 | 500);
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

    return c.json({
      reports,
      count: reports.length,
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
