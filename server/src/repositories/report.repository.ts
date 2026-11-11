import type { AppEnv } from "../types/env";
import type { ListReportsQuery } from "../validators/report.schema";

type Database = AppEnv["Bindings"]["geofix167_db"];

export type IncidentReportRecord = {
  incident_id: string;
  reference_number: string;
  reporter_user_id: string | null;
  guest_session_id: string | null;
  master_incident_id: string | null;
  duplicate_linked_by_id: string | null;
  status_id: number;
  status_code?: string;
  status_label?: string;
  is_terminal?: number;
  current_review_owner_id: string | null;
  closed_by_user_id: string | null;
  idempotency_key: string;
  idempotency_fingerprint: string | null;
  reporter_type: "RESIDENT" | "GUEST";
  is_emergency: 0 | 1;
  incident_category: string;
  priority_level: string;
  sanitized_description: string | null;
  original_description_enc?: string | null;
  has_language_flag: 0 | 1;
  latitude: number | null;
  longitude: number | null;
  barangay_zone: string | null;
  within_barangay_boundary: number | null;
  reverse_geocoded_address: string | null;
  location_source: string | null;
  pin_manually_adjusted: number;
  landmark_description: string | null;
  call_fallback_used: number;
  recorded_offline_during_outage: number;
  received_at: string;
  reminder_30s_due_at: string | null;
  reminder_30s_sent_at: string | null;
  takeover_60s_due_at: string | null;
  escalated_60s_at: string | null;
  escalation_check_status_code: number;
  last_escalation_checked_at: string | null;
  verified_at: string | null;
  duplicate_linked_at: string | null;
  duplicate_link_reason: string | null;
  closed_at: string | null;
  guest_tracking_expires_at: string | null;
  closure_outcome: string | null;
  closure_remarks: string | null;
  updated_at: string;
  retention_until: string | null;
};

export type IncidentStatusEventRecord = {
  status_event_id: string;
  incident_id: string;
  from_status_id: number | null;
  from_status_code: string | null;
  from_status_label: string | null;
  to_status_id: number;
  to_status_code: string | null;
  to_status_label: string | null;
  actor_user_id: string | null;
  actor_guest_session_id: string | null;
  reason: string | null;
  occurred_at: string;
};

export type LanguageFlagRecord = {
  flag_id: string;
  incident_id: string;
  user_id: string | null;
  guest_session_id: string | null;
  matched_terms_summary: string | null;
  action_taken: string | null;
  strike_candidate: number;
  created_at: string;
};

export type InsertIncidentReportParams = {
  incident_id: string;
  reference_number: string;
  reporter_user_id: string | null;
  guest_session_id: string | null;
  status_id: number;
  idempotency_key: string;
  idempotency_fingerprint: string | null;
  reporter_type: "RESIDENT" | "GUEST";
  is_emergency: 0 | 1;
  incident_category: string;
  priority_level: string;
  sanitized_description: string | null;
  original_description_enc: string | null;
  has_language_flag: 0 | 1;
  latitude: number | null;
  longitude: number | null;
  barangay_zone: string | null;
  within_barangay_boundary: number | null;
  reverse_geocoded_address: string | null;
  location_source: string | null;
  pin_manually_adjusted: 0 | 1;
  landmark_description: string | null;
  call_fallback_used: 0 | 1;
  recorded_offline_during_outage: 0 | 1;
  received_at: string;
  reminder_30s_due_at: string | null;
  takeover_60s_due_at: string | null;
  escalation_check_status_code: number;
  updated_at: string;
};

export type InsertStatusEventParams = {
  status_event_id: string;
  incident_id: string;
  from_status_id: number | null;
  to_status_id: number;
  actor_user_id: string | null;
  actor_guest_session_id: string | null;
  reason: string | null;
  occurred_at: string;
};

export type InsertLanguageFlagParams = {
  flag_id: string;
  incident_id: string;
  user_id: string | null;
  guest_session_id: string | null;
  matched_terms_summary: string | null;
  action_taken: string;
  strike_candidate: number;
  created_at: string;
};

export type UpsertGuestSessionParams = {
  guest_session_id: string;
  guest_alias: string | null;
  callback_contact: string | null;
  last_report_submitted_at: string;
  created_at: string;
  updated_at: string;
};

