import type { AppEnv } from "../types/env";
import type {
  CreateReportInput,
  ListReportsQuery,
} from "../validators/report.schema";
import {
  createIncidentReportBundle,
  findIncidentReportById,
  findLanguageFlagsByIncidentId,
  findReportByIdempotencyKey,
  findStatusEventsByIncidentId,
  listIncidentReports,
  type IncidentReportRecord,
  type IncidentStatusEventRecord,
  type LanguageFlagRecord,
} from "../repositories/report.repository";
import { filterLanguage } from "./languageFilter.service";

type Database = AppEnv["Bindings"]["geofix167_db"];

export class ReportError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ReportError";
  }
}

export type SubmitReportResult = {
  report: IncidentReportRecord;
  status_events: IncidentStatusEventRecord[];
  idempotent_replay: boolean;
};

export type IncidentReportDetail = IncidentReportRecord & {
  status_events: IncidentStatusEventRecord[];
  language_flags: LanguageFlagRecord[];
};

function generateReferenceNumber(date: Date): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const randomBytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(randomBytes)
    .map((byte) => chars.charAt(byte % chars.length))
    .join("");

  return `GF167-${datePart}-${suffix}`;
}

export async function submitIncidentReport(
  db: Database,
  input: CreateReportInput,
): Promise<SubmitReportResult> {
  const existing = await findReportByIdempotencyKey(
    db,
    input.idempotency_key,
  );

  if (existing) {
    const existingEvents = await findStatusEventsByIncidentId(
      db,
      existing.incident_id,
    );
    return {
      report: existing,
      status_events: existingEvents,
      idempotent_replay: true,
    };
  }

  const now = new Date();
  const receivedAt = now.toISOString();
  const incidentId = crypto.randomUUID();
  const referenceNumber = generateReferenceNumber(now);

  const languageCheck = filterLanguage(input.description);

  const isEmergency: 0 | 1 = input.is_emergency === 1 ? 1 : 0;
  const reminder30sDueAt =
    isEmergency === 1
      ? new Date(now.getTime() + 30 * 1000).toISOString()
      : null;
  const takeover60sDueAt =
    isEmergency === 1
      ? new Date(now.getTime() + 60 * 1000).toISOString()
      : null;
  const escalationCheckStatusCode = isEmergency === 1 ? 1 : 0;

  const reporterType = input.reporter_type;
  const reporterUserId =
    reporterType === "RESIDENT"
      ? (input.reporter_user_id ?? null)
      : (input.reporter_user_id ?? null);
  const guestSessionId =
    reporterType === "GUEST"
      ? (input.guest_session_id ?? crypto.randomUUID())
      : (input.guest_session_id ?? null);

  await createIncidentReportBundle(db, {
    guestSession:
      guestSessionId !== null
        ? {
            guest_session_id: guestSessionId,
            guest_alias: input.guest_alias ?? null,
            callback_contact: input.callback_contact ?? null,
            last_report_submitted_at: receivedAt,
            created_at: receivedAt,
            updated_at: receivedAt,
          }
        : null,
    report: {
      incident_id: incidentId,
      reference_number: referenceNumber,
      reporter_user_id: reporterUserId,
      guest_session_id: guestSessionId,
      status_id: 1,
      idempotency_key: input.idempotency_key,
      idempotency_fingerprint: input.idempotency_fingerprint ?? null,
      reporter_type: reporterType,
      is_emergency: isEmergency,
      incident_category: input.incident_category,
      priority_level: input.priority_level,
      sanitized_description: languageCheck.sanitizedText,
      original_description_enc: input.description ?? null,
      has_language_flag: languageCheck.hasLanguageFlag,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      barangay_zone: input.barangay_zone ?? null,
      within_barangay_boundary: input.within_barangay_boundary ?? null,
      reverse_geocoded_address: input.reverse_geocoded_address ?? null,
      location_source: input.location_source ?? null,
      pin_manually_adjusted: input.pin_manually_adjusted,
      landmark_description: input.landmark_description ?? null,
      call_fallback_used: input.call_fallback_used,
      recorded_offline_during_outage: input.recorded_offline_during_outage,
      received_at: receivedAt,
      reminder_30s_due_at: reminder30sDueAt,
      takeover_60s_due_at: takeover60sDueAt,
      escalation_check_status_code: escalationCheckStatusCode,
      updated_at: receivedAt,
    },
    statusEvent: {
      status_event_id: crypto.randomUUID(),
      incident_id: incidentId,
      from_status_id: null,
      to_status_id: 1,
      actor_user_id: reporterUserId,
      actor_guest_session_id: guestSessionId,
      reason: "Initial report submitted",
      occurred_at: receivedAt,
    },
    languageFlag:
      languageCheck.hasLanguageFlag === 1
        ? {
            flag_id: crypto.randomUUID(),
            incident_id: incidentId,
            user_id: reporterUserId,
            guest_session_id: guestSessionId,
            matched_terms_summary: languageCheck.matchedTermsSummary,
            action_taken: "MASKED",
            strike_candidate: 1,
            created_at: receivedAt,
          }
        : null,
  });

  const createdReport = await findIncidentReportById(db, incidentId);
  const statusEvents = await findStatusEventsByIncidentId(db, incidentId);

  if (!createdReport) {
    throw new ReportError("Failed to retrieve created incident report.", 500);
  }

  return {
    report: createdReport,
    status_events: statusEvents,
    idempotent_replay: false,
  };
}

export async function getIncidentReports(
  db: Database,
  filters: ListReportsQuery,
): Promise<IncidentReportRecord[]> {
  return listIncidentReports(db, filters);
}

export async function getIncidentReportDetails(
  db: Database,
  idOrRef: string,
): Promise<IncidentReportDetail> {
  const report = await findIncidentReportById(db, idOrRef.trim());

  if (!report) {
    throw new ReportError("Incident report not found.", 404);
  }

  const [statusEvents, languageFlags] = await Promise.all([
    findStatusEventsByIncidentId(db, report.incident_id),
    findLanguageFlagsByIncidentId(db, report.incident_id),
  ]);

  return {
    ...report,
    status_events: statusEvents,
    language_flags: languageFlags,
  };
}

