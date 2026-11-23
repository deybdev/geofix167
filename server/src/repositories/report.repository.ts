import type { AppEnv } from "../types/env";
import type { GuestPhotoInsert } from "../services/attachment.service";
import type { ListReportsQuery } from "../validators/report.schema";

type Database = AppEnv["Bindings"]["geofix167_db"];
export type PriorityCode = "P1" | "P2" | "P3" | "P4";
export type InsertIncidentReportParams = {
  incident_id: string;
  reported_by_user_id: string | null;
  guest_session_id: string | null;
  incident_status_id: number;
  category: string;
  priority_code: PriorityCode;
  is_emergency: 0 | 1;
  title: string;
  description_original: string;
  description_sanitized: string | null;
  callback_mobile_number: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  within_barangay_boundary: 0 | 1 | null;
  pin_manually_adjusted: 0 | 1;
  address_geocoded_at: string | null;
  location_description: string | null;
  assigned_team: string;
  submitted_at: string;
  updated_at: string;
};
export type IncidentReportRecord = Omit<InsertIncidentReportParams, "category" | "priority_code"> & {
  category: string | null;
  priority_code: PriorityCode | null;
  reference_number: string;
  reporter_name: string;
  reporter_type: "GUEST" | "RESIDENT";
  classification: "sudden" | "maintenance";
  reporter_user_id: string | null;
  status_id: number;
  incident_category: string | null;
  priority_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  sanitized_description: string | null;
  landmark_description: string | null;
  accuracy_meters: number | null;
  within_barangay_boundary: 0 | 1 | null;
  assigned_team: string | null;
  received_at: string;
  closed_at: string | null;
  closed_by_user_id: string | null;
  parent_incident_id: string | null;
  status_code: string;
  status_label: string;
  is_terminal: number;
};
export type IncidentStatusEventRecord = {
  incident_status_event_id: string;
  incident_id: string;
  from_incident_status_id: number | null;
  to_incident_status_id: number;
  changed_by_user_id: string | null;
  note: string | null;
  created_at: string;
};
export type LanguageFlagRecord = {
  language_flag_id: string;
  incident_id: string;
  detected_term_hash: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: "OPEN" | "CONFIRMED" | "DISMISSED";
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};
export type InsertGuestSessionParams = {
  guest_session_id: string;
  display_name: string;
  access_token_hash: string;
  created_at: string;
};
const PUBLIC_REPORT_COLUMNS = `
  r.incident_id,
  COALESCE(printf('GF-%03d', rr.reference_sequence), r.incident_id) AS reference_number,
  r.reported_by_user_id, r.guest_session_id, r.incident_status_id,
  r.category, r.priority_code, r.is_emergency, r.title,
  r.description_original, r.description_sanitized,
  r.callback_mobile_number, r.latitude, r.longitude,
  r.accuracy_meters, r.within_barangay_boundary, r.pin_manually_adjusted,
  r.address_geocoded_at, r.assigned_team,
  CASE
    WHEN r.location_description = printf('%.5f, %.5f', r.latitude, r.longitude)
      THEN CASE WHEN r.within_barangay_boundary = 0 THEN 'Pinned outside Barangay 167'
        WHEN r.within_barangay_boundary = 1 THEN 'Pinned location, Barangay 167'
        ELSE 'Pinned on map' END
    ELSE r.location_description
  END AS location_description,
  (SELECT min(e.created_at) FROM incident_status_events e WHERE e.incident_id = r.incident_id AND e.to_incident_status_id = 5) AS forwarded_at,
  r.submitted_at, r.updated_at, r.closed_at,
  r.closed_by_user_id, r.parent_incident_id,
  r.reported_by_user_id AS reporter_user_id,
  CASE WHEN r.guest_session_id IS NOT NULL THEN 'GUEST' ELSE 'RESIDENT' END AS reporter_type,
  CASE WHEN r.is_emergency = 1 THEN 'sudden' ELSE 'maintenance' END AS classification,
  CASE WHEN r.guest_session_id IS NOT NULL THEN COALESCE(gs.display_name, 'Guest')
       ELSE COALESCE(NULLIF(trim(u.first_name || ' ' || u.last_name), ''), 'Resident')
  END AS reporter_name,
  r.incident_status_id AS status_id,
  r.category AS incident_category,
  CASE r.priority_code
    WHEN 'P1' THEN 'CRITICAL'
    WHEN 'P2' THEN 'HIGH'
    WHEN 'P3' THEN 'MEDIUM'
    WHEN 'P4' THEN 'LOW'
    ELSE NULL
  END AS priority_level,
  r.description_sanitized AS sanitized_description,
  CASE
    WHEN r.location_description = printf('%.5f, %.5f', r.latitude, r.longitude)
      THEN CASE WHEN r.within_barangay_boundary = 0 THEN 'Pinned outside Barangay 167'
        WHEN r.within_barangay_boundary = 1 THEN 'Pinned location, Barangay 167'
        ELSE 'Pinned on map' END
    ELSE r.location_description
  END AS landmark_description,
  r.submitted_at AS received_at,
  s.code AS status_code, s.display_name AS status_label, s.is_terminal`;

