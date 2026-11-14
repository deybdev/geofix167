// Status IDs are defined by migrations 0005 and 0015. Keep the exact database
// status alongside the smaller set of card/filter groups used by the UI.
const STATUSES = {
  1: ["SUBMITTED", "Submitted", "submitted"],
  2: ["UNDER_REVIEW", "Under Front Desk Review", "under_review"],
  3: ["NEEDS_CLARIFICATION", "Needs Clarification", "under_review"],
  4: ["VERIFIED", "Verified", "under_review"],
  5: ["FORWARDED_TO_BDRRMO", "Forwarded to BDRRMO", "assigned"],
  6: ["ASSIGNED", "Assigned", "assigned"],
  7: ["EN_ROUTE", "En Route", "in_progress"],
  8: ["ON_SCENE", "On Scene", "in_progress"],
  9: ["FOR_CLOSURE_REVIEW", "For Closure Review", "in_progress"],
  10: ["CLOSED", "Closed", "resolved"],
  11: ["REJECTED", "Rejected", "rejected"],
  12: ["LINKED_DUPLICATE", "Linked Duplicate", "linked_duplicate"],
  13: ["DISPATCHED", "Dispatched", "assigned"],
  14: ["AWAITING_DRRMO_SUPPORT", "Awaiting DRRMO Support", "assigned"],
};

function timestamp(value) {
  if (!value) return null;
  // SQLite datetime('now') is UTC but does not include a timezone suffix.
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(" ", "T") + "Z" : value;
}

export function normalizeReport(record) {
  const statusId = Number(record.incident_status_id ?? record.status_id);
  const [code, label, group] = STATUSES[statusId] ?? ["UNKNOWN", "Unknown", "unknown"];
  const priority = record.priority_code ?? record.priority_level;
  const urgency = { P1: "Critical", P2: "High", P3: "Moderate", P4: "Low",
    CRITICAL: "Critical", HIGH: "High", MEDIUM: "Moderate", LOW: "Low" }[priority] ?? "Not specified";
  const events = (record.status_events ?? []).map(event => ({
    id: event.incident_status_event_id ?? event.status_event_id,
    from_status_id: event.from_incident_status_id ?? event.from_status_id ?? null,
    to_status_id: event.to_incident_status_id ?? event.to_status_id,
    label: event.to_status_label ?? STATUSES[event.to_incident_status_id ?? event.to_status_id]?.[1] ?? "Status updated",
    note: event.note ?? event.reason ?? "",
    created_at: timestamp(event.created_at ?? event.occurred_at),
  })).sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0));
  return {
    public_id: record.incident_id,
    reference_number: record.reference_number ?? record.incident_id,
    title: record.title,
    report_type: record.is_emergency === 1 || record.is_emergency === true ? "emergency" : "infrastructure",
    category: record.category ?? record.incident_category ?? "other",
    description: record.description_sanitized ?? record.sanitized_description ?? record.description_original ?? "",
    address: record.location_description ?? record.landmark_description ?? "",
    latitude: Number.isFinite(record.latitude) ? record.latitude : null,
    longitude: Number.isFinite(record.longitude) ? record.longitude : null,
    urgency, status: group, status_id: statusId,
    status_code: record.status_code ?? code,
    status_label: record.status_label ?? label,
    reported_by_user_id: record.reported_by_user_id ?? null,
    is_terminal: record.is_terminal === 1 || record.is_terminal === true || [10, 11, 12].includes(statusId),
    photo_url: record.photo_url ?? null,
    attachments: record.attachments ?? [],
    attachments_error: record.attachments_error ?? null,
    created_at: timestamp(record.submitted_at ?? record.received_at),
    updated_at: timestamp(record.updated_at),
    status_events: events,
  };
}

export function matchesReportStatus(report, status) {
  // The overview's In Progress counter and list filter both include every
  // active stage beyond submission. Rejected/duplicate reports aren't resolved.
  return !status || (status === "in_progress"
    ? !report.is_terminal && report.status_id > 1
    : report.status === status);
}

export function summarizeReports(reports) {
  return Object.fromEntries(["total", "submitted", "under_review", "assigned", "in_progress", "resolved"]
    .map(key => [key, key === "total" ? reports.length : reports.filter(r => matchesReportStatus(r, key)).length]));
}

