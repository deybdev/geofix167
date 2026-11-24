import type { AppEnv } from "../types/env";

type Database = AppEnv["Bindings"]["geofix167_db"];
type RecipientRole = "admin" | "responder" | "resident" | "bdrrmo";
const monitor = "/bdrrmo/incidents";
const maintenance = "/admin/maintenance-tasks";
const messages = {
  emergency_forwarded: ["High · Emergency forwarded to BDRRMO", "An emergency is awaiting BDRRMO dispatch.", monitor],
  maintenance_intake: ["New maintenance report", "A maintenance report is in the Intake Queue.", maintenance],
  team_dispatched: ["Team dispatched", "A response team has been assigned.", monitor],
  ACCEPTED: ["Responder accepted", "The responder accepted the assignment.", monitor],
  DECLINED: ["Responder declined", "This assignment needs attention.", monitor],
  EN_ROUTE: ["Responder en route", "The responder is on the way.", monitor],
  ON_SCENE: ["Responder on scene", "The responder reached the incident.", monitor],
  handover_submitted: ["Handover submitted", "A responder submitted a handover.", "/bdrrmo/handover-completion"],
  resolution_ready: ["Resolution ready for verification", "Field evidence is ready for closure review.", monitor],
  support_requested: ["DRRMO support requested", "A maintenance report needs additional support.", maintenance],
  registration_pending: ["Registration awaiting review", "A resident submitted identification for review.", "/admin/registrations"],
  maintenance_verification: ["Work order awaiting verification", "Repair evidence is ready for admin review.", maintenance],
} as const;

type Notice = {
  type: keyof typeof messages;
  actorId: string | null;
  eventId: string;
  reportId?: string | null;
  assignmentId?: string;
  recipientRole?: RecipientRole;
  recipientUserId?: string;
  title?: string;
  body?: string;
  linkPath?: string;
  afterChange?: boolean;
};

// Append to the event's D1 batch. Fan-out gives each recipient an independent read receipt.
export function notify(db: Database, event: Notice): D1PreparedStatement {
  const role = event.recipientRole ?? "admin";
  const [title, body, link] = messages[event.type];
  const path = event.linkPath ?? link;
  return db.prepare(`INSERT INTO notifications
    (recipient_role, recipient_user_id, type, title, body, report_id, assignment_id, link_path, dedupe_key)
    SELECT ?, u.user_id, ?, ?, ?, ?, ?,
      CASE WHEN ? = ? AND EXISTS (SELECT 1 FROM incident_reports WHERE incident_id = ? AND is_emergency = 0)
        THEN '/admin/maintenance-tasks' ELSE ? END, ? || ':' || u.user_id
    FROM users u JOIN roles r ON r.role_id = u.role_id
    WHERE (r.code = ? OR (? = 'responder' AND r.code IN ('tanod','police','fire')))
      AND u.user_id IS NOT ? AND (? IS NULL OR u.user_id = ?)
      ${event.afterChange ? "AND changes() > 0" : ""}
    ON CONFLICT(dedupe_key) DO NOTHING`).bind(role, event.type, event.title ?? title, event.body ?? body,
      event.reportId ?? null, event.assignmentId ?? null, path, monitor, event.reportId ?? null, path, event.type + ":" + event.eventId,
      role, role, event.actorId, event.recipientUserId ?? null, event.recipientUserId ?? null);
}