export async function createIncidentReportBundle(db: Database, params: {
  report: InsertIncidentReportParams;
  statusEvent: IncidentStatusEventRecord;
  languageFlags: LanguageFlagRecord[];
  guestSession: InsertGuestSessionParams | null;
  guestPhotos?: GuestPhotoInsert[];
  trackingLink?: { id: string; report_id: string; token_hash: string; created_at: string; expires_at: string };
  creationAudit?: { id: string; key: string };
}): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  if (params.guestSession) {
    const g = params.guestSession;
    statements.push(db.prepare(`INSERT INTO guest_sessions
      (guest_session_id, display_name, access_token_hash, created_at)
      VALUES (?, ?, ?, ?)`).bind(g.guest_session_id, g.display_name, g.access_token_hash, g.created_at));
  }
  const r = params.report;
  statements.push(db.prepare(`INSERT INTO incident_reports (
    incident_id, reported_by_user_id, guest_session_id, incident_status_id,
    category, priority_code, is_emergency, title, description_original,
    description_sanitized, callback_mobile_number, latitude, longitude,
    accuracy_meters, within_barangay_boundary, pin_manually_adjusted, address_geocoded_at,
    location_description, assigned_team, submitted_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    r.incident_id, r.reported_by_user_id, r.guest_session_id, r.incident_status_id,
    r.category, r.priority_code, r.is_emergency, r.title, r.description_original,
    r.description_sanitized, r.callback_mobile_number, r.latitude, r.longitude,
    r.accuracy_meters, r.within_barangay_boundary, r.pin_manually_adjusted,
    r.address_geocoded_at, r.location_description, r.assigned_team, r.submitted_at, r.updated_at));
  for (const photo of params.guestPhotos ?? []) {
    statements.push(db.prepare(`INSERT INTO incident_media (
      incident_media_id, incident_id, uploaded_by_guest_session_id, media_type, storage_key,
      content_type, byte_size, original_filename, upload_key, content_sha256, media_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(photo.incident_media_id, photo.incident_id, photo.uploaded_by_guest_session_id,
        photo.media_type, photo.storage_key, photo.content_type, photo.byte_size,
        photo.original_filename, photo.upload_key, photo.content_sha256, photo.media_url, photo.created_at));
  }
  statements.push(db.prepare("INSERT INTO incident_report_references (incident_id) VALUES (?)")
    .bind(r.incident_id));
  if (params.trackingLink) {
    const link = params.trackingLink;
    statements.push(db.prepare(`INSERT INTO tracking_links
      (tracking_link_id, report_id, token_hash, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?)`)
      .bind(link.id, link.report_id, link.token_hash, link.created_at, link.expires_at));
  }
  const e = params.statusEvent;
  statements.push(db.prepare(`INSERT INTO incident_status_events (
    incident_status_event_id, incident_id, from_incident_status_id,
    to_incident_status_id, changed_by_user_id, note, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(e.incident_status_event_id, e.incident_id,
    e.from_incident_status_id, e.to_incident_status_id, e.changed_by_user_id, e.note, e.created_at));
  for (const f of params.languageFlags) {
    statements.push(db.prepare(`INSERT INTO language_flags
      (language_flag_id, incident_id, detected_term_hash, severity, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(f.language_flag_id, f.incident_id,
        f.detected_term_hash, f.severity, f.status, f.created_at));
  }
  if (params.creationAudit) statements.push(db.prepare(
    "INSERT INTO audit_logs (audit_log_id, actor_user_id, action, entity_type, entity_id, incident_id, metadata_json) VALUES (?, ?, 'REPORT_CREATED', 'INCIDENT_REPORT', ?, ?, ?)"
  ).bind(params.creationAudit.id, r.reported_by_user_id, params.creationAudit.key, r.incident_id,
    JSON.stringify({ guest_session_id: r.guest_session_id })));
  await db.batch(statements);
}

export async function listIncidentReports(db: Database, filters: ListReportsQuery, ownerId?: string, includeAssignments = false): Promise<IncidentReportRecord[]> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  if (ownerId !== undefined) {
    conditions.push(includeAssignments ? `(r.reported_by_user_id = ? OR EXISTS (
      SELECT 1 FROM tanod_assignments a JOIN assignment_statuses ast ON ast.assignment_status_id = a.assignment_status_id
      WHERE a.incident_id = r.incident_id AND a.tanod_user_id = ? AND a.completed_at IS NULL
      AND ast.code IN ('OFFERED','ACCEPTED','EN_ROUTE','ON_SCENE')))` : "r.reported_by_user_id = ?");
    values.push(ownerId);
    if (includeAssignments) values.push(ownerId);
  }
  if (filters.status_id !== undefined) {
    conditions.push("r.incident_status_id = ?"); values.push(filters.status_id);
  }
  if (filters.is_emergency !== undefined) {
    conditions.push("r.is_emergency = ?"); values.push(filters.is_emergency);
  }
  if (filters.incident_category !== undefined) {
    conditions.push("r.category = ?"); values.push(filters.incident_category);
  }
  const result = await db.prepare(`SELECT ${PUBLIC_REPORT_COLUMNS}
    FROM incident_reports r JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
    LEFT JOIN users u ON u.user_id = r.reported_by_user_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    LEFT JOIN incident_report_references rr ON rr.incident_id = r.incident_id
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY r.is_emergency DESC, r.submitted_at DESC`).bind(...values).all<IncidentReportRecord>();
  return result.results ?? [];
}

