import type { AppEnv } from "../types/env";
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
  location_description: string | null;
  submitted_at: string;
  updated_at: string;
};
export type IncidentReportRecord = Omit<InsertIncidentReportParams, "category" | "priority_code"> & {
  category: string | null;
  priority_code: PriorityCode | null;
  reference_number: string;
  reporter_user_id: string | null;
  status_id: number;
  incident_category: string | null;
  priority_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  sanitized_description: string | null;
  landmark_description: string | null;
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
  r.incident_id, r.incident_id AS reference_number,
  r.reported_by_user_id, r.guest_session_id, r.incident_status_id,
  r.category, r.priority_code, r.is_emergency, r.title,
  r.description_original, r.description_sanitized,
  r.callback_mobile_number, r.latitude, r.longitude,
  r.location_description, r.submitted_at, r.updated_at, r.closed_at,
  r.closed_by_user_id, r.parent_incident_id,
  r.reported_by_user_id AS reporter_user_id,
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
  r.location_description AS landmark_description,
  r.submitted_at AS received_at,
  s.code AS status_code, s.display_name AS status_label, s.is_terminal`;

export async function createIncidentReportBundle(db: Database, params: {
  report: InsertIncidentReportParams;
  statusEvent: IncidentStatusEventRecord;
  languageFlags: LanguageFlagRecord[];
  guestSession: InsertGuestSessionParams | null;
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
    location_description, submitted_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    r.incident_id, r.reported_by_user_id, r.guest_session_id, r.incident_status_id,
    r.category, r.priority_code, r.is_emergency, r.title, r.description_original,
    r.description_sanitized, r.callback_mobile_number, r.latitude, r.longitude,
    r.location_description, r.submitted_at, r.updated_at));
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
  await db.batch(statements);
}

export async function listIncidentReports(db: Database, filters: ListReportsQuery, ownerId?: string): Promise<IncidentReportRecord[]> {
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  if (ownerId !== undefined) {
    conditions.push("r.reported_by_user_id = ?"); values.push(ownerId);
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
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY r.is_emergency DESC, r.submitted_at DESC`).bind(...values).all<IncidentReportRecord>();
  return result.results ?? [];
}

export async function findIncidentReportById(db: Database, id: string): Promise<IncidentReportRecord | null> {
  return db.prepare(`SELECT ${PUBLIC_REPORT_COLUMNS} FROM incident_reports r
    JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
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
