import type { AppEnv } from "../types/env";

type Database = AppEnv["Bindings"]["geofix167_db"];

type SnapshotRow = {
  incident_id: string;
  reference_number: string;
  title: string;
  classification: string;
  category: string | null;
  priority_code: string | null;
  reporter_name: string;
  reporter_type: string;
  submitted_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  within_barangay_boundary: number | null;
  pin_manually_adjusted: number;
  location_description: string | null;
  assigned_team: string | null;
  description: string | null;
  closed_at: string | null;
  closed_by_user_id: string | null;
  closed_by_name: string | null;
  status_code: string;
};

async function findReport(db: Database, id: string): Promise<SnapshotRow | null> {
  return db.prepare(`SELECT r.incident_id,
      COALESCE(printf('GF-%03d', ref.reference_sequence), r.incident_id) AS reference_number,
      r.title, CASE WHEN r.is_emergency = 1 THEN 'Sudden Incident' ELSE 'Maintenance Issue' END AS classification,
      r.category, r.priority_code,
      CASE WHEN r.guest_session_id IS NOT NULL THEN COALESCE(gs.display_name, 'Guest')
        ELSE COALESCE(NULLIF(trim(reporter.first_name || ' ' || reporter.last_name), ''), 'Resident') END AS reporter_name,
      CASE WHEN r.guest_session_id IS NOT NULL THEN 'Guest' ELSE 'Resident' END AS reporter_type,
      r.submitted_at, r.latitude, r.longitude, r.accuracy_meters, r.within_barangay_boundary,
      r.pin_manually_adjusted, r.location_description, r.assigned_team,
      COALESCE(NULLIF(trim(r.description_sanitized), ''), NULLIF(trim(r.description_original), '')) AS description,
      r.closed_at, r.closed_by_user_id,
      NULLIF(trim(closer.first_name || ' ' || closer.last_name), '') AS closed_by_name,
      status.code AS status_code
    FROM incident_reports r
    JOIN incident_statuses status ON status.incident_status_id = r.incident_status_id
    LEFT JOIN incident_report_references ref ON ref.incident_id = r.incident_id
    LEFT JOIN guest_sessions gs ON gs.guest_session_id = r.guest_session_id
    LEFT JOIN users reporter ON reporter.user_id = r.reported_by_user_id
    LEFT JOIN users closer ON closer.user_id = r.closed_by_user_id
    WHERE r.incident_id = ? OR printf('GF-%03d', ref.reference_sequence) = ?
    ORDER BY CASE WHEN r.incident_id = ? THEN 0 ELSE 1 END
    LIMIT 1`).bind(id, id, id).first<SnapshotRow>();
}