export async function findIncidentReportById(db: Database, id: string): Promise<IncidentReportRecord | null> {
  return db.prepare(`SELECT ${PUBLIC_REPORT_COLUMNS} FROM incident_reports r
    JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
    LEFT JOIN users u ON u.user_id = r.reported_by_user_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    LEFT JOIN incident_report_references rr ON rr.incident_id = r.incident_id
    WHERE r.incident_id = ? LIMIT 1`).bind(id).first<IncidentReportRecord>();
}
export async function findStatusEventsByIncidentId(db: Database, id: string): Promise<IncidentStatusEventRecord[]> {
  const result = await db.prepare(`SELECT incident_status_event_id, incident_id,
    from_incident_status_id, to_incident_status_id, changed_by_user_id, note, created_at
    FROM incident_status_events WHERE incident_id = ? ORDER BY created_at ASC`)
    .bind(id).all<IncidentStatusEventRecord>();
  return result.results ?? [];
}
export async function findLanguageFlagsByIncidentId(db: Database, id: string): Promise<LanguageFlagRecord[]> {
  const result = await db.prepare(`SELECT language_flag_id, incident_id, detected_term_hash,
    severity, status, reviewed_by_user_id, reviewed_at, created_at
    FROM language_flags WHERE incident_id = ? ORDER BY created_at ASC`)
    .bind(id).all<LanguageFlagRecord>();
  return result.results ?? [];
}

