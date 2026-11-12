import type { AppEnv, AuthUser } from "../types/env";
import type { CreateReportInput, ListReportsQuery } from "../validators/report.schema";
import {
  createIncidentReportBundle, findIncidentReportById, findLanguageFlagsByIncidentId,
  findStatusEventsByIncidentId, listIncidentReports,
  type IncidentReportRecord, type IncidentStatusEventRecord,
  type LanguageFlagRecord, type PriorityCode,
} from "../repositories/report.repository";
import { filterLanguage } from "./languageFilter.service";

type Database = AppEnv["Bindings"]["geofix167_db"];
export class ReportError extends Error {
  constructor(message: string, public status: number) {
    super(message); this.name = "ReportError";
  }
}
export type SubmitReportResult = {
  report: IncidentReportRecord & { guest_access_token?: string };
  status_events: IncidentStatusEventRecord[];
  // Compatibility with the existing controller; submissions always create a report.
  idempotent_replay: false;
};
export type IncidentReportDetail = IncidentReportRecord & {
  status_events: IncidentStatusEventRecord[];
  language_flags: LanguageFlagRecord[];
};
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function priorityCode(value: string): PriorityCode {
  switch (value.trim().toUpperCase()) {
    case "CRITICAL": case "P1": return "P1";
    case "HIGH": case "P2": return "P2";
    case "MEDIUM": case "P3": return "P3";
    case "LOW": case "P4": return "P4";
    default: throw new ReportError("Priority must be Low, Medium, High, Critical, or P1�P4.", 400);
  }
}
export async function submitIncidentReport(db: Database, input: CreateReportInput, user?: AuthUser): Promise<SubmitReportResult> {
  if (!user && (input.reporter_type === "RESIDENT" || input.reporter_user_id)) {
    throw new ReportError("Sign in to submit a resident report.", 401);
  }
  if (user && input.reporter_user_id && input.reporter_user_id !== user.id) {
    throw new ReportError("Reporter identity does not match your session.", 403);
  }
  const userId = user?.id ?? null;
  if (userId && input.guest_session_id) {
    throw new ReportError("Provide a user identity or a guest identity, not both.", 400);
  }
  // Session reuse requires token verification, which the current input does not support.
  if (input.guest_session_id) {
    throw new ReportError("Existing guest sessions require authenticated token verification. Omit guest_session_id to create a new session.", 400);
  }
  const category = input.incident_category.trim();
  const priority = priorityCode(input.priority_level ?? (input.is_emergency === 1 ? "CRITICAL" : "MEDIUM"));
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const guestId = userId === null ? crypto.randomUUID() : null;
  const token = guestId ? Array.from(crypto.getRandomValues(new Uint8Array(32)),
    byte => byte.toString(16).padStart(2, "0")).join("") : undefined;
  const description = input.description ?? "";
  const language = filterLanguage(description);
  const languageFlags: LanguageFlagRecord[] = await Promise.all(
    [...new Set(language.matchedTerms.map(term => term.toLowerCase()))].map(async term => ({
      language_flag_id: crypto.randomUUID(), incident_id: id,
      detected_term_hash: await sha256(term), severity: "LOW" as const,
      status: "OPEN" as const, reviewed_by_user_id: null, reviewed_at: null, created_at: now,
    })),
  );
  await createIncidentReportBundle(db, {
    guestSession: guestId && token ? {
      guest_session_id: guestId, display_name: "Guest",
      access_token_hash: await sha256(token), created_at: now,
    } : null,
    report: {
      incident_id: id, reported_by_user_id: userId, guest_session_id: guestId,
      incident_status_id: 1, category, priority_code: priority,
      is_emergency: input.is_emergency === 1 ? 1 : 0,
      title: `${category} Incident Report`, description_original: description,
      description_sanitized: language.sanitizedText, callback_mobile_number: null,
      latitude: input.latitude ?? null, longitude: input.longitude ?? null,
      location_description: [input.landmark_description?.trim(), input.reverse_geocoded_address?.trim()]
        .filter((value, index, values) => value && values.indexOf(value) === index).join(" � ") || null,
      submitted_at: now, updated_at: now,
    },
    statusEvent: {
      incident_status_event_id: crypto.randomUUID(), incident_id: id,
      from_incident_status_id: null, to_incident_status_id: 1,
      changed_by_user_id: userId, note: "Initial report submitted", created_at: now,
    },
    languageFlags,
  });
  const report = await findIncidentReportById(db, id);
  if (!report) throw new ReportError("Failed to retrieve created incident report.", 500);
  return {
    report: { ...report, ...(token ? { guest_access_token: token } : {}) },
    status_events: await findStatusEventsByIncidentId(db, id), idempotent_replay: false,
  };
}
export async function getIncidentReports(db: Database, filters: ListReportsQuery, user?: AuthUser): Promise<IncidentReportRecord[]> {
  if (!user) throw new ReportError("Authentication required.", 401);
  return listIncidentReports(db, filters, user.role === "admin" ? undefined : user.id);
}
export async function getIncidentReportDetails(db: Database, id: string, user?: AuthUser, guestToken?: string): Promise<IncidentReportDetail> {
  const report = await findIncidentReportById(db, id.trim());
  if (!report) throw new ReportError("Incident report not found.", 404);
  const owned = user && (user.role === "admin" || report.reported_by_user_id === user.id);
  let guestOwned = false;
  if (!owned && guestToken && report.guest_session_id) {
    guestOwned = Boolean(await db.prepare(
      "SELECT guest_session_id FROM guest_sessions WHERE guest_session_id = ? AND access_token_hash = ? AND ended_at IS NULL AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))"
    ).bind(report.guest_session_id, await sha256(guestToken)).first());
  }
  if (!owned && !guestOwned) throw new ReportError("Incident report not found.", 404);
  const [status_events, language_flags] = await Promise.all([
    findStatusEventsByIncidentId(db, report.incident_id),
    findLanguageFlagsByIncidentId(db, report.incident_id),
  ]);
  return { ...report, status_events, language_flags };
}
