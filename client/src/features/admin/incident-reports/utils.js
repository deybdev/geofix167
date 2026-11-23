import { reportCategories } from "../../../shared/utils/reportCategories";
import reportCatalog from "../../../../../server/src/shared/reportCatalog.json";
import { HOSPITALS, RESPONSE_FACILITIES, TANOD_BASE } from "./constants";

const NEW_CALLS = () => Date.now();

function displayUrgency(report) {
  if (report.displayUrgency) return report.displayUrgency;
  if (report.urgency === reportCatalog.adminUrgencies.critical) return "High";
  if (report.urgency === reportCatalog.adminUrgencies.standard) return "Medium";
  return "Low";
}

/* Language sanitization: builds a sanitized copy for admins. Submissions are
   never blocked or delayed — the raw report still arrives intact. */
const FLAG_PATTERNS = [
  /\bg+\s*ag+[oa]\b/gi, /\bputang(?:\s+ina)?\b/gi, /\bwalang\s+hiya\b/gi,
  /\bpunyeta\b/gi, /\btarantado\b/gi, /\bbobo\b/gi,
  /\bstupid\b/gi, /\bidiot(?:ic)?\b/gi, /\bfu+c?k+(?:ing)?\b/gi, /\bsh+i+t*\b/gi,
];
function languageScan(text) {
  const flaggedTerms = [];
  let sanitized = text;
  for (const re of FLAG_PATTERNS) {
    sanitized = sanitized.replace(re, (m) => { flaggedTerms.push(m); return "*".repeat(Math.min(8, Math.max(3, m.length))); });
  }
  return { flaggedTerms, sanitized: sanitized.replace(/\s{3,}/g, "  ").trim() };
}

const isEmergency = (report) => report.urgency !== "Non-Emergency Infrastructure";
const shortUrgency = (u) => u.replace(" Emergency", "").replace(" Infrastructure", "");

function formatApiReportDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "Date unavailable";
}

export function parseTimestamp(value) {
  if (!value) return NaN;
  const utc = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value.replace(" ", "T") + "Z" : value;
  return Date.parse(utc);
}