async function reportRequest(path = "", { method = "GET", body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api/reports${path}`, {
      method, credentials: "include", cache: "no-store", signal,
      ...(body === undefined ? {} : body instanceof FormData ? { body }
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Could not connect to the server. Check your connection and try again.", { cause: error });
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || (method === "POST" && ![200, 201].includes(response.status))) {
    const error = new Error(data?.error || (response.status === 401
      ? "Your session has expired. Please sign in again." : "Unable to load or save your report. Please try again."));
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error("The server returned an invalid response. Please try again.");
  return data;
}

export async function getReports({ status, limit, signal } = {}) {
  const data = await reportRequest("", { signal });
  if (!Array.isArray(data.reports)) throw new Error("The server did not return a report list.");
  let reports = data.reports.map(normalizeReport).filter(report => matchesReportStatus(report, status));
  reports.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  if (limit) reports = reports.slice(0, limit);
  return { data: { reports } };
}

export async function getReportStats() {
  const { data } = await getReports();
  return { data: { stats: summarizeReports(data.reports) } };
}

function reportResult(data) {
  if (!data.report?.incident_id) throw new Error("The server did not return a saved report.");
  return { data: { ...data, report: normalizeReport(data.report) } };
}

export async function getReportDetails(id, { signal } = {}) {
  // Report access and payload validation must succeed before media is attempted.
  const result = reportResult(await reportRequest(`/${encodeURIComponent(id)}`, { signal }));
  let attachments = [];
  let attachments_error = null;
  try {
    const { data } = await getReportAttachments(id, { signal });
    attachments = data.attachments;
  } catch (error) {
    if (signal?.aborted || error.name === "AbortError") throw error;
    attachments_error = error.message || "Unable to load photos and videos.";
  }
  return { data: { ...result.data, report: { ...result.data.report, attachments, attachments_error } } };
}

export async function getReportAttachments(id, { signal } = {}) {
  const { attachments } = await reportRequest(`/${encodeURIComponent(id)}/attachments`, { signal });
  if (!Array.isArray(attachments)) throw new Error("Unable to load photos and videos.");
  return { data: { attachments } };
}

export async function uploadReportAttachment(reportId, file, uploadId) {
  const body = new FormData();
  body.append("file", file, file.name);
  body.append("upload_id", uploadId);
  // The browser supplies Content-Type including the multipart boundary.
  return reportRequest(`/${encodeURIComponent(reportId)}/attachments`, { method: "POST", body });
}

export function buildResidentReportPayload({ category, urgency, isEmergency, description, position, address, landmark, callbackContact }) {
  const pinned = Number.isFinite(position?.lat) && Number.isFinite(position?.lng);
  return {
    reporter_type: "RESIDENT", incident_category: category,
    priority_level: urgency?.toUpperCase() === "MODERATE" ? "MEDIUM" : (urgency || "HIGH").toUpperCase(),
    is_emergency: isEmergency ? 1 : 0, description: description.trim(),
    latitude: pinned ? position.lat : null, longitude: pinned ? position.lng : null,
    landmark_description: landmark?.trim() || null,
    reverse_geocoded_address: address?.trim() || null,
    callback_contact: callbackContact?.trim() || null,
  };
}

export async function submitReport(payload) {
  return reportResult(await reportRequest("", { method: "POST", body: payload }));
}

export async function updateReportDetails(id, { description_sanitized, location_description }) {
  // Never forward priority/category/identity fields from a resident edit form.
  return reportResult(await reportRequest(`/${encodeURIComponent(id)}`, {
    method: "PATCH", body: { description_sanitized, location_description },
  }));
}

// Announcements and notifications are separate demo features, not report data.
export const SAMPLE_ANNOUNCEMENTS = [
  {
    public_id: "ann_001",
    title: "Barangay De-Clogging & Cleanliness Drive",
    content:
      "De-clogging and desilting operations scheduled across Molave, Sampaguita, and Prosera Streets this Saturday starting 7:00 AM. Residents are requested to coordinate waste segregation with Barangay Agents.",
    category: "Clean & Green",
    published_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    author_name: "Admin",
  },
  {
    public_id: "ann_002",
    title: "Heavy Rainfall Alert & Emergency Hotline Standby",
    content:
      "PAGASA monsoon rains forecast for Northern Caloocan. BDRRMO response teams are stationed on 24/7 emergency alert. Report waterlogged areas immediately via GeoFix 167 or call Hotline 668-338-3141.",
    category: "BDRRMO Advisory",
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    author_name: "Admin",
  },
  {
    public_id: "ann_003",
    title: "Free Anti-Rabies Vaccination & Medical Mission",
    content:
      "Caloocan City Health Department in partnership with Barangay 167 will conduct free pet anti-rabies vaccination and adult blood pressure checkups at the Barangay Covered Court this Tuesday from 8:00 AM to 3:00 PM.",
    category: "Health & Safety",
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    author_name: "Admin",
  },
];

export const SAMPLE_NOTIFICATIONS = [
  {
    id: 1,
    title: "Team Dispatched",
    body: "A maintenance team has been dispatched to address your drainage report.",
    type: "report_update",
    ref_id: "rpt_a1b2c3d4",
    is_read: 0,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    title: "Report Submitted",
    body: "Your report about clogged drainage has been received and is under review.",
    type: "report_update",
    ref_id: "rpt_a1b2c3d4",
    is_read: 0,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    title: "Report Resolved",
    body: "Your pothole report on Balagtas St. has been resolved. Thank you for reporting!",
    type: "report_update",
    ref_id: "rpt_i9j0k1l2",
    is_read: 1,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Simulated async helpers — swap these for real axios calls later.
const delay = (ms = 300) => new Promise((res) => setTimeout(res, ms));

export async function getAnnouncements() {
  await delay();
  return { data: { announcements: SAMPLE_ANNOUNCEMENTS } };
}

export async function getNotifications() {
  await delay();
  const unread_count = SAMPLE_NOTIFICATIONS.filter((n) => !n.is_read).length;
  return { data: { notifications: SAMPLE_NOTIFICATIONS, unread_count } };
}

export async function markNotificationRead(id) {
  await delay(100);
  const n = SAMPLE_NOTIFICATIONS.find((n) => n.id === id);
  if (n) n.is_read = 1;
  return { data: { ok: true } };
}

export async function markAllNotificationsRead() {
  await delay(100);
  SAMPLE_NOTIFICATIONS.forEach((n) => { n.is_read = 1; });
  return { data: { ok: true } };
}
