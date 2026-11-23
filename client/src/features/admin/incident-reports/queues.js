import { DISPLAY_URGENCY_RANK } from "./constants";
import { displayUrgency, isEmergency } from "./utils";

export const QUEUES = [
  { key: "pending-triage", label: "Pending Triage Queue" },
  { key: "active-emergencies", label: "Active Emergencies (BDRRMO)" },
  { key: "external-agencies", label: "External Agency Requests" },
  { key: "infrastructure", label: "Infrastructure Reports" },
  { key: "dispatch-tracking", label: "Monitor Dispatch & Tracking" },
  { key: "resolved", label: "Resolved & Handed Over" },
];

const CLOSED_STATUSES = ["Verified Fixed", "Duplicate", "Handed Over", "Awaiting closure review"];

export function queuesFor(report) {
  const monitored = isEmergency(report) && (report.forwardedAt || report.statusCode === "FORWARDED_TO_BDRRMO"
    || report.dispatchedUnits?.some((unit) => unit.dispatcher_role === "bdrrmo"));
  const keys = monitored ? ["dispatch-tracking"] : [];
  if (CLOSED_STATUSES.includes(report.status)) return [...keys, "resolved"];
  if (!isEmergency(report) && report.status === "Reported") keys.push("pending-triage");
  else if (isEmergency(report)) keys.push("active-emergencies");
  else keys.push("infrastructure");
  if (report.external?.length) keys.push("external-agencies");
  return keys;
}

export const EMPTY_QUEUE_MESSAGES = {
  "pending-triage": "No reports are waiting for triage.",
  "active-emergencies": "No active emergencies right now.",
  "external-agencies": "No external agency units have been requested.",
  infrastructure: "No infrastructure reports are currently in progress.",
  "dispatch-tracking": "No emergencies forwarded yet.",
  resolved: "No resolved reports yet.",
};

const reportDateValue = (report) => {
  const parsed = Date.parse(report.submittedAt ?? report.date ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

const urgencyRank = (report) => DISPLAY_URGENCY_RANK[displayUrgency(report)] ?? 99;

export function sortReportsForQueue(reports, queue) {
  return [...reports].sort((a, b) => {
    if (queue === "resolved") {
      const dateDiff = reportDateValue(b) - reportDateValue(a);
      if (dateDiff) return dateDiff;
    }
    return urgencyRank(a) - urgencyRank(b) || reportDateValue(b) - reportDateValue(a);
  });
}

export function primaryActionLabel(report, queue) {
  if (isEmergency(report)) return "View";
  if (queue === "pending-triage") return "Review";
  if (queue === "resolved") return "View";
  return "Manage";
}