export function formatTimestamp(value) {
  const time = parseTimestamp(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString() : "Time unavailable";
}

export function formatForwardedTime(value) {
  return value ? "Forwarded " + formatTimestamp(value) : "Forwarding time unavailable";
}

function mapApiReport(item, fetchedAt) {
  const latitude = item.latitude == null ? null : Number(item.latitude);
  const longitude = item.longitude == null ? null : Number(item.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const classification = reportCatalog.classifications.find((entry) => entry.value === item.classification)
    ?? reportCatalog.classifications.find((entry) => entry.isEmergency === Boolean(item.is_emergency))
    ?? reportCatalog.classifications[0];
  const category = reportCatalog.categories[classification.value].includes(item.category) ? item.category : classification.defaultCategory;
  const priority = String(item.priority_code ?? "").toUpperCase();
  const urgencyKey = reportCatalog.adminUrgencyByPriority[priority] ?? "standard";
  const urgency = classification.isEmergency
    ? reportCatalog.adminUrgencies[urgencyKey]
    : reportCatalog.adminUrgencies.maintenance;
  const displayPriority = { P1: "High", P2: "High", P3: "Medium", P4: "Low" }[priority] ?? "Low";
  const address = typeof item.location_description === "string" ? item.location_description.trim() : "";
  const location = address || (hasCoordinates ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : "Location unavailable");
  const rawStatus = String(item.status_label ?? item.status_code ?? "Reported");
  const hasActiveUnits = Array.isArray(item.dispatched_units) && item.dispatched_units.length > 0;
  const status = item.status_code === "FOR_CLOSURE_REVIEW" ? "Awaiting closure review" : /resolved|closed|complete/i.test(rawStatus) ? "Verified Fixed"
    : /closure|handed/i.test(rawStatus) ? "Handed Over"
      : hasActiveUnits || /assigned|dispatched|accepted|en.route|on.scene|progress/i.test(rawStatus) ? "In Progress"
        : /submitted|pending/i.test(rawStatus) ? "Reported"
          : rawStatus;
  const reporterType = String(item.reporter_type ?? (item.guest_session_id ? "GUEST" : "RESIDENT")).toLowerCase();
  const reporter = String(item.reporter_name ?? "").trim() || (reporterType === "guest" ? "Guest" : "Resident");
  const accuracy = item.accuracy_meters == null ? null : Number(item.accuracy_meters);
  const outsideBoundary = item.within_barangay_boundary === 0 || item.within_barangay_boundary === false;
  const submittedAt = item.submitted_at ?? item.received_at;
  return {
    id: String(item.reference_number ?? item.incident_id ?? "Unknown report"),
    incidentId: String(item.incident_id ?? ""),
    title: String(item.title ?? "").trim() || "Incident report",
    category,
    categories: item.categories,
    urgency,
    displayUrgency: displayPriority,
    accident: classification.value === "sudden",
    location,
    reporter,
    reporterType: reporterType === "guest" ? "guest" : "resident",
    date: formatApiReportDate(submittedAt),
    submittedAt,
    statusCode: item.status_code,
    fetchedAt,
    history: item.history ?? [],
    forwardedAt: item.forwarded_at,
    month: submittedAt ? new Date(submittedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "",
    team: classification.isEmergency
      ? (item.dispatched_units ?? []).filter((unit) => !["DECLINED", "CANCELLED"].includes(unit.status)).map((unit) => unit.name).join(", ") || "Unassigned"
      : String(item.assigned_team ?? "").trim() || classification.assignedTeam,
    status,
    ...(hasCoordinates ? { lat: latitude, lng: longitude } : {}),
    evidence: [],
    photos: Array.isArray(item.photos) ? item.photos : [],
    dispatchedUnits: Array.isArray(item.dispatched_units) ? item.dispatched_units : [],
    agencyReports: Array.isArray(item.agency_reports) ? item.agency_reports : [],
    bdrrmoVerified: Boolean(item.bdrrmo_verified),
    bdrrmoVerificationNote: item.bdrrmo_verification_note || null,
    ...(Array.isArray(item.dispatched_units) && item.dispatched_units.length > 0
      ? {
          responders: {
            tanod:
              item.dispatched_units.find((u) => u.role === "tanod")?.name
              || item.dispatched_units[0]?.name
              || String(item.assigned_team ?? "Dispatched Responder"),
            vehicle: "Mobile Unit",
            sent: item.dispatched_units[0]?.dispatched_at || "Dispatched",
            accepted: item.dispatched_units.some((u) => u.status !== "DISPATCHED")
              ? "Accepted"
              : null,
          },
          fieldStage: item.dispatched_units.some((u) => u.status === "COMPLETED")
            ? "Completed"
            : item.dispatched_units.some((u) => u.status === "ON_SCENE")
              ? "On Scene"
              : item.dispatched_units.some((u) => ["ACCEPTED", "EN_ROUTE"].includes(u.status))
                ? "En Route"
                : "Assigned",
          external: item.dispatched_units
            .filter((u) => u.role === "police" || u.role === "fire")
            .map((u) => `${u.name}: ${u.status}`),
        }
      : {}),
    geotag: {
      source: hasCoordinates ? "Pinned location" : "Location note",
      accuracy: accuracy == null ? "Not provided" : `±${Math.round(accuracy)} m`,
      landmark: location,
      ...(accuracy != null && accuracy > 100 ? { note: "GPS accuracy is over 100 m; the reporter was prompted to adjust the pin." } : {}),
    },
    ...(outsideBoundary ? { outsideBarangayBoundary: true } : {}),
    originalText: item.description_original ?? "",
    text: String(item.sanitized_description ?? item.description_sanitized ?? item.description_original ?? "").trim(),
  };
}

function downloadReportsCsv(reports) {
  const columns = ["ID", "Incident Details", "Category", "Urgency", "Location", "Reporter", "Date Reported", "Assigned Team", "Status", "Photo Count"];
  const rows = reports.map((report) => [
    report.id, report.title, reportCategories(report).join("; "), displayUrgency(report), report.location, report.reporter,
    report.date, report.team, report.status, report.photos?.length ?? 0,
  ]);
  const csv = [columns, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "geofix-incident-reports.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/* Privacy-safe accomplishment summary: strips exact addresses, coordinates,
   and any personal identifiers before publishing to the public dashboard. */
function privacySummary(report) {
  const why = report.closure?.reason ? " (closed with documented no-proof reason)" : "";
  return `${report.category} incident — ${report.location}. Reported ${report.date}, resolved and verified${why}. Handled by barangay response units. Exact addresses, coordinates and personal identifiers are intentionally excluded.`;
}

/* ------------------------------ Geo helpers ------------------------------ */

function routeBetween(from, to) {
  const mid = { lat: (to.lat + from.lat) / 2, lng: (to.lng + from.lng) / 2 };
  const bend = { lat: mid.lat + (to.lng - from.lng) * 0.14, lng: mid.lng - (to.lat - from.lat) * 0.14 };
  return [{ lat: from.lat, lng: from.lng }, bend, { lat: to.lat, lng: to.lng }];
}

function facilityFor(agencyKey, report) {
  if (agencyKey === "hospital") {
    return HOSPITALS.find((h) => h.key === report.dispatchHospital) ?? HOSPITALS[0];
  }
  if (agencyKey === "hall") return TANOD_BASE;
  return RESPONSE_FACILITIES[agencyKey];
}

function routePoints(agencyKey, report) {
  return routeBetween(facilityFor(agencyKey, report), report);
}

function pointAtFraction(points, t) {
  const seg = (point, start) => Math.hypot(point.lat - start.lat, point.lng - start.lng);
  const total = points.slice(1).reduce((sum, point, index) => sum + seg(point, points[index]), 0);
  let walked = t * total;
  for (let index = 0; index < points.length - 1; index += 1) {
    const span = seg(points[index + 1], points[index]);
    if (walked <= span || index === points.length - 2) {
      const ratio = span ? Math.min(1, walked / span) : 1;
      return {
        lat: points[index].lat + (points[index + 1].lat - points[index].lat) * ratio,
        lng: points[index].lng + (points[index + 1].lng - points[index].lng) * ratio,
      };
    }
    walked -= span;
  }
  return points[points.length - 1];
}

function distanceKm(point, facility) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (facility.lat - point.lat) * rad, dLng = (facility.lng - point.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(point.lat * rad) * Math.cos(facility.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function facilityInfo(agencyKey, report) {
  const facility = facilityFor(agencyKey, report);
  const km = Number(distanceKm(report, facility).toFixed(1));
  const mins = Math.max(2, Math.round((km / 28) * 60) + 1);
  return { name: facility.name, via: facility.via, km, eta: `${mins} mins` };
}

export {
  NEW_CALLS, displayUrgency, languageScan, isEmergency, shortUrgency,
  formatApiReportDate, mapApiReport, downloadReportsCsv, privacySummary,
  routeBetween, facilityFor, routePoints, pointAtFraction, distanceKm, facilityInfo,
};