const PUBLIC_REPORT_COLUMNS = `
  r.incident_id,
  r.reference_number,
  r.reporter_user_id,
  r.guest_session_id,
  r.master_incident_id,
  r.duplicate_linked_by_id,
  r.status_id,
  s.status_code,
  s.status_label,
  s.is_terminal,
  r.current_review_owner_id,
  r.closed_by_user_id,
  r.idempotency_key,
  r.idempotency_fingerprint,
  r.reporter_type,
  r.is_emergency,
  r.incident_category,
  r.priority_level,
  r.sanitized_description,
  r.has_language_flag,
  r.latitude,
  r.longitude,
  r.barangay_zone,
  r.within_barangay_boundary,
  r.reverse_geocoded_address,
  r.location_source,
  r.pin_manually_adjusted,
  r.landmark_description,
  r.call_fallback_used,
  r.recorded_offline_during_outage,
  r.received_at,
  r.reminder_30s_due_at,
  r.reminder_30s_sent_at,
  r.takeover_60s_due_at,
  r.escalated_60s_at,
  r.escalation_check_status_code,
  r.last_escalation_checked_at,
  r.verified_at,
  r.duplicate_linked_at,
  r.duplicate_link_reason,
  r.closed_at,
  r.guest_tracking_expires_at,
  r.closure_outcome,
  r.closure_remarks,
  r.updated_at,
  r.retention_until
`;

export async function findReportByIdempotencyKey(
  db: Database,
  idempotencyKey: string,
): Promise<IncidentReportRecord | null> {
  return db
    .prepare(
      `SELECT ${PUBLIC_REPORT_COLUMNS}
       FROM INCIDENT_REPORTS r
       LEFT JOIN INCIDENT_STATUSES s ON s.status_id = r.status_id
       WHERE r.idempotency_key = ?
       LIMIT 1`,
    )
    .bind(idempotencyKey)
    .first<IncidentReportRecord>();
}

export async function createIncidentReportBundle(
  db: Database,
  params: {
    report: InsertIncidentReportParams;
    statusEvent: InsertStatusEventParams;
    languageFlag: InsertLanguageFlagParams | null;
    guestSession: UpsertGuestSessionParams | null;
  },
): Promise<void> {
  const statements: D1PreparedStatement[] = [];

  if (params.guestSession) {
    const gs = params.guestSession;
    statements.push(
      db
        .prepare(
          `INSERT INTO GUEST_SESSIONS (
             guest_session_id,
             guest_alias,
             callback_contact,
             last_report_submitted_at,
             created_at,
             updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(guest_session_id) DO UPDATE SET
             guest_alias = COALESCE(excluded.guest_alias, GUEST_SESSIONS.guest_alias),
             callback_contact = COALESCE(excluded.callback_contact, GUEST_SESSIONS.callback_contact),
             last_report_submitted_at = excluded.last_report_submitted_at,
             updated_at = excluded.updated_at`,
        )
        .bind(
          gs.guest_session_id,
          gs.guest_alias,
          gs.callback_contact,
          gs.last_report_submitted_at,
          gs.created_at,
          gs.updated_at,
        ),
    );
  }

  const r = params.report;
  statements.push(
    db
      .prepare(
        `INSERT INTO INCIDENT_REPORTS (
           incident_id,
           reference_number,
           reporter_user_id,
           guest_session_id,
           status_id,
           idempotency_key,
           idempotency_fingerprint,
           reporter_type,
           is_emergency,
           incident_category,
           priority_level,
           sanitized_description,
           original_description_enc,
           has_language_flag,
           latitude,
           longitude,
           barangay_zone,
           within_barangay_boundary,
           reverse_geocoded_address,
           location_source,
           pin_manually_adjusted,
           landmark_description,
           call_fallback_used,
           recorded_offline_during_outage,
           received_at,
           reminder_30s_due_at,
           takeover_60s_due_at,
           escalation_check_status_code,
           updated_at
         )
         VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?, ?, ?, ?, ?
         )`,
      )
      .bind(
        r.incident_id,
        r.reference_number,
        r.reporter_user_id,
        r.guest_session_id,
        r.status_id,
        r.idempotency_key,
        r.idempotency_fingerprint,
        r.reporter_type,
        r.is_emergency,
        r.incident_category,
        r.priority_level,
        r.sanitized_description,
        r.original_description_enc,
        r.has_language_flag,
        r.latitude,
        r.longitude,
        r.barangay_zone,
        r.within_barangay_boundary,
        r.reverse_geocoded_address,
        r.location_source,
        r.pin_manually_adjusted,
        r.landmark_description,
        r.call_fallback_used,
        r.recorded_offline_during_outage,
        r.received_at,
        r.reminder_30s_due_at,
        r.takeover_60s_due_at,
        r.escalation_check_status_code,
        r.updated_at,
      ),
  );

  const se = params.statusEvent;
  statements.push(
    db
      .prepare(
        `INSERT INTO INCIDENT_STATUS_EVENTS (
           status_event_id,
           incident_id,
           from_status_id,
           to_status_id,
           actor_user_id,
           actor_guest_session_id,
           reason,
           occurred_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        se.status_event_id,
        se.incident_id,
        se.from_status_id,
        se.to_status_id,
        se.actor_user_id,
        se.actor_guest_session_id,
        se.reason,
        se.occurred_at,
      ),
  );

  if (params.languageFlag) {
    const lf = params.languageFlag;
    statements.push(
      db
        .prepare(
          `INSERT INTO LANGUAGE_FLAGS (
             flag_id,
             incident_id,
             user_id,
             guest_session_id,
             matched_terms_summary,
             action_taken,
             strike_candidate,
             created_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          lf.flag_id,
          lf.incident_id,
          lf.user_id,
          lf.guest_session_id,
          lf.matched_terms_summary,
          lf.action_taken,
          lf.strike_candidate,
          lf.created_at,
        ),
    );
  }

  await db.batch(statements);
}

