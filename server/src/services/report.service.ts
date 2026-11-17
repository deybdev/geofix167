import type { AppEnv, AuthUser } from "../types/env";
import type { CreateReportInput, ListReportsQuery } from "../validators/report.schema";
import {
  findIncidentStatus, hasActiveReportAssignment, hasReportReadAssignment, hasAnyReportAssignment, findCreationReplay, verifyGuestSession, updateIncidentReportStatus, updateIncidentReportDetails,
  createIncidentReportBundle, findIncidentReportById, findLanguageFlagsByIncidentId,
  findStatusEventsByIncidentId, listIncidentReports,
  type IncidentReportRecord, type IncidentStatusEventRecord,
  type LanguageFlagRecord, type PriorityCode,
} from "../repositories/report.repository";
import { filterLanguage } from "./languageFilter.service";
import reportCatalog from "../shared/reportCatalog.json";
import { reverseGeocodeCoordinates } from "./reverseGeocode.service";

type Database = AppEnv["Bindings"]["geofix167_db"];
export class ReportError extends Error {
  constructor(message: string, public status: number) {
    super(message); this.name = "ReportError";
  }
}
export type SubmitReportResult = {
  report: IncidentReportRecord & { guest_access_token?: string };
  status_events: IncidentStatusEventRecord[];
  idempotent_replay: boolean;
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
  const formUrgency = reportCatalog.formUrgencies.find((urgency) =>
    urgency.label.toUpperCase() === value.trim().toUpperCase()
    || urgency.priorityLevel === value.trim().toUpperCase()
    || urgency.priorityCode === value.trim().toUpperCase());
  if (formUrgency) return formUrgency.priorityCode as PriorityCode;
  switch (value.trim().toUpperCase()) {
    case "CRITICAL": case "P1": return "P1";
    default: throw new ReportError("Priority must be Low, Medium, High, Critical, or P1�P4.", 400);
  }
}
function cleanSingleLine(value: string | null | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}
function cleanMultiline(value: string | null | undefined): string {
  return (value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
}
export async function submitIncidentReport(db: Database, input: CreateReportInput, user?: AuthUser, guestToken?: string): Promise<SubmitReportResult> {
  if (!user && (input.reporter_type === "RESIDENT" || input.reporter_user_id)) {
    throw new ReportError("Sign in to submit a resident report.", 401);
  }
  if (user && input.reporter_user_id && input.reporter_user_id !== user.id) {
    throw new ReportError("Reporter identity does not match your session.", 403);
  }
  const guestSubmission = input.reporter_type === "GUEST" || !user;
  const userId = guestSubmission ? null : user?.id ?? null;
  if (userId && input.guest_session_id) {
    throw new ReportError("Provide a user identity or a guest identity, not both.", 400);
  }
  if (input.guest_session_id && (!guestToken || !await verifyGuestSession(db, input.guest_session_id, await sha256(guestToken)))) {
    throw new ReportError("Invalid guest credential.", 401);
  }
  const replay = async (): Promise<SubmitReportResult | null> => {
    if (!input.idempotency_key || (!userId && !input.guest_session_id)) return null;
    const existing = await findCreationReplay(db, input.idempotency_key, userId, input.guest_session_id ?? null);
    if (!existing) return null;
    const report = await findIncidentReportById(db, existing.incident_id);
    return report ? { report, status_events: await findStatusEventsByIncidentId(db, report.incident_id), idempotent_replay: true } : null;
  };
  const existing = await replay();
  if (existing) return existing;
  const category = input.incident_category.trim();
  const priority = priorityCode(input.priority_level ?? (input.is_emergency === 1 ? "CRITICAL" : "MEDIUM"));
  const classification = reportCatalog.classifications.find((item) => item.value === input.classification);
  const assignedTeam = classification?.assignedTeam ?? (input.is_emergency === 1 ? "BDRRMO Response" : "Maintenance Team A");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const guestId = userId === null ? (input.guest_session_id ?? crypto.randomUUID()) : null;
  const token = guestId && !input.guest_session_id ? Array.from(crypto.getRandomValues(new Uint8Array(32)),
    byte => byte.toString(16).padStart(2, "0")).join("") : undefined;
  const description = input.reporter_type === "GUEST"
    ? cleanMultiline(input.description)
    : (input.description ?? "");
  let address = cleanSingleLine(input.reverse_geocoded_address) || cleanSingleLine(input.landmark_description);
  if (!address && input.latitude != null && input.longitude != null) {
    try { address = (await reverseGeocodeCoordinates(input.latitude, input.longitude)) ?? ""; }
    catch { /* Coordinate fallback keeps reporting available when geocoding is offline. */ }
  }
  const coordinateFallback = input.latitude != null && input.longitude != null
    ? `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`
    : "";
  const locationDescription = address || coordinateFallback || null;
  const language = filterLanguage(description);
  const languageFlags: LanguageFlagRecord[] = await Promise.all(
    [...new Set(language.matchedTerms.map(term => term.toLowerCase()))].map(async term => ({
      language_flag_id: crypto.randomUUID(), incident_id: id,
      detected_term_hash: await sha256(term), severity: "LOW" as const,
      status: "OPEN" as const, reviewed_by_user_id: null, reviewed_at: null, created_at: now,
    })),
  );
  const creationAudit = input.idempotency_key ? {
    key: input.idempotency_key,
    id: "report-created:" + await sha256(JSON.stringify([userId ? "user" : "guest", userId ?? guestId, input.idempotency_key])),
  } : undefined;
  try {
    await createIncidentReportBundle(db, {
      creationAudit,
      guestSession: guestId && token ? {
        guest_session_id: guestId, display_name: cleanSingleLine(input.guest_alias) || "Guest",
        access_token_hash: await sha256(token), created_at: now,
      } : null,
      report: {
        incident_id: id, reported_by_user_id: userId, guest_session_id: guestId,
        incident_status_id: 1, category, priority_code: priority,
        is_emergency: input.is_emergency === 1 ? 1 : 0,
        title: cleanSingleLine(input.title) || `${category} Incident Report`, description_original: description,
        description_sanitized: language.sanitizedText, callback_mobile_number: input.callback_contact?.trim() || null,
        latitude: input.latitude ?? null, longitude: input.longitude ?? null,
        accuracy_meters: input.accuracy_meters ?? null,
        within_barangay_boundary: input.within_barangay_boundary ?? null,
        pin_manually_adjusted: input.pin_manually_adjusted,
        address_geocoded_at: input.latitude != null && input.longitude != null ? now : null,
        assigned_team: assignedTeam,
        location_description: locationDescription,
        submitted_at: now, updated_at: now,
      },
      statusEvent: {
        incident_status_event_id: crypto.randomUUID(), incident_id: id,
        from_incident_status_id: null, to_incident_status_id: 1,
        changed_by_user_id: userId, note: "Initial report submitted", created_at: now,
      },
      languageFlags,
    });
  } catch (error) {
    const winner = await replay();
    if (winner) return winner;
    throw error;
  }
  const report = await findIncidentReportById(db, id);
  if (!report) throw new ReportError("Failed to retrieve created incident report.", 500);
  return {
    report: { ...report, ...(token ? { guest_access_token: token } : {}) },
    status_events: await findStatusEventsByIncidentId(db, id), idempotent_replay: false,
  };
}
export async function getIncidentReports(db: Database, filters: ListReportsQuery, user?: AuthUser): Promise<IncidentReportRecord[]> {
  if (!user) throw new ReportError("Authentication required.", 401);
  await resolveLegacyReportAddresses(db);
  return listIncidentReports(db, filters, ["admin", "bdrrmo"].includes(user.role) ? undefined : user.id, ["tanod", "police", "fire"].includes(user.role));
}

export async function resolveLegacyReportAddresses(db: Database, incidentId?: string): Promise<void> {
  const candidates = await db.prepare(`
    SELECT incident_id, latitude, longitude FROM incident_reports
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND address_geocoded_at IS NULL
      AND (location_description IS NULL OR trim(location_description) = ''
        OR location_description = printf('%.5f, %.5f', latitude, longitude))
      ${incidentId ? "AND incident_id = ?" : ""}
    ORDER BY submitted_at ASC LIMIT ${incidentId ? "1" : "2"}
  `).bind(...(incidentId ? [incidentId] : [])).all<{ incident_id: string; latitude: number; longitude: number }>();

  for (const report of candidates.results ?? []) {
    let address: string | null = null;
    try { address = await reverseGeocodeCoordinates(report.latitude, report.longitude); }
    catch { /* Record the attempt so an unavailable geocoder is not called on every refresh. */ }
    await db.prepare(`UPDATE incident_reports
      SET location_description = COALESCE(NULLIF(?, ''), location_description), address_geocoded_at = datetime('now')
      WHERE incident_id = ? AND address_geocoded_at IS NULL`)
      .bind(address ?? "", report.incident_id).run();
  }
}

export async function getIncidentReportDetails(db: Database, id: string, user?: AuthUser, guestToken?: string): Promise<IncidentReportDetail> {
  await resolveLegacyReportAddresses(db, id.trim());
  const report = await findIncidentReportById(db, id.trim());
  if (!report) throw new ReportError("Incident report not found.", 404);
  const owned = user && (user.role === "admin" || user.role === "bdrrmo" || report.reported_by_user_id === user.id || (["tanod", "police", "fire"].includes(user.role) && await hasReportReadAssignment(db, id, user.id)));
  let guestOwned = false;
  if (!owned && guestToken && report.guest_session_id) {
    guestOwned = await verifyGuestSession(db, report.guest_session_id, await sha256(guestToken));
  }
  if (!owned && !guestOwned) throw new ReportError("Incident report not found.", 404);
  const [status_events, language_flags] = await Promise.all([
    findStatusEventsByIncidentId(db, report.incident_id),
    findLanguageFlagsByIncidentId(db, report.incident_id),
  ]);
  return { ...report, status_events, language_flags };
}

const STATUS_TRANSITIONS: Record<number, readonly number[]> = {
  1: [2,3,4,11,12], 2: [3,4,11,12], 3: [2,4,11],
  4: [5,6,13,14,11,12], 5: [6,13,14,10], 13: [6,7,8,14,10],
  14: [6,7,8,9,10], 6: [7,8,9,10], 7: [8,9,10], 8: [9,10],
  9: [8,10], 10: [2,4], 11: [2,4], 12: [2,4],
};
export async function updateReportStatus(db: Database, id: string,
  input: import("../validators/report.schema").UpdateReportStatusInput, user?: AuthUser) {
  if (!user) throw new ReportError("Authentication required.", 401);
  const privileged = user.role === "admin" || user.role === "bdrrmo";
  const responder = ["tanod", "police", "fire"].includes(user.role);
  if (!privileged && !(responder && await hasActiveReportAssignment(db, id, user.id))) {
    throw new ReportError("You do not have permission to change this report's status.", 403);
  }
  const report = await findIncidentReportById(db, id);
  if (!report) throw new ReportError("Incident report not found.", 404);
  const status = await findIncidentStatus(db, input.status_id);
  if (!status) throw new ReportError("Unknown incident status.", 400);
  if (!STATUS_TRANSITIONS[report.incident_status_id]?.includes(input.status_id)) {
    throw new ReportError("Invalid status transition.", 409);
  }
  if (!privileged && (report.is_terminal === 1 || ![7,8,9].includes(input.status_id))) {
    throw new ReportError("You do not have permission for this status transition.", 403);
  }
  if ([6,13].includes(input.status_id) && !await hasAnyReportAssignment(db, id)) {
    throw new ReportError("An active or offered assignment is required.", 409);
  }
  if (!await updateIncidentReportStatus(db, id, report.incident_status_id, input.status_id,
    status.is_terminal === 1, user.id, input.note)) {
    throw new ReportError("Report status changed. Reload and try again.", 409);
  }
  return findIncidentReportById(db, id);
}

export async function updateReportDetails(db: Database, id: string,
  input: import("../validators/report.schema").UpdateReportDetailsInput, user?: AuthUser, guestToken?: string) {
  if (user && user.role !== "admin" && user.role !== "resident") {
    throw new ReportError("You do not have permission to edit report details.", 403);
  }
  if (!user && !guestToken) throw new ReportError("Authentication required.", 401);
  // Reuses owner/admin and live guest-credential verification, never trusts a session ID in a payload.
  const report = await getIncidentReportDetails(db, id, user, guestToken);
  const admin = user?.role === "admin";
  if (!admin && (input.category !== undefined || input.priority_code !== undefined)) {
    throw new ReportError("Only administrators can modify incident category or priority.", 403);
  }
  if (!admin && ![1,2,3].includes(report.incident_status_id)) {
    throw new ReportError("Report details can no longer be edited after verification or dispatch.", 409);
  }
  const values = { ...input };
  if (values.description_sanitized !== undefined) {
    values.description_sanitized = filterLanguage(values.description_sanitized).sanitizedText ?? "";
  }
  if (!await updateIncidentReportDetails(db, id, values, admin, user?.id ?? null)) {
    throw new ReportError("Report is no longer editable. Reload and try again.", 409);
  }
  return findIncidentReportById(db, id);
}