export async function ensureIncidentReportSnapshot(
  db: Database,
  id: string,
  generatedByUserId?: string | null,
  resolutionNotes?: string | null,
) {
  const existing = await db.prepare(`SELECT snapshot_json FROM incident_report_snapshots
    WHERE incident_id = (SELECT r.incident_id FROM incident_reports r
      LEFT JOIN incident_report_references ref ON ref.incident_id = r.incident_id
      WHERE r.incident_id = ? OR printf('GF-%03d', ref.reference_sequence) = ?
      ORDER BY CASE WHEN r.incident_id = ? THEN 0 ELSE 1 END LIMIT 1)`)
    .bind(id, id, id).first<{ snapshot_json: string }>();
  if (existing) return JSON.parse(existing.snapshot_json) as Record<string, unknown>;

  const report = await findReport(db, id);
  if (!report || !report.closed_at || report.status_code !== "CLOSED") return null;

  const actorId = report.closed_by_user_id ?? generatedByUserId;
  const [generator, statusResult, assignmentResult, assignmentEventResult, dispatchResult, mediaResult,
    handoverResult, closureAudit] = await Promise.all([
    actorId
      ? db.prepare("SELECT NULLIF(trim(first_name || ' ' || last_name), '') AS name FROM users WHERE user_id = ?")
        .bind(actorId).first<{ name: string | null }>()
      : Promise.resolve(null),
    db.prepare(`SELECT from_status.code AS from_status, to_status.code AS status,
        to_status.display_name AS label, actor.user_id AS actor_id,
        NULLIF(trim(actor.first_name || ' ' || actor.last_name), '') AS actor_name,
        event.note, event.created_at
      FROM incident_status_events event
      LEFT JOIN incident_statuses from_status ON from_status.incident_status_id = event.from_incident_status_id
      JOIN incident_statuses to_status ON to_status.incident_status_id = event.to_incident_status_id
      LEFT JOIN users actor ON actor.user_id = event.changed_by_user_id
      WHERE event.incident_id = ? ORDER BY event.created_at, event.incident_status_event_id`).bind(report.incident_id)
      .all<Record<string, unknown>>(),
    db.prepare(`SELECT assignment.tanod_assignment_id AS id, assignment.assigned_at, assignment.accepted_at,
        assignment.completed_at, responder.user_id AS responder_id,
        NULLIF(trim(responder.first_name || ' ' || responder.last_name), '') AS responder_name,
        resource.display_name AS unit_name, assigned_by.user_id AS assigned_by_id,
        NULLIF(trim(assigned_by.first_name || ' ' || assigned_by.last_name), '') AS assigned_by_name,
        status.code AS status
      FROM tanod_assignments assignment
      JOIN assignment_statuses status ON status.assignment_status_id = assignment.assignment_status_id
      LEFT JOIN users responder ON responder.user_id = assignment.tanod_user_id
      LEFT JOIN responder_resources resource ON resource.responder_resource_id = assignment.responder_resource_id
      LEFT JOIN users assigned_by ON assigned_by.user_id = assignment.assigned_by_user_id
      WHERE assignment.incident_id = ? ORDER BY assignment.assigned_at`).bind(report.incident_id)
      .all<Record<string, unknown>>(),
    db.prepare(`SELECT event.tanod_assignment_id AS assignment_id, status.code AS status,
        status.display_name AS label, event.note, event.created_at,
        NULLIF(trim(actor.first_name || ' ' || actor.last_name), '') AS actor_name
      FROM tanod_assignment_events event
      JOIN tanod_assignments assignment ON assignment.tanod_assignment_id = event.tanod_assignment_id
      JOIN assignment_statuses status ON status.assignment_status_id = event.assignment_status_id
      LEFT JOIN users actor ON actor.user_id = event.changed_by_user_id
      WHERE assignment.incident_id = ? ORDER BY event.created_at, event.tanod_assignment_event_id`).bind(report.incident_id)
      .all<Record<string, unknown>>(),
    db.prepare(`SELECT dispatch.responder_dispatch_id AS id, dispatch.target_role, dispatch.vehicle_name,
        dispatch.urgency, dispatch.status, dispatch.dispatched_at,
        NULLIF(trim(actor.first_name || ' ' || actor.last_name), '') AS dispatched_by_name
      FROM responder_dispatches dispatch
      LEFT JOIN users actor ON actor.user_id = dispatch.dispatched_by_user_id
      WHERE dispatch.incident_id = ? ORDER BY dispatch.dispatched_at`).bind(report.incident_id)
      .all<Record<string, unknown>>(),
    db.prepare(`SELECT incident_media_id AS id, media_type, content_type, original_filename,
        captured_at, created_at
      FROM incident_media WHERE incident_id = ? ORDER BY created_at, incident_media_id`).bind(report.incident_id)
      .all<Record<string, unknown>>(),
    db.prepare(`SELECT handover.qr_handover_id AS id, organization.name AS hospital,
        handover.receiving_officer_name AS receiver,
        NULLIF(trim(received_by.first_name || ' ' || received_by.last_name), '') AS acknowledged_by,
        status.code AS status, handover.accepted_at AS acknowledged_at,
        handover.receiving_remarks AS remarks, handover.created_at
      FROM qr_handovers handover
      JOIN qr_statuses status ON status.qr_status_id = handover.qr_status_id
      LEFT JOIN organizations organization ON organization.organization_id = handover.receiving_organization_id
      LEFT JOIN users received_by ON received_by.user_id = handover.received_by_user_id
      WHERE handover.incident_id = ? ORDER BY COALESCE(handover.accepted_at, handover.created_at), handover.qr_handover_id`)
      .bind(report.incident_id).all<Record<string, unknown>>(),
    db.prepare(`SELECT metadata_json FROM audit_logs
      WHERE incident_id = ? AND action = 'INCIDENT_RESOLVED'
      ORDER BY created_at DESC LIMIT 1`).bind(report.incident_id).first<{ metadata_json: string | null }>(),
  ]);

  const statusEvents = statusResult.results ?? [];
  const assignments = assignmentResult.results ?? [];
  const assignmentEvents = assignmentEventResult.results ?? [];
  const dispatches = dispatchResult.results ?? [];
  const handovers = handoverResult.results ?? [];
  const statusAt = (...codes: string[]) => statusEvents.find((event) => codes.includes(String(event.status)))?.created_at ?? null;
  const assignmentAt = (...codes: string[]) => assignmentEvents.find((event) => codes.includes(String(event.status)))?.created_at ?? null;
  const handover = [...handovers].reverse().find((entry) => entry.status === "ACCEPTED") ?? handovers.at(-1) ?? null;
  const generatedAt = new Date().toISOString();
  let savedResolutionNotes = resolutionNotes?.trim() || "";
  if (!savedResolutionNotes && closureAudit?.metadata_json) {
    try {
      const metadata = JSON.parse(closureAudit.metadata_json) as { resolution_notes?: string };
      savedResolutionNotes = metadata.resolution_notes?.trim() || "";
    } catch { /* Older audit metadata may not contain JSON. */ }
  }

  const snapshot = {
    schema_version: 1,
    generated_at: generatedAt,
    generated_by: { id: actorId, name: generator?.name || report.closed_by_name || "Authorized reviewer" },
    incident: {
      id: report.reference_number,
      incident_id: report.incident_id,
      title: report.title,
      classification: report.classification,
      category: report.category || "Uncategorized",
      urgency: ({ P1: "Critical", P2: "High", P3: "Medium", P4: "Low" } as Record<string, string>)[report.priority_code || ""] || "Not recorded",
      status: "Resolved",
      reporter: { name: report.reporter_name, type: report.reporter_type },
      submitted_at: report.submitted_at,
      assigned_team: report.assigned_team || "Not assigned",
      description: report.description || "No description",
      location: {
        address: report.location_description || "Location unavailable",
        latitude: report.latitude,
        longitude: report.longitude,
        accuracy_meters: report.accuracy_meters,
        boundary: report.within_barangay_boundary === 0 ? "Outside Barangay 167"
          : report.within_barangay_boundary === 1 ? "Inside Barangay 167" : "Not checked",
        pin_manually_adjusted: report.pin_manually_adjusted === 1,
      },
      timestamps: {
        submitted_at: report.submitted_at,
        verified_at: statusAt("VERIFIED", "FORWARDED_TO_BDRRMO"),
        dispatched_at: statusAt("DISPATCHED", "ASSIGNED") ?? assignments[0]?.assigned_at ?? dispatches[0]?.dispatched_at ?? null,
        accepted_at: statusAt("ACCEPTED") ?? assignmentAt("ACCEPTED") ?? assignments.find((entry) => entry.accepted_at)?.accepted_at ?? null,
        en_route_at: statusAt("EN_ROUTE") ?? assignmentAt("EN_ROUTE"),
        on_scene_at: statusAt("ON_SCENE") ?? assignmentAt("ON_SCENE"),
        handover_at: handover?.acknowledged_at ?? null,
        resolved_at: report.closed_at,
      },
      flags: {
        outside_barangay_167: report.within_barangay_boundary === 0,
        manually_adjusted_pin: report.pin_manually_adjusted === 1,
        gps_accuracy_meters: report.accuracy_meters,
      },
      resolution_notes: savedResolutionNotes || "No additional resolution notes recorded.",
    },
    status_history: statusEvents.map((event) => ({
      status: event.status,
      label: event.label,
      created_at: event.created_at,
      actor_name: event.actor_name,
    })),
    responders: {
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        responder: assignment.responder_name || "Responder",
        unit: assignment.unit_name || null,
        assigned_by: assignment.assigned_by_name || null,
        status: assignment.status,
        assigned_at: assignment.assigned_at,
        accepted_at: assignment.accepted_at,
        completed_at: assignment.completed_at,
      })),
      external_dispatches: dispatches.map((dispatch) => ({
        role: dispatch.target_role,
        unit: dispatch.vehicle_name || dispatch.target_role,
        urgency: dispatch.urgency,
        status: dispatch.status,
        dispatched_by: dispatch.dispatched_by_name || null,
        dispatched_at: dispatch.dispatched_at,
      })),
    },
    handover: handover ? {
      hospital: handover.hospital || "Receiving organization not recorded",
      receiver: handover.receiver || handover.acknowledged_by || "Receiver not recorded",
      acknowledged_at: handover.acknowledged_at,
      status: handover.status,
    } : null,
    media: mediaResult.results ?? [],
  };

  await db.prepare(`INSERT OR IGNORE INTO incident_report_snapshots
    (incident_id, generated_at, generated_by_user_id, snapshot_json)
    VALUES (?, ?, ?, ?)`).bind(report.incident_id, generatedAt, actorId, JSON.stringify(snapshot)).run();

  const saved = await db.prepare(`SELECT snapshot_json FROM incident_report_snapshots WHERE incident_id = ?`)
    .bind(report.incident_id).first<{ snapshot_json: string }>();
  return saved ? JSON.parse(saved.snapshot_json) as Record<string, unknown> : null;
}
