import { Hono } from "hono";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AppEnv } from "../types/env";
import { resolveLegacyReportAddresses } from "../services/report.service";

const route = new Hono<AppEnv>();
route.use("*", requireAuth, requireRole("admin"));

route.get("/intake", async (c) => {
  const db = c.env.geofix167_db;
  try {
    await resolveLegacyReportAddresses(db);
    const result = await db.prepare(`
      SELECT r.incident_id, COALESCE(printf('GF-%03d', rr.reference_sequence), r.incident_id) AS report_id,
        r.title, r.category, r.description_original AS description,
        r.latitude, r.longitude, r.accuracy_meters,
        r.within_barangay_boundary, r.pin_manually_adjusted, r.submitted_at,
        CASE
          WHEN r.location_description = printf('%.5f, %.5f', r.latitude, r.longitude)
            THEN CASE WHEN r.within_barangay_boundary = 0 THEN 'Pinned outside Barangay 167'
              WHEN r.within_barangay_boundary = 1 THEN 'Pinned location, Barangay 167'
              ELSE 'Pinned on map' END
          ELSE r.location_description
        END AS location,
        COALESCE(NULLIF(trim(gs.display_name), ''), 'Guest') AS reporter_name
      FROM incident_reports r
      JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
      LEFT JOIN incident_report_references rr ON rr.incident_id = r.incident_id
      WHERE r.is_emergency = 0 AND r.incident_status_id = 1
      ORDER BY r.submitted_at DESC
    `).all();
    return c.json({ reports: result.results ?? [] });
  } catch (error) {
    console.error("Unable to load guest maintenance intake:", error);
    return c.json({ error: "Maintenance intake could not be loaded." }, 500);
  }
});

export default route;
