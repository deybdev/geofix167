import { DISPLAY_URGENCY_RANK } from "./constants";
import { displayUrgency, isEmergency } from "./utils";

/* Queue tabs: job-oriented views. Every report has exactly one primary queue;
   reports with requested external units additionally appear under External
   Agency Requests, and dispatched emergencies with an active field assignment
   also surface on the Monitor Dispatch & Tracking board. */
export const QUEUES = [
  { key: "pending-triage", label: "Pending Triage Queue" },
  { key: "active-emergencies", label: "Active Emergencies (BDRRMO)" },
  { key: "external-agencies", label: "External Agency Requests" },
  { key: "infrastructure", label: "Infrastructure Reports" },
  { key: "dispatch-tracking", label: "Monitor Dispatch & Tracking" },
  { key: "resolved", label: "Resolved & Handed Over" },
];

const CLOSED_STATUSES = ["Verified Fixed", "Duplicate", "Handed Over"];

export function queuesFor(report) {
  if (CLOSED_STATUSES.includes(report.status)) return ["resolved"];
  const keys = [];
  if (report.status === "Reported" || report.status === "BDRRMO Takeover") keys.push("pending-triage");
  else if (isEmergency(report)) keys.push("active-emergencies");
  else keys.push("infrastructure");
  if (report.external?.length) keys.push("external-agencies");
  if (report.responders && isEmergency(report) && report.status === "In Progress" && report.fieldStage !== "Completed") {
    keys.push("dispatch-tracking");
  }
  return keys;
}

export const EMPTY_QUEUE_MESSAGES = {
  "pending-triage": "No reports are waiting for triage.",
  "active-emergencies": "No active emergencies right now.",
  "external-agencies": "No external agency units have been requested.",
  infrastructure: "No infrastructure reports are currently in progress.",
  "dispatch-tracking": "No active responder assignments — assign one via Field Ops on an active emergency.",
  resolved: "No resolved reports yet.",
};

const reportDateValue = (report) => {
  const parsed = Date.parse(report.submittedAt ?? report.date ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
};

const urgencyRank = (report) => DISPLAY_URGENCY_RANK[displayUrgency(report)] ?? 99;

/* Queue-aware ordering: triage is SLA-first (takeovers, then the longest
   waiting timer); the archive is newest-first; every other queue keeps the
   most urgent report on top and breaks ties by recency. */
export function sortReportsForQueue(reports, queue) {
  return [...reports].sort((a, b) => {
    if (queue === "pending-triage") {
      const takeoverRank = (report) => (report.status === "BDRRMO Takeover" ? 0 : 1);
      const takeoverDiff = takeoverRank(a) - takeoverRank(b);
      if (takeoverDiff) return takeoverDiff;
      const slaA = Number.isFinite(a.sla?.start) ? a.sla.start : Number.POSITIVE_INFINITY;
      const slaB = Number.isFinite(b.sla?.start) ? b.sla.start : Number.POSITIVE_INFINITY;
      if (slaA !== slaB) return slaA - slaB;
    }
    if (queue === "resolved") {
      const dateDiff = reportDateValue(b) - reportDateValue(a);
      if (dateDiff) return dateDiff;
    }
    return urgencyRank(a) - urgencyRank(b) || reportDateValue(b) - reportDateValue(a);
  });
}

export function primaryActionLabel(report, queue) {
  if (queue === "pending-triage") return "Triage";
  if (queue === "active-emergencies" && report.responders) return "Track";
  if (queue === "resolved") return "View";
  return "Manage";
}