export async function listIncidentReports(
  db: Database,
  filters: ListReportsQuery,
): Promise<IncidentReportRecord[]> {
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (filters.status_id !== undefined) {
    conditions.push("r.status_id = ?");
    bindings.push(filters.status_id);
  }

  if (filters.is_emergency !== undefined) {
    conditions.push("r.is_emergency = ?");
    bindings.push(filters.is_emergency);
  }

  if (filters.incident_category !== undefined) {
    conditions.push("r.incident_category = ?");
    bindings.push(filters.incident_category);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db
    .prepare(
      `SELECT ${PUBLIC_REPORT_COLUMNS}
       FROM INCIDENT_REPORTS r
       LEFT JOIN INCIDENT_STATUSES s ON s.status_id = r.status_id
       ${whereClause}
       ORDER BY r.is_emergency DESC, r.received_at DESC`,
    )
    .bind(...bindings)
    .all<IncidentReportRecord>();

  return result.results ?? [];
}

export async function findIncidentReportById(
  db: Database,
  idOrRef: string,
): Promise<IncidentReportRecord | null> {
  return db
    .prepare(
      `SELECT ${PUBLIC_REPORT_COLUMNS}
       FROM INCIDENT_REPORTS r
       LEFT JOIN INCIDENT_STATUSES s ON s.status_id = r.status_id
       WHERE r.incident_id = ? OR r.reference_number = ?
       LIMIT 1`,
    )
    .bind(idOrRef, idOrRef)
    .first<IncidentReportRecord>();
}

export async function findStatusEventsByIncidentId(
  db: Database,
  incidentId: string,
): Promise<IncidentStatusEventRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         e.status_event_id,
         e.incident_id,
         e.from_status_id,
         fs.status_code AS from_status_code,
         fs.status_label AS from_status_label,
         e.to_status_id,
         ts.status_code AS to_status_code,
         ts.status_label AS to_status_label,
         e.actor_user_id,
         e.actor_guest_session_id,
         e.reason,
         e.occurred_at
       FROM INCIDENT_STATUS_EVENTS e
       LEFT JOIN INCIDENT_STATUSES fs ON fs.status_id = e.from_status_id
       LEFT JOIN INCIDENT_STATUSES ts ON ts.status_id = e.to_status_id
       WHERE e.incident_id = ?
       ORDER BY e.occurred_at ASC`,
    )
    .bind(incidentId)
    .all<IncidentStatusEventRecord>();

  return result.results ?? [];
}

export async function findLanguageFlagsByIncidentId(
  db: Database,
  incidentId: string,
): Promise<LanguageFlagRecord[]> {
  const result = await db
    .prepare(
      `SELECT
         flag_id,
         incident_id,
         user_id,
         guest_session_id,
         matched_terms_summary,
         action_taken,
         strike_candidate,
         created_at
       FROM LANGUAGE_FLAGS
       WHERE incident_id = ?
       ORDER BY created_at ASC`,
    )
    .bind(incidentId)
    .all<LanguageFlagRecord>();

  return result.results ?? [];
}