export async function findIncidentStatus(db: Database, id: number) {
  return db.prepare("SELECT incident_status_id, is_terminal FROM incident_statuses WHERE incident_status_id = ?")
    .bind(id).first<{ incident_status_id: number; is_terminal: number }>();
}
export async function hasActiveReportAssignment(db: Database, id: string, userId: string) {
  return Boolean(await db.prepare(`SELECT a.tanod_assignment_id FROM tanod_assignments a
    JOIN assignment_statuses s ON s.assignment_status_id = a.assignment_status_id
    WHERE a.incident_id = ? AND a.tanod_user_id = ? AND a.completed_at IS NULL
      AND s.code IN ('ACCEPTED', 'EN_ROUTE', 'ON_SCENE') LIMIT 1`).bind(id, userId).first());
}

export async function updateIncidentReportStatus(db: Database, id: string, fromStatus: number,
  toStatus: number, terminal: boolean, actorId: string, note?: string): Promise<boolean> {
  const eventId = crypto.randomUUID();
  const statements = [
    db.prepare(`UPDATE incident_reports SET incident_status_id = ?, updated_at = datetime('now'),
      closed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END,
      closed_by_user_id = CASE WHEN ? = 1 THEN ? ELSE NULL END
      WHERE incident_id = ? AND incident_status_id = ?`).bind(
        toStatus, terminal ? 1 : 0, terminal ? 1 : 0, actorId, id, fromStatus),
    // changes() refers to the preceding UPDATE in this atomic batch. A stale
    // status produces neither an update nor a misleading audit event.
    db.prepare(`INSERT INTO incident_status_events (incident_status_event_id, incident_id,
      from_incident_status_id, to_incident_status_id, changed_by_user_id, note, created_at)
      SELECT ?, ?, ?, ?, ?, ?, datetime('now') WHERE changes() = 1`).bind(
        eventId, id, fromStatus, toStatus, actorId, note ?? null),
  ];
  if (terminal) {
    // Snapshot affected assignments. The unique status event gates all later writes.
    statements.push(db.prepare(`INSERT INTO tanod_assignment_events
      (tanod_assignment_event_id, tanod_assignment_id, assignment_status_id, changed_by_user_id, note, created_at)
      SELECT ? || ':' || tanod_assignment_id, tanod_assignment_id, 6, ?, 'Incident closed', datetime('now')
      FROM tanod_assignments WHERE incident_id = ? AND completed_at IS NULL AND assignment_status_id IN (1,2,4,5)
      AND EXISTS (SELECT 1 FROM incident_status_events WHERE incident_status_event_id = ?)`)
      .bind(eventId, actorId, id, eventId));
    statements.push(db.prepare(`UPDATE tanod_assignments SET assignment_status_id = 6, completed_at = datetime('now')
      WHERE tanod_assignment_id IN (SELECT tanod_assignment_id FROM tanod_assignment_events
      WHERE tanod_assignment_event_id = ? || ':' || tanod_assignment_id)`).bind(eventId));
    statements.push(db.prepare(`UPDATE responder_resources SET availability_status = 'AVAILABLE', updated_at = datetime('now')
      WHERE responder_resource_id IN (SELECT a.responder_resource_id FROM tanod_assignments a
        JOIN tanod_assignment_events e ON e.tanod_assignment_id = a.tanod_assignment_id
        WHERE e.tanod_assignment_event_id = ? || ':' || a.tanod_assignment_id)
      AND NOT EXISTS (SELECT 1 FROM tanod_assignments other WHERE other.responder_resource_id = responder_resources.responder_resource_id
        AND other.completed_at IS NULL AND other.assignment_status_id IN (1,2,4,5))`).bind(eventId));
  }
  const results = await db.batch(statements);
  return results[0]?.meta.changes === 1;
}

