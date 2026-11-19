import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { sourceThrottle } from "../services/registration-security";

const route = new Hono<AppEnv>();
const expiredMessage = "This incident has been resolved. This tracking link has expired.";
const invalidMessage = "This tracking link is invalid or no longer available.";

type TrackingRecord = {
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  status_code: string;
  status_label: string;
  incident_latitude: number | null;
  incident_longitude: number | null;
  submitted_at: string;
  closed_at: string | null;
};

function sha256Hex(value: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""));
}

function constantTimeEqual(left: string, right: string): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function expireReportTracking(db: AppEnv["Bindings"]["geofix167_db"], reportId: string) {
  await db.batch([
    db.prepare(`UPDATE tracking_links SET expires_at = datetime('now'), revoked_at = COALESCE(revoked_at, datetime('now'))
      WHERE report_id = ?`).bind(reportId),
    db.prepare(`DELETE FROM responder_locations WHERE assignment_id IN (
      SELECT tanod_assignment_id FROM tanod_assignments WHERE incident_id = ?
      UNION SELECT responder_dispatch_id FROM responder_dispatches WHERE incident_id = ?
    )`).bind(reportId, reportId),
  ]);
}

function distanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

route.get("/:token/status", async (c) => {
  c.header("Cache-Control", "no-store, private");
  c.header("Pragma", "no-cache");
  await sourceThrottle(c, "public-tracking-status", 120);

  const token = c.req.param("token");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return c.json({ error: invalidMessage }, 404);
  }

  const db = c.env.geofix167_db;
  const tokenHash = await sha256Hex(token);
  const link = await db.prepare(`SELECT t.token_hash, t.expires_at, t.revoked_at,
      s.code AS status_code, s.display_name AS status_label,
      r.latitude AS incident_latitude, r.longitude AS incident_longitude,
      r.submitted_at, r.closed_at
    FROM tracking_links t
    JOIN incident_reports r ON r.incident_id = t.report_id
    JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
    WHERE t.token_hash = ? LIMIT 1`)
    .bind(tokenHash).first<TrackingRecord>();

  if (!link || !constantTimeEqual(link.token_hash, tokenHash)) {
    return c.json({ error: invalidMessage }, 404);
  }

  const terminal = link.status_code === "CLOSED" || link.status_code === "REJECTED";
  const expired = !Number.isFinite(Date.parse(link.expires_at)) || Date.parse(link.expires_at) <= Date.now();
  if (link.revoked_at || terminal || expired) {
    await expireReportTracking(db, (await db.prepare("SELECT report_id FROM tracking_links WHERE token_hash = ?")
      .bind(tokenHash).first<{ report_id: string }>())?.report_id ?? "");
    return c.json({ expired: true, message: expiredMessage }, 410);
  }

  await db.prepare("UPDATE tracking_links SET last_viewed_at = datetime('now') WHERE token_hash = ?")
    .bind(tokenHash).run();

  const reportId = (await db.prepare("SELECT report_id FROM tracking_links WHERE token_hash = ?")
    .bind(tokenHash).first<{ report_id: string }>())?.report_id;
  if (!reportId) return c.json({ error: invalidMessage }, 404);

  const incidentEvents = await db.prepare(`SELECT s.code, e.created_at
    FROM incident_status_events e JOIN incident_statuses s ON s.incident_status_id = e.to_incident_status_id
    WHERE e.incident_id = ? ORDER BY e.created_at ASC`).bind(reportId)
    .all<{ code: string; created_at: string }>();
  const assignment = await db.prepare(`SELECT ta.tanod_assignment_id AS assignment_id,
      ta.tanod_user_id AS responder_id, u.first_name, rr.display_name AS unit_name,
      ast.code AS assignment_status, ta.assigned_at, ta.accepted_at, ta.completed_at
    FROM tanod_assignments ta
    JOIN assignment_statuses ast ON ast.assignment_status_id = ta.assignment_status_id
    LEFT JOIN users u ON u.user_id = ta.tanod_user_id
    LEFT JOIN responder_resources rr ON rr.responder_resource_id = ta.responder_resource_id
    WHERE ta.incident_id = ? ORDER BY ta.assigned_at DESC LIMIT 1`).bind(reportId)
    .first<{
      assignment_id: string; responder_id: string; first_name: string | null; unit_name: string | null;
      assignment_status: string; assigned_at: string; accepted_at: string | null; completed_at: string | null;
    }>();
  const dispatch = assignment ? null : await db.prepare(`SELECT rd.responder_dispatch_id AS assignment_id,
      rd.target_role, rd.vehicle_name, rd.status, rd.dispatched_at,
      u.first_name AS live_first_name, loc.responder_id, loc.lat, loc.lng, loc.accuracy, loc.heading, loc.updated_at
    FROM responder_dispatches rd
    LEFT JOIN responder_locations loc ON loc.assignment_id = rd.responder_dispatch_id
    LEFT JOIN users u ON u.user_id = loc.responder_id
    WHERE rd.incident_id = ? ORDER BY rd.dispatched_at DESC LIMIT 1`).bind(reportId)
    .first<{
      assignment_id: string; target_role: string; vehicle_name: string | null; status: string;
      dispatched_at: string; live_first_name: string | null; responder_id: string | null;
      lat: number | null; lng: number | null; accuracy: number | null; heading: number | null; updated_at: string | null;
    }>();

  const assignmentEvents = assignment ? await db.prepare(`SELECT ast.code, e.created_at
    FROM tanod_assignment_events e JOIN assignment_statuses ast ON ast.assignment_status_id = e.assignment_status_id
    WHERE e.tanod_assignment_id = ? ORDER BY e.created_at ASC`).bind(assignment.assignment_id)
    .all<{ code: string; created_at: string }>() : { results: [] };

  let responderLocation: { lat: number; lng: number; accuracy: number | null; heading: number | null; updated_at: string } | null = null;
  let responder: { first_name: string; unit_name: string } | null = null;
  let assignmentStatus = "";
  let assignedAt: string | null = null;
  let acceptedAt: string | null = null;
  let completedAt: string | null = null;
  if (assignment) {
    assignmentStatus = assignment.assignment_status;
    assignedAt = assignment.assigned_at;
    acceptedAt = assignment.accepted_at;
    completedAt = assignment.completed_at;
    responder = {
      first_name: (assignment.first_name ?? "Responder").split(/\s+/).at(0) ?? "Responder",
      unit_name: assignment.unit_name || "Barangay response unit",
    };
    const location = await db.prepare(`SELECT lat, lng, accuracy, heading, updated_at
      FROM responder_locations WHERE assignment_id = ? AND responder_id = ? LIMIT 1`)
      .bind(assignment.assignment_id, assignment.responder_id).first<{
        lat: number; lng: number; accuracy: number | null; heading: number | null; updated_at: string;
      }>();
    if (location) responderLocation = location;
  } else if (dispatch) {
    assignmentStatus = dispatch.status;
    assignedAt = dispatch.dispatched_at;
    if (dispatch.live_first_name) {
      responder = { first_name: dispatch.live_first_name.split(/\s+/).at(0) ?? "Responder", unit_name: dispatch.vehicle_name || dispatch.target_role.toUpperCase() };
    }
    if (dispatch.lat != null && dispatch.lng != null && dispatch.updated_at) {
      responderLocation = {
        lat: dispatch.lat, lng: dispatch.lng, accuracy: dispatch.accuracy,
        heading: dispatch.heading, updated_at: dispatch.updated_at,
      };
    }
  }

  const eventRows = incidentEvents.results ?? [];
  const assignmentRows = assignmentEvents.results ?? [];
  const firstAt = (codes: string[]) => eventRows.find((event) => codes.includes(event.code))?.created_at ?? null;
  const assignmentAt = (codes: string[]) => assignmentRows.find((event) => codes.includes(event.code))?.created_at ?? null;
  const eventTimeline = [
    { label: "Report received", at: link.submitted_at },
    { label: "Verified / Forwarded to BDRRMO", at: firstAt(["VERIFIED", "FORWARDED_TO_BDRRMO"]) },
    { label: "Responder assigned", at: assignedAt ?? firstAt(["DISPATCHED", "ASSIGNED"]) },
    { label: "Accepted", at: acceptedAt ?? assignmentAt(["ACCEPTED"]) ?? firstAt(["ASSIGNED"]) },
    { label: "En route", at: assignmentAt(["EN_ROUTE"]) ?? firstAt(["EN_ROUTE"]) },
    { label: "On scene", at: assignmentAt(["ON_SCENE"]) ?? firstAt(["ON_SCENE"]) },
    { label: "Completed", at: link.closed_at ?? completedAt ?? firstAt(["CLOSED"]) },
  ];
  const activeLocationStatus = ["ACCEPTED", "EN_ROUTE", "ON_SCENE"].includes(assignmentStatus);
  const publicLocation = activeLocationStatus ? responderLocation : null;
  const incidentLocation = link.incident_latitude != null && link.incident_longitude != null
    ? { lat: link.incident_latitude, lng: link.incident_longitude }
    : null;
  const etaMinutes = publicLocation && incidentLocation
    ? Math.max(1, Math.ceil(distanceKm(publicLocation, incidentLocation) / 25 * 60))
    : null;
  const statusLabel = assignmentStatus === "ACCEPTED" || assignmentStatus === "EN_ROUTE" || assignmentStatus === "ON_SCENE"
    ? ({ ACCEPTED: "Accepted", EN_ROUTE: "En Route", ON_SCENE: "On Scene" } as const)[assignmentStatus]
    : assignmentStatus === "OFFERED" || assignmentStatus === "DISPATCHED"
      ? "Responder assigned"
      : link.status_code === "SUBMITTED" || link.status_code === "UNDER_REVIEW"
        ? "Awaiting review"
        : link.status_label;

  return c.json({
    status_label: statusLabel,
    timeline: eventTimeline,
    responder: ["OFFERED", "DISPATCHED", "ACCEPTED", "EN_ROUTE", "ON_SCENE"].includes(assignmentStatus) ? responder : null,
    responder_location: publicLocation,
    incident_location: incidentLocation,
    eta_minutes: etaMinutes,
  });
});

export default route;
