import { notify } from "./notifications";
import type { AppEnv } from "../types/env";

type Database = AppEnv["Bindings"]["geofix167_db"];

type DispatchIncidentInput = {
  incidentId: string;
  responderResourceId: string;
  dispatchedByUserId: string;
  eligibleStatusCodes?: string[];
  allowEmergencyReports?: boolean;
  assignmentNote?: string;
  eventNote?: string;
};

/** Shared responder assignment transaction for admin and future BDRRMO workflows. */
export async function dispatchIncidentToResponder(db: Database, input: DispatchIncidentInput) {
  const eligibleStatuses = input.eligibleStatusCodes?.length ? input.eligibleStatusCodes : ["VERIFIED"];
  const statusPlaceholders = eligibleStatuses.map(() => "?").join(", ");
  const assignmentId = crypto.randomUUID();
  const assignmentEventId = crypto.randomUUID();
  const incidentEventId = crypto.randomUUID();
  const emergencyClause = input.allowEmergencyReports ? "" : "AND r.is_emergency = 0";

  const result = await db.batch([
    db.prepare(`INSERT INTO tanod_assignments
      (tanod_assignment_id, incident_id, tanod_user_id, responder_resource_id, assignment_status_id, assigned_by_user_id, notes)
      SELECT ?, r.incident_id, rr.responder_user_id, rr.responder_resource_id, 1, ?, ?
      FROM incident_reports r JOIN incident_statuses s ON s.incident_status_id = r.incident_status_id
      JOIN responder_resources rr ON rr.responder_resource_id = ?
      WHERE r.incident_id = ? AND s.code IN (${statusPlaceholders}) ${emergencyClause}
        AND rr.availability_status IN ('AVAILABLE', 'BUSY') AND rr.responder_user_id IS NOT NULL`)
      .bind(assignmentId, input.dispatchedByUserId, input.assignmentNote ?? "Admin dispatch", input.responderResourceId, input.incidentId, ...eligibleStatuses),
    db.prepare(`INSERT INTO incident_status_events
      (incident_status_event_id, incident_id, from_incident_status_id, to_incident_status_id, changed_by_user_id, note)
      SELECT ?, a.incident_id, r.incident_status_id, 13, ?, ?
      FROM tanod_assignments a JOIN incident_reports r ON r.incident_id = a.incident_id
      WHERE a.tanod_assignment_id = ?`)
      .bind(incidentEventId, input.dispatchedByUserId, input.eventNote ?? "Responder dispatched by administrator", assignmentId),
    db.prepare(`UPDATE incident_reports SET incident_status_id = 13, updated_at = datetime('now')
      WHERE incident_id = ? AND EXISTS (SELECT 1 FROM tanod_assignments WHERE tanod_assignment_id = ?)`)
      .bind(input.incidentId, assignmentId),
    db.prepare(`UPDATE responder_resources SET availability_status = 'BUSY', updated_at = datetime('now')
      WHERE responder_resource_id = ? AND availability_status = 'AVAILABLE'
        AND EXISTS (SELECT 1 FROM tanod_assignments WHERE tanod_assignment_id = ?)`)
      .bind(input.responderResourceId, assignmentId),
    db.prepare(`INSERT INTO tanod_assignment_events
      (tanod_assignment_event_id, tanod_assignment_id, assignment_status_id, changed_by_user_id, note)
      SELECT ?, ?, 1, ?, 'Dispatched by administrator'
      WHERE EXISTS (SELECT 1 FROM tanod_assignments WHERE tanod_assignment_id = ?)`)
      .bind(assignmentEventId, assignmentId, input.dispatchedByUserId, assignmentId),
    notify(db, { type: "team_dispatched", actorId: input.dispatchedByUserId, eventId: assignmentId,
      reportId: input.incidentId, assignmentId, afterChange: true }),
  ]);

  return result[0]?.meta.changes ? { assignmentId } : null;
}