export async function updateIncidentReportDetails(db: Database, id: string,
  input: import("../validators/report.schema").UpdateReportDetailsInput, admin: boolean, actorId: string | null): Promise<boolean> {
  const columns = ["category", "priority_code", "location_description", "description_sanitized"] as const;
  const fields = columns.filter(key => input[key] !== undefined);
  if (fields.length === 0) return false;
  const updatedFields: Record<string, string> = Object.fromEntries(fields.map(key => [key, input[key]!]));
  if (input.category !== undefined) updatedFields.title = input.category.trim() + " Incident Report";
  const results = await db.batch([
    db.prepare(`UPDATE incident_reports SET
      ${Object.keys(updatedFields).map(key => key + ' = ?').join(', ')}, updated_at = datetime('now')
      WHERE incident_id = ? ${admin ? '' : 'AND closed_at IS NULL AND incident_status_id IN (1,2,3)'}`)
      .bind(...Object.values(updatedFields), id),
    db.prepare(`INSERT INTO audit_logs (audit_log_id, actor_user_id, action, entity_type, entity_id, incident_id, metadata_json)
      SELECT ?, ?, 'REPORT_DETAILS_UPDATED', 'INCIDENT_REPORT', ?, ?, ? WHERE changes() = 1`)
      .bind(crypto.randomUUID(), actorId, id, id, JSON.stringify(updatedFields)),
  ]);
  return results[0]?.meta.changes === 1;
}

export async function hasReportReadAssignment(db: Database, incidentId: string, userId: string, role?: string) {
  const tanodMatch = await db.prepare(`SELECT a.tanod_assignment_id FROM tanod_assignments a
    JOIN assignment_statuses s ON s.assignment_status_id = a.assignment_status_id
    WHERE a.incident_id = ? AND a.tanod_user_id = ?
    AND s.code IN ('OFFERED', 'ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'COMPLETED') LIMIT 1`).bind(incidentId, userId).first();
  if (tanodMatch) return true;
  if (role === "police" || role === "fire") {
    return Boolean(await db.prepare(`SELECT responder_dispatch_id FROM responder_dispatches
      WHERE incident_id = ? AND target_role = ?
      AND status IN ('DISPATCHED', 'ACCEPTED', 'EN_ROUTE', 'ON_SCENE', 'COMPLETED') LIMIT 1`).bind(incidentId, role).first());
  }
  return false;
}
export async function hasAnyReportAssignment(db: Database, incidentId: string) {
  return Boolean(await db.prepare(`SELECT tanod_assignment_id FROM tanod_assignments
    WHERE incident_id = ? AND completed_at IS NULL AND assignment_status_id IN (1,2,4,5) LIMIT 1`).bind(incidentId).first());
}
export async function verifyGuestSession(db: Database, id: string, tokenHash: string) {
  return Boolean(await db.prepare(`SELECT guest_session_id FROM guest_sessions WHERE guest_session_id = ?
    AND access_token_hash = ? AND ended_at IS NULL AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`).bind(id, tokenHash).first());
}
export async function findCreationReplay(db: Database, key: string, userId: string | null, guestId: string | null) {
  return db.prepare(`SELECT r.incident_id FROM audit_logs a JOIN incident_reports r ON r.incident_id = a.incident_id
    WHERE a.action = 'REPORT_CREATED' AND a.entity_type = 'INCIDENT_REPORT' AND a.entity_id = ?
      AND ((? IS NOT NULL AND r.reported_by_user_id = ?) OR (? IS NULL AND r.guest_session_id = ?)) LIMIT 1`)
    .bind(key, userId, userId, userId, guestId).first<{ incident_id: string }>();
}
