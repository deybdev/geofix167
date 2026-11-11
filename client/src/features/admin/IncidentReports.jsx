import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ambulance, Ban, Bell, Camera, CheckCircle2, Clock,
  Download, Eye, EyeOff, FileText, FileUp, Flame, Flag, GitMerge,
  History, Languages, Link2, Lock, MapPinned, MoreVertical,
  QrCode, Radio, RotateCcw, ScanLine, Search, Share2, ShieldCheck, Siren,
  TriangleAlert, Video, Wrench, UserCheck, X,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import MapViewer from "../../shared/components/MapViewer";
import {
  Badge, ModalSection, ModalShell, QRMatrix, RowList, SelectFilter, fmtClock, hash32, stamp,
} from "../../shared/components/GovernanceUi";

/* ----------------------------------------------------------------------- */
/* Seed data                                                                */
/* ----------------------------------------------------------------------- */

const NEW_CALLS = () => Date.now();

const initialReports = () => [
  {
    id: "GF-001", title: "Vehicular Accident on Rizal Street", category: "Incident / Emergency",
    urgency: "Critical Emergency", accident: true, location: "Rizal Street",
    reporter: "Marvin Navarrete", reporterType: "resident", date: "April 22, 2026",
    team: "BDRRMO Response", status: "In Progress", lat: 14.6538, lng: 121.0325,
    evidence: ["photo", "video"],
    geotag: { source: "Device GPS", accuracy: "±4 m", landmark: "Rizal St frontage, Barangay 167" },
    text: "Two-vehicle collision in front of the Barangay Hall. One driver is bleeding from a head wound, two passengers complain of minor bruises.",
    medical: {
      injuries: "Driver — head laceration; two passengers — minor bruises",
      capability: "Trauma",
      hospital: "Rizal Medical Center",
      route: "Rizal St → Quezon Ave → Del Pilar Rd (4 mins)",
      transport: true,
    },
    qr: { hospital: "Rizal Medical Center", description: "Two-vehicle collision near the barangay hall; one driver admitted for observation.", contact: "Marvin Navarrete • 0917-555-0167" },
    external: ["Fire Station: Confirmed • Unit: FT-02 • ETA: 5 mins", "Police Station: Requested"],
    responders: { tanod: "T-01", vehicle: "V-01", accepted: "April 22, 2026 • 08:12", sent: "April 22, 2026 • 08:10" },
    fieldStage: "Handover",
    handover: { scannedBy: "Rizal Medical Center — ER Desk", at: "April 22, 2026 • 08:34", token: "GF-001-HV-8241" },
  },
  {
    id: "GF-002", title: "Broken Streetlight Pole", category: "Electrical",
    urgency: "Non-Emergency Infrastructure", location: "Quezon Avenue",
    reporter: "Rain Opinion", reporterType: "resident", date: "April 21, 2026",
    team: "Engineering Crew B", status: "In Progress", lat: 14.7321, lng: 121.0192,
    evidence: ["photo"],
    geotag: { source: "Device GPS", accuracy: "±6 m", landmark: "Quezon Ave, Barangay 167" },
    text: "Pole 14 on Quezon Avenue leans badly after last night's storm. One lamp stays dark and the wires hang low over the sidewalk.",
  },
  {
    id: "GF-003", title: "Clogged Drainage Canal", category: "Sanitation",
    urgency: "Non-Emergency Infrastructure", location: "Magsaysay Boulevard",
    reporter: "Ellyz Gomez", reporterType: "resident", date: "April 20, 2026",
    team: "Barangay Sanitizers", status: "Verified Fixed", lat: 14.7269, lng: 121.0174,
    evidence: ["photo"],
    geotag: { source: "Device GPS", accuracy: "±4 m", landmark: "Magsaysay Blvd, Barangay 167" },
    text: "Canal grate across from the market is fully blocked; water has started to backflow onto the road.",
    closure: { proof: "clearance-photos.zip", at: "April 20, 2026 • 16:40", by: "Admin — N. Villanueva" },
    published: { at: "April 20, 2026 • 17:05", summary: "Sanitation incident on Magsaysay Boulevard resolved and verified." },
  },
  {
    id: "GF-004", title: "Exposed Power Lines", category: "Electrical",
    urgency: "Standard Emergency", location: "Roxas Boulevard",
    reporter: "Cataluna Jhone", reporterType: "resident", date: "April 19, 2026",
    team: "BDRRMO Response", status: "Reported", lat: 14.7307, lng: 121.0138,
    evidence: ["photo", "video"],
    geotag: {
      source: "Manual pin — no GPS fix",
      accuracy: "Landmark-anchored",
      landmark: "Beside Meralco pole 12, Roxas Boulevard",
      note: "GPS unavailable. Pin dropped manually and anchored to the landmark — coordinates were never fabricated.",
    },
    text: "Live power lines snapped in the storm and are hanging across the pedestrian lane near Roxas Boulevard. One resident got a minor shock.",
    medical: { injuries: "One resident treated on-site for minor electric shock", capability: "First Aid", hospital: "Barangay Health Station 167", route: "Roxas Blvd → Rizal St (6 mins)", transport: false },
    sla: { start: NEW_CALLS() - 27000 },
  },
  {
    id: "GF-005", title: "Cracked Sidewalk Path", category: "Road Damage",
    urgency: "Non-Emergency Infrastructure", location: "Bonifacio Street",
    reporter: "Rain Santiago", reporterType: "guest",
    guestLink: { token: "GV-7D92K1", issued: "April 18, 2026", expires: "April 25, 2026" },
    date: "April 18, 2026", team: "Barangay Public Works", status: "Verified Fixed",
    lat: 14.7292, lng: 121.0161, evidence: ["photo"],
    geotag: { source: "Pin drag adjusted", accuracy: "±9 m", landmark: "Bonifacio St, Barangay 167" },
    text: "The sidewalk panels along Bonifacio Street caved during the pipe works. Students pass this stretch every morning.",
    closure: { proof: "repair-receipt.jpg", at: "April 18, 2026 • 11:15", by: "Admin — N. Villanueva" },
  },
  {
    id: "GF-006", title: "Vandalized Water Main", category: "Incident / Emergency",
    urgency: "Critical Emergency", accident: false, location: "Magsaysay Boulevard",
    reporter: "Efren Cahilig", reporterType: "resident", date: "April 17, 2026",
    team: "BDRRMO Response", status: "In Progress", lat: 14.7269, lng: 121.0174,
    evidence: ["photo"],
    geotag: { source: "Device GPS", accuracy: "±5 m", landmark: "Magsaysay Blvd, Barangay 167" },
    text: "Gago talaga ang nagbukas ng water main sa gilid ng palengke!! Putang inang mga walang hiya, tagal pa ng aksyon ninyo, punyeta na talaga.",
    emergencyVerified: true,
    medical: { injuries: "No injuries reported", capability: "First Aid", hospital: "Barangay Health Station 167", route: "Magsaysay Blvd → Health Station (2 mins)", transport: false },
    qr: { hospital: "Barangay Health Station", description: "Damaged water main flooding the roadside near the market.", contact: "Efren Cahilig • 0918-442-7781" },
    external: ["Police Station: Confirmed • Unit: PN-07 • ETA: 8 mins"],
    responders: { tanod: "T-02", vehicle: "V-02", accepted: "April 17, 2026 • 05:58", sent: "April 17, 2026 • 05:55" },
    fieldStage: "En Route",
  },
  {
    id: "GF-007", title: "Standing Floodwater Near the School", category: "Sanitation",
    urgency: "Standard Emergency", location: "Del Pilar Road",
    reporter: "Danny Delgado", reporterType: "resident", date: "April 16, 2026",
    team: "BDRRMO Response", status: "Reported", lat: 14.7315, lng: 121.0145,
    evidence: ["photo"],
    geotag: { source: "Device GPS", accuracy: "±4 m", landmark: "Del Pilar Rd school frontage" },
    text: "Floodwater has pooled along the whole school frontage on Del Pilar Road. Two kids already slipped on the algae film this morning.",
    medical: { injuries: "No injuries reported", capability: "First Aid", transport: false },
    emergencyVerified: true,
    sla: { start: NEW_CALLS() - 9000 },
  },
];

const statuses = ["All Statuses", "Reported", "In Progress", "BDRRMO Takeover", "Verified Fixed", "Duplicate"];
const categories = ["All Categories", "Road Damage", "Electrical", "Sanitation", "Incident / Emergency"];
const locations = ["All Locations", "Rizal Street", "Quezon Avenue", "Magsaysay Boulevard", "Roxas Boulevard", "Bonifacio Street", "Del Pilar Road"];

const URGENCY_OPTS = ["Critical Emergency", "Standard Emergency", "Non-Emergency Infrastructure"];
const URGENCY_STYLES = {
  "Critical Emergency": "gf-badge gf-badge--critical",
  "Standard Emergency": "gf-badge gf-badge--emergency",
  "Non-Emergency Infrastructure": "gf-badge gf-badge--nonemergency",
};
const STATUS_STYLES = {
  Reported: "gf-badge gf-badge--reported",
  "In Progress": "gf-badge gf-badge--progress",
  "BDRRMO Takeover": "gf-badge gf-badge--takeover",
  "Verified Fixed": "gf-badge gf-badge--fixed",
  Duplicate: "gf-badge gf-badge--duplicate",
};

/* Workflow tabs: Pending = needs a triage decision (incl. escalated takeovers);
   Active = dispatched emergencies; Infrastructure = non-emergency work; Resolved. */
const TABS = ["Pending Triage", "Active Emergencies", "Infrastructure & Routine", "Resolved & Handed Over"];
function bucketFor(report) {
  if (report.status === "Reported" || report.status === "BDRRMO Takeover") return "Pending Triage";
  if (report.status === "Verified Fixed") return "Resolved & Handed Over";
  return isEmergency(report) ? "Active Emergencies" : "Infrastructure & Routine";
}

const ROUTES = [["BDRRMO (Emergency)", Siren], ["Barangay Maintenance (Infrastructure)", Wrench]];

/* External units requestable through BDRRMO dispatch. */
const EXTERNAL_AGENCIES = {
  police: { label: "Nearest Police Station", confirmed: "Police Station", icon: Siren, unit: "PN-07", eta: "8 mins" },
  fire: { label: "Nearest Fire Station", confirmed: "Fire Station", icon: Flame, unit: "FT-02", eta: "5 mins" },
  hospital: { label: "Nearest Hospital", confirmed: "Hospital", icon: Ambulance, unit: "AMB-03", eta: "6 mins" },
};

const TEAM_OPTIONS = ["BDRRMO Response", "Maintenance Team A", "Engineering Crew B", "Barangay Sanitizers", "Meralco Dispatch", "Barangay Public Works"];

/* Mocked response facilities around Barangay 167. */
const RESPONSE_FACILITIES = {
  police: { name: "Police Community Precinct 7", lat: 14.7331, lng: 121.0158, via: "Quezon Ave" },
  fire: { name: "Caloocan Fire Sub-Station 167", lat: 14.7301, lng: 121.0201, via: "Rizal St Ext." },
};
const TANOD_BASE = { name: "Barangay Hall 167", lat: 14.7305, lng: 121.0155, via: "Quezon Ave" };
const FACILITY_PIN_CATEGORY = { police: "crime", fire: "fire", hospital: "incident", hall: "infrastructure" };

/* Hospitals with treatment capabilities for capability-based routing. */
const HOSPITALS = [
  { key: "rizal-med", name: "Rizal Medical Center", lat: 14.7284, lng: 121.0106, via: "Magsaysay Blvd", capabilities: ["Trauma", "Surgery", "Imaging", "Maternity"] },
  { key: "caloocan-gen", name: "Caloocan General Hospital", lat: 14.7271, lng: 121.0232, via: "Rizal St Ext.", capabilities: ["Trauma", "Burn Care", "ICU", "Imaging"] },
  { key: "health-station", name: "Barangay Health Station 167", lat: 14.7269, lng: 121.0174, via: "Magsaysay Blvd", capabilities: ["First Aid", "Outpatient"] },
];
const CAPABILITY_OPTS = [...new Set(HOSPITALS.flatMap((h) => h.capabilities))];

const ROAD_CLOSURES = {
  police: [
    { road: "Quezon Ave", section: "Between Del Pilar Rd & Rizal St", note: "Pipe-laying works — single-lane alternating" },
    { road: "Rizal St Ext.", section: "Length of Barangay 167", note: "Clear, no obstructions" },
  ],
  fire: [
    { road: "Rizal St Ext.", section: "Near public market", note: "Market congestion — expect slowdown" },
    { road: "Sampaguita St", section: "Rail-side segment", note: "Partial closure for drainage repair" },
  ],
  hospital: [
    { road: "Magsaysay Blvd", section: "Approach to Health Station", note: "Road repair — reduced to one lane" },
    { road: "Barangay Road 3", section: "School frontage", note: "Clear, no obstructions" },
  ],
};

/* Field responder roster (Tanods + vehicles) available for assignment. */
const TANODS = [
  { id: "T-01", name: "Tanod R. Villa", beat: "Zone 1 — Rizal St / Quezon Ave", status: "Available" },
  { id: "T-02", name: "Tanod J. Pascual", beat: "Zone 2 — Magsaysay Blvd", status: "Available" },
  { id: "T-03", name: "Tanod A.Bueno", beat: "Zone 3 — Roxas Blvd", status: "Off duty" },
];
const VEHICLES = [
  { id: "V-01", type: "Barangay Patrol Jeep", plate: "BGY-1671", status: "Available" },
  { id: "V-02", type: "Response Motorcycle", plate: "BGY-0228", status: "Available" },
  { id: "V-03", type: "Rescue Pickup", plate: "BGY-9914", status: "In maintenance" },
];

const FIELD_STAGES = ["Assigned", "En Route", "On Scene", "Handover", "Completed"];
const STAGE_TARGETS = { Assigned: 0, "En Route": 0.5, "On Scene": 1, Handover: 1, Completed: 1 };
const TRACK_STAGES = ["Requested", "En route", "On site"];
const STAGE_PROGRESS = [0.18, 0.62, 1];

/* SLA windows: 30s admin reminder, 60s automatic BDRRMO takeover. */
const REMINDER_MS = 30000;
const TAKEOVER_MS = 60000;

/* Evidence gate alternatives when proof is unavailable. */
const CLOSURE_REASONS = [
  "Scene stabilized without footage (too dangerous to record)",
  "Responder equipment failed — media lost",
  "Repair verified in person; no media captured",
];

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

/* ------------------------------ Shared UI -------------------------------- */

/* ------------------------- Incident details modal ------------------------ */

function IncidentDrawer({ report, onClose, onResolve, onPublish, onOpenAudit, onDispatch, logAudit }) {
  const [classification, setClassification] = useState(report.urgency);
  const [team, setTeam] = useState(TEAM_OPTIONS[2]);
  const [closingMode, setClosingMode] = useState("proof");
  const [proof, setProof] = useState(null);
  const [reason, setReason] = useState(CLOSURE_REASONS[0]);
  const [explanation, setExplanation] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const resolved = report.status === "Verified Fixed";
  const language = useMemo(() => languageScan(report.text), [report.text]);
  const canResolve = closingMode === "proof" ? Boolean(proof) : Boolean(reason && explanation.trim().length >= 10);

  function toggleRaw() {
    const next = !showRaw;
    setShowRaw(next);
    if (next) logAudit({ reportId: report.id, actor: "Admin", action: "Unfiltered text view", detail: "Admin viewed the original un-sanitized report text." });
  }

  function resolve() {
    if (!canResolve || resolved) return;
    const changes = { status: "Verified Fixed" };
    if (closingMode === "proof") {
      changes.closure = { proof, at: stamp(true), by: "Admin" };
    } else {
      changes.closure = { reason, note: explanation.trim(), at: stamp(true), by: "Admin" };
    }
    onResolve(report.id, changes, closingMode === "proof" ? "proof" : "no-proof");
    onClose();
  }

  function publish() {
    if (!resolved || report.published) return;
    onPublish(report.id);
  }

  function applyDispatch() {
    const maintenance = classification === "Non-Emergency Infrastructure";
    const changes = {
      urgency: classification,
      routedTo: maintenance ? "Barangay Maintenance (Infrastructure)" : "BDRRMO (Emergency)",
      team: maintenance ? team : "BDRRMO Response",
      status: "In Progress",
      emergencyVerified: maintenance ? undefined : (report.emergencyVerified ?? true),
    };
    logAudit({ reportId: report.id, actor: "Admin", action: "Triage & dispatch", detail: `Classified “${classification}” → ${changes.routedTo}${maintenance ? ` • assigned ${team}` : ""}.` });
    onDispatch(report.id, changes);
    onClose();
  }

  return (
    <>
      <div className="gf-drawer-backdrop" onClick={onClose} />
      <aside className="gf-drawer" role="dialog" aria-modal="true" aria-label={`Incident details ${report.id}`}>
        <header className="flex items-start justify-between gap-3 border-b border-[#e2e8eb] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-(--gf-green)">{report.id} • {report.category}</p>
            <h2 className="truncate text-[12px] font-bold text-[#263246]">{report.title}</h2>
          </div>
          <button type="button" className="gf-btn gf-btn--icon" onClick={onClose} aria-label="Close details"><X size={12} /></button>
        </header>
        <div className="gf-drawer-body">
          <ModalSection title="Intake & Geotagged Location">
          <RowList rows={[
            ["Report ID", report.id],
            ["Reporter", report.reporter],
            ["Reporter Pathway", report.reporterType === "guest"
              ? <Badge key="p" label="Guest — secure 7-day link" styles="gf-badge gf-badge--guest" />
              : <Badge key="p" label="Verified Resident (masterlist match)" styles="gf-badge gf-badge--resident" />],
            ["Date Reported", report.date],
            ["Urgency", shortUrgency(report.urgency)],
            ["Location", `${report.location}, Barangay 167`],
          ]} />
          {report.guestLink && (
            <div className="gf-note mt-2" style={{ borderColor: "#c9d7f2", background: "#f5f8ff" }}>
              <Link2 size={14} style={{ marginTop: 2, color: "#4c6fbf" }} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[#3d5175]">Guest tracking link (read-only)</p>
                <p className="mt-0.5">Token <span className="font-mono">{report.guestLink.token}</span> • issued {report.guestLink.issued} • expires {report.guestLink.expires}. The guest can track this case read-only for 7 days;
                  <button type="button" className="ml-1 underline" onClick={() => { try { navigator.clipboard?.writeText(`https://geofix167.ph/track/${report.guestLink.token}`); } catch { /* clipboard unavailable */ } toast.add({ type: "success", title: "Link copied", description: "Read-only guest tracking link copied." }); }}>copy link</button>
                </p>
              </div>
            </div>
          )}
          <div className="gf-note mt-2">
            <MapPinned size={14} style={{ marginTop: 2, color: "var(--gf-green)" }} />
            <div>
              <p><strong>{report.geotag.source}</strong> • accuracy {report.geotag.accuracy} • landmark: {report.geotag.landmark}</p>
              {report.geotag.note && <p className="mt-0.5 text-[#b45309]">{report.geotag.note}</p>}
              <p className="mt-0.5 text-[#a8b6c6]">The system never generates default or fabricated coordinate fallbacks when GPS fails.</p>
            </div>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[300px]">
              <MapViewer compact incidents={[{ id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng }]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-[9px] font-bold text-[#60738f]">
              <span>{report.location}, Barangay 167</span>
              <span>{report.lat.toFixed(4)} N, {report.lng.toFixed(4)} E</span>
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Multimedia Evidence (Optional)">
          {report.evidence.length ? (
            <div className="grid grid-cols-2 gap-2">
              {report.evidence.includes("photo") && (
                <div className="flex h-[120px] items-center justify-center gap-1 rounded-lg border border-[#dfe7ea] bg-[linear-gradient(150deg,#efe9dd_0%,#cdbfa8_55%,#8f8168_100%)] text-[#5c5343]"><Camera size={18} /><span className="text-[9px] font-bold">photo-evidence.jpg</span></div>
              )}
              {report.evidence.includes("video") && (
                <div className="flex h-[120px] items-center justify-center gap-1 rounded-lg border border-[#dfe7ea] bg-[linear-gradient(150deg,#33312c_0%,#6b665a_60%,#a39c8d_100%)] text-white"><Video size={18} /><span className="text-[9px] font-bold">clip-evidence.mp4 • 0:42</span></div>
              )}
            </div>
          ) : (
            <div className="gf-note gf-note--soft">
              <ShieldCheck size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span>No media attached. Uploading photo/video evidence stays optional so reporters in unsafe situations are never required to record.</span>
            </div>
          )}
        </ModalSection>

        <ModalSection title="Report Language (Auto-Sanitized)">
          <div className="gf-note gf-note--soft" style={{ alignItems: "center" }}>
            <Languages size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
            <span>Submission was never blocked or delayed. {language.flaggedTerms.length ? "Flagged terms were masked for all staff views:" : "No flagged language detected."}</span>
          </div>
          {language.flaggedTerms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {language.flaggedTerms.map((term, i) => <span key={`${term}-${i}`} className="gf-badge gf-badge--alert">{term.trim()} → masked</span>)}
            </div>
          )}
          <div className="mt-2 rounded-lg border border-[#e0e7eb] bg-white p-3 text-[10px] leading-4 text-[#42506a]">
            <p className="mb-1 text-[8px] font-bold uppercase text-[#7184a0]">Sanitized copy (default view)</p>
            <p>{language.sanitized}</p>
          </div>
          <div className="mt-1.5 rounded-lg border border-dashed border-[#e7c9c9] bg-[#fffafa] p-3 text-[10px] leading-4 text-[#7a3040]">
            <p className="mb-1 flex items-center gap-1 text-[8px] font-bold uppercase text-[#b04646]">
              <button type="button" onClick={toggleRaw} aria-pressed={showRaw} className="flex items-center gap-1 uppercase" style={{ fontSize: 8 }}>
                {showRaw ? <EyeOff size={9} /> : <Eye size={9} />}{showRaw ? "Hide" : "Show"} unfiltered view (admin only)
              </button>
            </p>
            {showRaw && <p>{report.text}</p>}
            {!showRaw && <p className="text-[#b9c6d2]">Hidden. Every unfiltered view is written to the immutable audit trail.</p>}
          </div>
        </ModalSection>

        {isEmergency(report) && report.medical && (
          <ModalSection title="On-Scene & Medical Tracking (BDRRMO)">
            <RowList rows={[
              ["Identified Injuries", report.medical.injuries],
              ["Capability Match", report.medical.capability],
              ["Routed Hospital", report.medical.hospital],
              ["Route to Hospital", report.medical.route ?? "—"],
            ]} />
          </ModalSection>
        )}

        {report.external?.length > 0 && (
          <ModalSection title="External Unit Status">
            <div className="grid gap-1.5">
              {report.external.map((unit) => <p key={unit} className="rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2.5 py-2 text-[9px] font-medium text-[#60738f]"><Siren size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4, color: "var(--gf-green)" }} />{unit}</p>)}
            </div>
          </ModalSection>
        )}

        {report.duplicateOf && (
          <ModalSection title="Duplicate Handling">
            <div className="gf-note gf-note--soft">
              <GitMerge size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span>This report is linked to master incident <strong>{report.duplicateOf}</strong>. It stays for the record but no longer drives dispatch on its own.</span>
            </div>
          </ModalSection>
        )}

        {(report.responders || report.fieldStage) && (
          <ModalSection title="Responder & Field Status">
            {report.responders && <RowList rows={[
              ["Assigned Tanod", `${TANODS.find((t) => t.id === report.responders.tanod)?.name ?? report.responders.tanod} (${report.responders.tanod})`],
              ["Vehicle", `${VEHICLES.find((v) => v.id === report.responders.vehicle)?.type ?? report.responders.vehicle}`],
              ["Acceptance", report.responders.accepted ? `Accepted • ${report.responders.accepted}` : "Awaiting acceptance"],
              ["Privacy-scoped GPS", report.gpsEnded ? "Off — duty completed" : "On during response only"],
            ]} />}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {FIELD_STAGES.map((stage) => {
                const index = FIELD_STAGES.indexOf(report.fieldStage ?? "Assigned");
                const done = FIELD_STAGES.indexOf(stage) < index;
                const active = stage === report.fieldStage;
                return (
                  <span key={stage} className={`gf-stage ${active ? "text-[#e69500]" : done ? "text-(--gf-green)" : "text-[#a0b0c0]"}`}>
                    <span className={`gf-stage-dot ${done ? "gf-stage-dot--done" : active ? "gf-stage-dot--active" : "gf-stage-dot--locked"}`}>{done ? "✓" : ""}</span>
                    {stage}
                  </span>
                );
              })}
            </div>
            {report.handover && (
              <div className="gf-note gf-note--soft mt-2">
                <QrCode size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                <span>QR handover acknowledged by <strong>{report.handover.scannedBy}</strong> • {report.handover.at}</span>
              </div>
            )}
          </ModalSection>
        )}

        {report.qr && (
          <ModalSection title="QR Follow-up Data">
            <RowList rows={[["Admitting Hospital", report.qr.hospital], ["Incident Description", report.qr.description], ["Contact Person", report.qr.contact]]} />
          </ModalSection>
        )}

        <ModalSection title="Evidence-Gated Closure">
          {resolved ? (
            <RowList rows={[
              ["Closure mode", report.closure?.reason ? "Documented no-proof reason" : "Proof uploaded"],
              report.closure?.reason ? ["Reason", `${report.closure.reason} — ${report.closure.note}`] : ["Proof", report.closure?.proof],
              ["Closed at", `${report.closure?.at ?? "—"} by ${report.closure?.by ?? "—"}`],
            ]} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={`gf-option ${closingMode === "proof" ? "gf-option--active" : ""}`} onClick={() => setClosingMode("proof")}>
                  <FileUp size={13} />
                  <span>Upload proof of response/repair</span>
                </button>
                <button type="button" className={`gf-option ${closingMode === "reason" ? "gf-option--active" : ""}`} onClick={() => setClosingMode("reason")}>
                  <FileText size={13} />
                  <span>Document why proof is unavailable</span>
                </button>
              </div>
              {closingMode === "proof" && (
                <>
                  <label htmlFor="proof-upload" className="mt-2 flex flex-col items-center gap-1 rounded-lg border border-dashed border-(--gf-green-border) bg-[#f8fafb] p-4 text-center hover:border-(--gf-green)">
                    <FileUp size={18} style={{ color: "var(--gf-green)" }} />
                    <span className="text-[10px] font-bold text-[#263246]">Upload proof of response/repair</span>
                    <span className="text-[9px] text-[#60738f]">Photos or video of the completed repair or response.</span>
                    <input id="proof-upload" type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => event.target.files[0] && setProof(event.target.files[0].name)} />
                  </label>
                  {proof && <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-(--gf-green)"><CheckCircle2 size={12} />{proof} uploaded.</p>}
                </>
              )}
              {closingMode === "reason" && (
                <div className="mt-2 grid gap-2">
                  <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Reason
                    <select className="gf-select" value={reason} onChange={(event) => setReason(event.target.value)} style={{ color: "#42506a", height: 32 }}>
                      {CLOSURE_REASONS.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Explanation (min 10 characters)
                    <textarea rows={2} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="e.g. Live wires removed by Meralco at 21:40; recording was unsafe…" className="rounded-md border border-[#d5dee3] px-2 py-1.5 text-[10px] outline-none focus:border-(--gf-green)" />
                  </label>
                  <p className="text-[9px] text-[#7184a0]">Closing without media still requires this documented reason — the closure is recorded in the audit trail either way.</p>
                </div>
              )}
            </>
          )}
        </ModalSection>

        {report.published && (
          <ModalSection title="Publishing">
            <div className="gf-note gf-note--soft">
              <CheckCircle2 size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span>Published {report.published.at} — “{report.published.summary}”</span>
            </div>
          </ModalSection>
        )}

        {!resolved && (
          <ModalSection title="Urgency Classification & Team Assignment">
            <div className="grid grid-cols-3 gap-2">
              {URGENCY_OPTS.map((option) => (
                <button key={option} type="button" aria-pressed={classification === option} onClick={() => setClassification(option)}
                  className={`gf-option ${classification === option ? "gf-option--active" : ""}`}>
                  {option === "Critical Emergency" ? <Siren size={13} /> : option === "Standard Emergency" ? <Bell size={13} /> : <Wrench size={13} />}
                  <span>{shortUrgency(option)}</span>
                </button>
              ))}
            </div>
            {classification === "Non-Emergency Infrastructure" ? (
              <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Assign maintenance team
                <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={team} onChange={(event) => setTeam(event.target.value)}>
                  {TEAM_OPTIONS.slice(1).map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
            ) : (
              <div className="gf-note gf-note--soft">
                <Siren size={13} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                <span>Emergencies route to BDRRMO Response. Use <strong>More Options → Request Police / Fire Backup</strong> for parallel external units.</span>
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" className="gf-btn gf-btn--primary" onClick={applyDispatch}>
                {classification === "Non-Emergency Infrastructure" ? "Classify & Assign Team" : "Confirm Dispatch"}
              </button>
            </div>
          </ModalSection>
        )}
      </div>
      <footer className="gf-modal-foot" style={{ justifyContent: "space-between", borderTop: "1px solid #e2e8eb" }}>
        <p className="min-w-0 flex-1 text-[9px] text-[#7184a0]">
          {resolved
            ? (report.closure?.reason ? "Closed with a documented no-proof reason." : "Resolution proof is recorded.")
            : (closingMode === "proof"
              ? "Closure is evidence-gated: upload proof of response/repair."
              : "Document why proof is unavailable to close without media.")}
        </p>
        {!report.published && resolved && (
          <button type="button" className="gf-btn gf-btn--cancel" onClick={publish}>
            <Share2 size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Publish Privacy-Safe Summary
          </button>
        )}
        {report.published && <span className="gf-badge gf-badge--fixed"><CheckCircle2 size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />Published</span>}
        <button type="button" className="gf-btn gf-btn--cancel" onClick={() => onOpenAudit(report.id)}><History size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Audit</button>
        <button type="button" disabled={resolved || !canResolve} className="gf-btn gf-btn--primary" onClick={resolve}>Mark as Resolved</button>
      </footer>
      </aside>
    </>
  );
}

/* --------------------------- Triage & dispatch --------------------------- */

function DispatchModal({ report, onClose, onDispatch, onTransaction, logAudit }) {
  const [classification, setClassification] = useState(report.urgency);
  const [routedTo, setRoutedTo] = useState(isEmergency(report) ? ROUTES[0][0] : ROUTES[1][0]);
  const [team, setTeam] = useState(isEmergency(report) ? "BDRRMO Response" : report.team);
  const [requests, setRequests] = useState({});
  const [capability, setCapability] = useState(report.medical?.capability ?? "Trauma");
  const [hospitalKey, setHospitalKey] = useState(null);
  const emergency = isEmergency(report);
  const maintenance = routedTo === ROUTES[1][0];
  const agencies = useMemo(() => Object.entries(EXTERNAL_AGENCIES).filter(([key]) => key !== "hospital" || !maintenance), [maintenance]);
  const matchingHospitals = useMemo(() => HOSPITALS.filter((h) => h.capabilities.includes(capability)), [capability]);
  const chosen = HOSPITALS.find((h) => h.key === hospitalKey);
  const chosenInfo = chosen ? facilityInfo("hospital", { ...report, dispatchHospital: hospitalKey }) : null;

  useEffect(() => {
    if (!agencies.some(([key]) => requests[key] === "requested")) return;
    const timer = setTimeout(() => setRequests((current) => Object.fromEntries(
      agencies.map(([key, agency]) => [key, current[key] === "requested" ? { unit: agency.unit, eta: agency.eta } : current[key]]),
    )), 1600);
    return () => clearTimeout(timer);
  }, [requests, agencies]);

  function confirm() {
    const units = agencies
      .flatMap(([key, agency]) => {
        const state = requests[key];
        if (!state) return [];
        const info = facilityInfo(key, report);
        return [{ key, confirmed: agency.confirmed, station: info.name, via: info.via, km: info.km, unit: state.unit ?? "—", eta: state.eta ?? info.eta, status: state === "requested" ? "Requested" : "Confirmed" }];
      })
      .sort((a, b) => a.km - b.km)
      .map((unit, index) => ({ ...unit, nearest: index === 0 }));
    const external = units.map((unit) => unit.status === "Confirmed" ? `${unit.confirmed}: Confirmed • Unit: ${unit.unit} • ETA: ${unit.eta}` : `${unit.confirmed}: Requested`);
    const medical = emergency && report.medical
      ? chosen
        ? { ...report.medical, capability, hospital: chosen.name, route: `${report.location} → ${chosen.name} (${chosenInfo.via})` }
        : report.medical
      : report.medical;
    const changes = {
      urgency: classification,
      routedTo,
      team: maintenance ? team : "BDRRMO Response",
      emergencyVerified: !emergency ? undefined : (report.emergencyVerified ?? true),
      status: "In Progress",
      dispatchHospital: chosen ? hospitalKey : report.dispatchHospital,
      external: [...report.external ?? [], ...external],
      medical,
    };
    logAudit({ reportId: report.id, actor: "Admin", action: "Triage & dispatch", detail: `Classified “${classification}” → ${routedTo}${chosen ? ` • hospital routing to ${chosen.name} (capability: ${capability})` : ""}.` });
    onDispatch(report.id, changes);
    onClose();
    onTransaction({ ...report, ...changes }, units, maintenance);
  }

  return (
    <ModalShell title="Triage, Classification & Dispatch" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[980px]"
      footer={<footer className="gf-modal-foot"><button type="button" onClick={onClose} className="gf-btn gf-btn--cancel">Cancel</button><button type="button" onClick={confirm} className="gf-btn gf-btn--primary">Confirm Dispatch</button></footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Urgency Classification">
          <div className="grid grid-cols-3 gap-2">
            {URGENCY_OPTS.map((option) => (
              <button key={option} type="button" aria-pressed={classification === option} onClick={() => { setClassification(option); setRoutedTo(option === "Non-Emergency Infrastructure" ? ROUTES[1][0] : ROUTES[0][0]); }}
                className={`gf-option ${classification === option ? "gf-option--active" : ""}`}>
                {option === "Critical Emergency" ? <Siren size={13} /> : option === "Standard Emergency" ? <Bell size={13} /> : <Wrench size={13} />}
                <span>{shortUrgency(option)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-[#7184a0]">Critical & standard emergencies route to BDRRMO; non-emergency infrastructure stays with internal maintenance teams.</p>
        </ModalSection>

        <ModalSection title="Workflow Routing">
          <div className="grid grid-cols-2 gap-2">
            {ROUTES.map(([route, Icon]) => (
              <button key={route} type="button" aria-pressed={routedTo === route} onClick={() => setRoutedTo(route)}
                className={`gf-option ${routedTo === route ? "gf-option--active" : ""}`}>
                <Icon size={14} /> {route}
              </button>
            ))}
          </div>
        </ModalSection>

        {!maintenance && emergency && report.medical && (
          <ModalSection title="Hospital Capability Routing">
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Required treatment capability
              <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={capability} onChange={(event) => { setCapability(event.target.value); setHospitalKey(null); }}>
                {CAPABILITY_OPTS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <ul className="mt-2 grid gap-1.5">
              {matchingHospitals.map((hospital) => {
                const info = facilityInfo("hospital", { ...report, dispatchHospital: hospital.key });
                return (
                  <li key={hospital.key} className={`gf-option-card ${hospitalKey === hospital.key ? "gf-option-card--accent" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-[#263246]"><Ambulance size={13} style={{ color: "var(--gf-green)" }} />{hospital.name}</span>
                      <button type="button" className={`gf-btn gf-btn--tiny ${hospitalKey === hospital.key ? "gf-btn--tiny--solid" : "gf-btn--tiny--outline"}`} onClick={() => setHospitalKey(hospital.key)}>
                        {hospitalKey === hospital.key ? "Routed ✓" : "Route here"}
                      </button>
                    </div>
                    <p className="mt-1 text-[#60738f]">Capabilities: {hospital.capabilities.join(" • ")} | {info.km} km • ETA ~{info.eta} via {hospital.via}</p>
                  </li>
                );
              })}
              {!matchingHospitals.length && <li className="gf-note gf-note--warn"><TriangleAlert size={13} style={{ flexShrink: 0 }} />No nearby facility lists this capability — dispatch the closest one and request capability matching via the QR handover.</li>}
            </ul>
            <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
              <div className="h-[240px]">
                <MapViewer compact
                  incidents={[
                    { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                    ...HOSPITALS.map((hospital) => ({ id: `facility-${hospital.key}`, title: hospital.name, category: "incident", status: "Ready", lat: hospital.lat, lng: hospital.lng })),
                  ]}
                  selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }}
                  routes={chosen ? [{ id: "hospital-route", points: routeBetween(chosen, report) }] : []}
                  trackers={chosen ? [{ id: "hospital-track", category: "incident", ...pointAtFraction(routeBetween(chosen, report), 0.5) }] : []}
                  dropOffs={chosen ? [{ id: "hospital-drop", title: chosen.name, lat: chosen.lat, lng: chosen.lng }] : []} />
              </div>
              <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">
                {chosen ? `Scene → ${chosen.name}: ${chosenInfo.km} km • ~${chosenInfo.eta} via ${chosenInfo.via}. Green arrow pin marks the receiving hospital.` : "Select a capability-filtered hospital to preview the route from the scene."}
              </div>
            </div>
          </ModalSection>
        )}

        {!maintenance && (
          <ModalSection title="Nearest Response Facilities">
            <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
              <div className="h-[240px]">
                <MapViewer compact incidents={[
                  { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                  ...Object.entries(RESPONSE_FACILITIES).map(([key, facility]) => ({ id: `facility-${key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[key], status: "Ready", lat: facility.lat, lng: facility.lng })),
                  { id: "facility-hall", title: TANOD_BASE.name, category: FACILITY_PIN_CATEGORY.hall, status: "Ready", lat: TANOD_BASE.lat, lng: TANOD_BASE.lng },
                ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} />
              </div>
              <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Pulsing pin = incident location. Station icons mark requestable units and the Tanod base.</div>
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {["police", "fire"].map((key) => {
                const info = facilityInfo(key, report);
                return (
                  <li key={key} className="flex items-center justify-between gap-2 rounded-md border border-[#e0e7eb] px-2.5 py-2 text-[9px]">
                    <span className="flex min-w-0 items-center gap-2 font-bold text-[#263246]">{info.name}</span>
                    <span className="shrink-0 font-medium text-[#60738f]">{info.km} km • ETA ~{info.eta} via {info.via}</span>
                  </li>
                );
              })}
            </ul>
          </ModalSection>
        )}

        <ModalSection title={maintenance ? "Assigned Maintenance Team" : "Parallel Multi-Agency Dispatch"}>
          {maintenance ? (
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Assigned Team
              <select className="gf-select" style={{ color: "#42506a", height: 36 }} value={team} onChange={(event) => setTeam(event.target.value)}>
                {TEAM_OPTIONS.slice(1).map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {["police", "fire", "hospital"].map((key) => {
                const agency = EXTERNAL_AGENCIES[key];
                const state = requests[key];
                return (
                  <div key={key} className="gf-option-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-[#263246]"><agency.icon size={13} style={{ color: "var(--gf-green)" }} /> {agency.label}</span>
                      <button type="button" disabled={Boolean(state)} onClick={() => setRequests((r) => ({ ...r, [key]: "requested" }))}
                        className={`gf-btn gf-btn--tiny ${state ? "gf-btn--tiny--outline" : "gf-btn--tiny--outline"}`} style={state ? { color: "#a0b0c0" } : undefined}>
                        {state ? "Requested ✓" : "Request"}
                      </button>
                    </div>
                    <p className="mt-2 text-[9px] text-[#60738f]" aria-live="polite">
                      {!state && "No external unit requested."}
                      {state === "requested" && <span style={{ color: "var(--gf-amber)" }}>{agency.confirmed}: Requested — awaiting confirmation…</span>}
                      {state && state !== "requested" && <span style={{ color: "var(--gf-green)" }}>{agency.confirmed}: Confirmed | Unit: {state.unit} | ETA: {state.eta}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ModalSection>
      </div>
    </ModalShell>
  );
}

function DispatchTransactionModal({ data, onClose, onTrack, onFieldOps }) {
  const { report, units, maintenance, transactionId, time } = data;
  return (
    <ModalShell title="Dispatch Transaction" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[820px]" backdrop="z-[90]" panel="z-[100]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Routing “{report.urgency}” → {report.routedTo}{maintenance ? " • maintenance" : " • external units requested in parallel under the same Incident ID"}.</span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="gf-btn gf-btn--cancel">Done</button>
          <button type="button" disabled={maintenance} onClick={onTrack} className={`gf-btn gf-btn--primary ${maintenance ? "gf-btn--primary" : ""}`}>Track Unit Responses</button>
          {!maintenance && <button type="button" onClick={onFieldOps} className="gf-btn gf-btn--primary"><Radio size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Responder Assignment</button>}
        </div>
      </footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Transaction Summary">
          <RowList rows={[["Transaction ID", transactionId], ["Logged At", time], ["Routed Workflow", report.routedTo], ["Classification", report.urgency], ["Assigned Team", report.team], ["Status", report.status]]} />
        </ModalSection>
        {units.length > 0 && (
          <ModalSection title="Parallel External Dispatch">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {units.map((unit) => (
                <li key={unit.key} className="rounded-md border border-[#e0e7eb] px-2.5 py-2 text-[9px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-bold text-[#263246]">{unit.nearest && <span className="gf-badge gf-badge--fixed">Nearest</span>}{unit.confirmed} → {unit.station}</span>
                    <span className={`gf-badge ${unit.status === "Confirmed" ? "gf-badge--fixed" : "gf-badge--reported"}`}>{unit.status}</span>
                  </div>
                  <p className="mt-1 text-[#60738f]">Unit: {unit.unit} | {unit.km} km | ETA: {unit.eta} | Route: {report.location} → {unit.station} ({unit.via})</p>
                </li>
              ))}
            </ul>
          </ModalSection>
        )}
        <ModalSection title="Where Responses Are Heading">
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[280px]">
              <MapViewer compact incidents={[
                { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                ...units.map((unit) => { const facility = facilityFor(unit.key, report); return { id: `facility-${unit.key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[unit.key], status: "Ready", lat: facility.lat, lng: facility.lng }; }),
                { id: "facility-hall", title: TANOD_BASE.name, category: FACILITY_PIN_CATEGORY.hall, status: "Ready", lat: TANOD_BASE.lat, lng: TANOD_BASE.lng },
              ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} />
            </div>
            <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Pulsing pin = incident location{units.length ? ". Icons mark the dispatched units." : "."} Green icon = Tanod base for responder assignment.</div>
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

/* --------------------------- Unit tracking ------------------------------- */

function UnitTrackModal({ units, report, onClose }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= TRACK_STAGES.length - 1) return;
    const timer = setTimeout(() => setStage((current) => current + 1), 1400);
    return () => clearTimeout(timer);
  }, [stage]);

  const routes = useMemo(() => units.map((unit) => ({ id: `route-${unit.key}`, key: unit.key, points: routePoints(unit.key, report) })), [units, report]);
  const trackers = useMemo(() => routes.map((route) => ({
    id: `tracker-${route.key}`, category: route.key, ...pointAtFraction(route.points, STAGE_PROGRESS[stage]),
  })), [routes, stage]);

  const dropOffs = useMemo(() => {
    const seen = new Set();
    return units.map((unit) => {
      const point = report.accident && unit.key === "hospital" ? facilityFor("hospital", report) : { lat: report.lat, lng: report.lng };
      return { id: `dropoff-${unit.key}`, title: facilityFor("hospital", report).name, ...point };
    }).filter((drop) => {
      const key = `${drop.lat.toFixed(5)}|${drop.lng.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [units, report]);

  return (
    <ModalShell title="Track Unit Responses" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[1000px]" backdrop="z-[105]" panel="z-[110]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className={`text-[9px] font-bold ${stage === 2 ? "text-(--gf-green)" : "text-[#e69500]"}`} aria-live="polite">{stage === 2 ? "All units are on site." : `Live update: ${TRACK_STAGES[stage]}…`}</span>
        <button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Done</button>
      </footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Live Responder Routes">
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[300px]">
              <MapViewer compact incidents={[
                { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                ...routes.map((route) => { const facility = facilityFor(route.key, report); return { id: `facility-${route.key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[route.key], status: "Ready", lat: facility.lat, lng: facility.lng }; }),
              ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} routes={routes} trackers={trackers} dropOffs={dropOffs} />
            </div>
            <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Dashed lines are station → scene routes; moving agency icons are responding units en route; the green arrow pin marks the drop-off.</div>
          </div>
        </ModalSection>
        <ModalSection title="Unit Tracking & Road Status">
          <div className="grid gap-2 sm:grid-cols-2">
            {units.map((unit) => (
              <div key={unit.key} className={`gf-option-card ${stage === 2 ? "gf-option-card--accent" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#263246]">{unit.nearest && <span className="gf-badge gf-badge--fixed">Nearest</span>}{unit.confirmed} — {unit.station}</span>
                  <span className={`gf-badge ${stage === 2 ? "gf-badge--fixed" : "gf-badge--reported"}`}>{TRACK_STAGES[stage]}</span>
                </div>
                <p className="mt-1 text-[9px] text-[#60738f]">Unit: {unit.unit} | Distance: {unit.km} km | ETA: {unit.eta} | Route: {report.location} → {unit.station} via {unit.via}</p>
                <div className="gf-note gf-note--warn mt-2">
                  <TriangleAlert size={11} style={{ flexShrink: 0, color: "#b45309" }} />
                  <span>
                    <strong>Possible Road Closures:</strong>{" "}
                    {(ROAD_CLOSURES[unit.key] ?? []).map((closure) => `${closure.road} (${closure.section}) — ${closure.note}`).join(" • ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

/* ---------------------- Field operations & tracking ---------------------- */

function FieldOpsModal({ report, onClose, onAssign, onAccepted, onStage, onHandover, logAudit }) {
  const [tanod, setTanod] = useState(report.responders?.tanod ?? null);
  const [vehicle, setVehicle] = useState(report.responders?.vehicle ?? null);
  const [sent, setSent] = useState(Boolean(report.responders));
  const [showQr, setShowQr] = useState(false);
  const stageIndex = FIELD_STAGES.indexOf(report.fieldStage ?? (sent ? "Assigned" : null));
  const activeStage = stageIndex >= 0 ? FIELD_STAGES[stageIndex] : null;
  const scanRef = useRef(null);
  const qrToken = useMemo(() => `HV-${report.id.replace("GF-", "")}-${String(9700 + Math.floor((hash32(`${report.id}:${report.handover?.at ?? "pending"}`)() % 300)))}`, [report.id, report.handover?.at]);
  const roster = useMemo(() => report.responders ?? {}, [report.responders]);
  const tracking = Boolean(sent) && activeStage !== "Completed" && !report.gpsEnded;

  useEffect(() => {
    if (!sent || roster.accepted) return;
    const timer = setTimeout(() => onAccepted(report.id, stamp(true)), 1800);
    return () => clearTimeout(timer);
  }, [sent, roster.accepted, onAccepted, report.id]);

  /* Simulated position drifting along the Tanod route: barangay hall → scene. */
  const [fraction, setFraction] = useState(0);
  useEffect(() => {
    if (!tracking) return;
    const target = STAGE_TARGETS[activeStage ?? "Assigned"];
    const ticker = setInterval(() => setFraction((current) => (current >= target ? target : Math.min(target, current + 0.02))), 320);
    return () => clearInterval(ticker);
  }, [tracking, activeStage]);

  const route = useMemo(() => routeBetween(TANOD_BASE, report), [report]);
  const position = useMemo(() => pointAtFraction(route, tracking ? fraction : 1), [route, fraction, tracking]);

  function assign() {
    if (!tanod || !vehicle) return;
    setSent(true);
    onAssign(report.id, { tanod, vehicle });
  }

  function advance(stage) {
    onStage(report.id, stage);
  }

  function scanQr() {
    setShowQr(true);
    const hospital = report.medical?.transport ? (facilityFor("hospital", report)) : null;
    const scanner = hospital ? `${hospital.name} — ER Desk` : "Receiving agency desk";
    logAudit({ reportId: report.id, actor: scanner, action: "QR handover scanned", detail: `${scanner} scanned the dynamic handover code ${qrToken} and formally acknowledged receipt.` });
    toast.add({ type: "success", title: "Handover acknowledged", description: `${scanner} scanned ${qrToken}. Receipt recorded in the audit trail.` });
    onHandover(report.id, { scannedBy: scanner, at: stamp(true), token: qrToken });
    clearTimeout(scanRef.current);
  }

  function generateQr() {
    logAudit({ reportId: report.id, actor: "Field Tanod", action: "Dynamic QR generated", detail: `On-scene handover code ${qrToken} generated at the incident.` });
    setShowQr(true);
  }

  const mapIncidents = [
    { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
    { id: "facility-hall", title: TANOD_BASE.name, category: FACILITY_PIN_CATEGORY.hall, status: "Ready", lat: TANOD_BASE.lat, lng: TANOD_BASE.lng },
  ];
  if (report.medical?.transport) {
    const hospital = facilityFor("hospital", report);
    mapIncidents.push({ id: "facility-hospital", title: hospital.name, category: FACILITY_PIN_CATEGORY.hospital, status: "Ready", lat: hospital.lat, lng: hospital.lng });
  }

  return (
    <ModalShell title="Field Operations & Live Tracking" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[1020px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Tanod GPS is privacy-scoped: shared only while the response is active and cut off automatically when the field stage reaches <strong>Completed</strong>.</span>
        <button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Done</button>
      </footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Responder Assignment">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Available Tanod
              <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={tanod ?? ""} disabled={sent} onChange={(event) => setTanod(event.target.value)}>
                <option value="">— select —</option>
                {TANODS.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.status}) — {t.beat}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Vehicle
              <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={vehicle ?? ""} disabled={sent} onChange={(event) => setVehicle(event.target.value)}>
                <option value="">— select —</option>
                {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.type} ({v.id} • {v.status})</option>)}
              </select>
            </label>
            <div className="grid items-end">
              {sent
                ? <div className="gf-note gf-note--soft" style={{ padding: "0.5rem 0.75rem" }}>
                  <UserCheck size={13} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                  <span>{roster.accepted ? <>Tanod accepted the assignment<br />{roster.accepted}</> : "Assignment sent — awaiting acceptance…"}</span>
                </div>
                : <button type="button" disabled={!tanod || !vehicle} className="gf-btn gf-btn--primary" onClick={assign}>Send Assignment & Track</button>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Status Progression (En Route → On Scene → Handover → Completed)">
          <div className="flex flex-wrap items-center gap-1.5">
            {FIELD_STAGES.map((stage, index) => {
              const done = stageIndex >= 0 && index < stageIndex;
              const current = stage === activeStage;
              return (
                <span key={stage} className={`gf-stage ${current ? "text-[#e69500]" : done ? "text-(--gf-green)" : "text-[#a0b0c0]"}`}>
                  <span className={`gf-stage-dot ${done ? "gf-stage-dot--done" : current ? "gf-stage-dot--active" : "gf-stage-dot--locked"}`}>{done ? "✓" : ""}</span>
                  {stage}
                </span>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FIELD_STAGES.slice(1).map((stage) => {
              const next = stageIndex >= 0 ? FIELD_STAGES[stageIndex + 1] : null;
              const handoverGate = stage === "Handover" && report.medical?.transport !== false && !report.handover && stageIndex === FIELD_STAGES.indexOf("On Scene");
              const disabled = stage !== next || (stage === "Handover" && handoverGate && !showQr)
                || (stage === "Handover" && report.medical?.transport && !report.handover && report.fieldStage === "On Scene");
              return (
                <button key={stage} type="button" onClick={() => advance(stage)} disabled={disabled || !sent}
                  className={`gf-btn gf-btn--tiny ${stage === next ? "gf-btn--tiny--solid" : "gf-btn--tiny--outline"}`}>
                  {stage}{handoverGate && stage === "Handover" ? " (QR needed)" : ""}
                </button>
              );
            })}
            </div>
          <p className="mt-2 text-[9px] text-[#7184a0]">If this is a patient transport, the Handover step stays locked until the hospital (or receiving agency) scans the dynamic QR code below.</p>
        </ModalSection>

        {report.handover && (
          <div className="gf-note gf-note--soft">
            <QrCode size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
            <span><strong>Handover acknowledged:</strong> {report.handover.scannedBy} • {report.handover.at} • code {report.handover.token}</span>
          </div>
        )}

        {sent && (stageIndex >= FIELD_STAGES.indexOf("On Scene") || showQr) && !report.gpsEnded && (
          <ModalSection title="QR-Based Handover">
            <div className="flex flex-wrap items-start gap-4">
              {showQr && (
                <div className="gf-qr">
                  <QRMatrix seed={qrToken} />
                </div>
              )}
              <div className="min-w-[220px] flex-1">
                {!showQr
                  ? <><p className="text-[10px] font-bold text-[#263246]">Generate the dynamic handover code</p>
                    <p className="mt-1 text-[9px] text-[#60738f]">On-scene Tanod generates the code; the hospital or external agency scans it to formally acknowledge receipt of the patient/case.</p>
                    <button type="button" className="gf-btn gf-btn--primary mt-2" onClick={generateQr}><QrCode size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Generate handover QR</button></>
                  : <>
                    <p className="text-[10px] font-bold text-[#263246]">Code {qrToken}</p>
                    <p className="mt-1 text-[9px] text-[#60738f]">Single-response validity • rotates per incident. Hospital/agency FOH desk: “Scan code {qrToken}”.</p>
                    <div className="mt-2 flex gap-1.5">
                      {!report.handover && <button type="button" className="gf-btn gf-btn--primary" onClick={scanQr}><ScanLine size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Simulate hospital scan</button>}
                      {report.handover && <span className="gf-badge gf-badge--fixed"><CheckCircle2 size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />Scanned & acknowledged</span>}
                    </div>
                  </>}
              </div>
            </div>
          </ModalSection>
        )}

        <ModalSection title="Privacy-Scoped Live Tracking">
          {tracking && activeStage && activeStage !== "On Scene" && activeStage !== "Handover" ? null : null}
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="relative h-[300px]">
              <MapViewer compact incidents={mapIncidents} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }}
                routes={sent ? [{ id: "tanod-route", points: route }] : []}
                trackers={tracking ? [{ id: "tanod-live", category: "infrastructure", ...position }] : []} />
              {!sent && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 text-[10px] font-bold text-[#60738f]">Assign a responder to begin privacy-scoped tracking</div>}
              {(report.gpsEnded || report.fieldStage === "Completed" || activeStage === "Completed") && (
                <div className="absolute inset-x-0 bottom-0 z-[500] flex items-center justify-center gap-2 bg-(--gf-green-soft) px-3 py-2 text-[9px] font-bold text-(--gf-green)">
                  <Lock size={11} />Live GPS sharing automatically turned off — duty completed.
                </div>
              )}
            </div>
            <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Dashed line = Tanod route from the barangay hall; the amber icon is the live responder position. Location feed stops the moment the duty completes.</div>
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

/* ----------------------- Governance auxiliary modals --------------------- */

const STRIKE_STEPS = ["Warning issued", "24-hour submission restriction", "7-day restriction (repeat offender)"];

function StrikeModal({ report, strikes, onClose, onStrike }) {
  const count = strikes[report.reporter]?.count ?? 0;
  const next = count < STRIKE_STEPS.length ? STRIKE_STEPS[count] : null;
  return (
    <ModalShell title="False Report Discipline (Progressive Strikes)" subtitle={`${report.id} • reporter ${report.reporter}`} onClose={onClose} width="max-w-[520px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Strikes apply to the reporter, never to the incident itself.</span>
        <button type="button" disabled={!next} onClick={() => onStrike(report.id)} className="gf-btn gf-btn--primary">{next ? `Record strike ${count + 1}` : "Max reached"}</button>
      </footer>}>
      <div className="gf-modal-body">
        <p className="text-[9px] text-[#60738f]">Progressive schedule for this reporter:</p>
        <ol className="mt-1 grid gap-1.5">
          {STRIKE_STEPS.map((step, index) => (
            <li key={step} className={`gf-option-card ${index < count ? "gf-option-card--accent" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[10px] font-bold text-[#263246]">
                  {index === 0 ? <ShieldCheck size={13} style={{ color: "var(--gf-green)" }} /> : index === 1 ? <Clock size={13} style={{ color: "var(--gf-amber)" }} /> : <Ban size={13} style={{ color: "var(--gf-red)" }} />}
                  {step}
                </span>
                <span className={`gf-badge ${index < count ? "gf-badge--fixed" : "gf-badge--duplicate"}`}>{index < count ? "Served" : "Next"}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[9px] text-[#7184a0]">Current: {count === 0 ? "no strikes" : `${count} strike${count > 1 ? "s" : ""} on record`}{strikes[report.reporter]?.until ? ` • restricted until ${strikes[report.reporter].until}` : ""}.</p>
      </div>
    </ModalShell>
  );
}

function LinkDuplicateModal({ report, reports, onClose, onLink }) {
  const [masterId, setMasterId] = useState("");
  const candidates = reports.filter((r) => r.id !== report.id && r.status !== "Duplicate");
  return (
    <ModalShell title="Link Duplicate Reports" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[560px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Duplicates keep their records but follow a single master incident.</span>
        <button type="button" disabled={!masterId} onClick={() => onLink(report.id, masterId)} className="gf-btn gf-btn--primary">Link to master</button>
      </footer>}>
      <div className="gf-modal-body">
        <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Master incident
          <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={masterId} onChange={(event) => setMasterId(event.target.value)}>
            <option value="">— select master —</option>
            {candidates.map((r) => <option key={r.id} value={r.id}>{r.id} — {r.title} ({shortUrgency(r.urgency)})</option>)}
          </select>
        </label>
        {report.duplicateOf && <div className="gf-note gf-note--soft"><GitMerge size={14} style={{ flexShrink: 0 }} /><span>Currently linked to <strong>{report.duplicateOf}</strong>.</span></div>}
      </div>
    </ModalShell>
  );
}

function AuditTrailModal({ log, filter, onFilter, onClose }) {
  const entries = log.filter((entry) => filter === "All reports" || entry.reportId === filter);
  return (
    <ModalShell title="Comprehensive Audit Trail" subtitle="Append-only, tamper-evident record of every governed action" onClose={onClose} width="max-w-[780px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="flex items-center gap-1 text-[9px] text-[#7184a0]"><Lock size={10} />Retention: 5 years (3–5-year configurable policy). Entries can never be edited or deleted.</span>
        <button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Close</button>
      </footer>}>
      <div className="gf-modal-body">
        <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]" style={{ maxWidth: 260 }}>
          Filter
          <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={filter} onChange={(event) => onFilter(event.target.value)}>
            <option>All reports</option>
            {[...new Set(log.map((entry) => entry.reportId))].map((id) => <option key={id}>{id}</option>)}
          </select>
        </label>
        <div className="gf-audit">
          {entries.map((entry) => (
            <article key={entry.key} className="gf-audit-item">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="gf-badge gf-badge--duplicate">{entry.reportId}</span>
                  <strong className="text-[#263246]">{entry.action}</strong>
                  <span className="gf-badge gf-badge--guest">{entry.system ? "system" : "user"}</span>
                </span>
                <span className="gf-audit-time">{entry.at}</span>
              </div>
              <p className="mt-1">{entry.detail}</p>
            </article>
          ))}
          {!entries.length && <p className="py-6 text-center text-[10px] text-[#60738f]">No entries for this report yet.</p>}
        </div>
      </div>
    </ModalShell>
  );
}

function SuccessModal({ report, onClose }) {
  return (
    <ModalShell title="Resolution Verified" subtitle={`${report.id} • ${report.closure?.reason ? "closed with documented no-proof reason" : "proof recorded"}`} onClose={onClose} width="max-w-[620px]" backdrop="z-[110]" panel="z-[120]"
      footer={<footer className="gf-modal-foot"><button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Done</button></footer>}>
      <div className="px-6 py-7">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--gf-green-tint)", color: "var(--gf-green)" }}><span className="text-[28px] leading-none">✓</span></div>
          <h3 className="mt-4 text-[18px] font-bold text-[#3d3d3d]">{report.closure?.reason ? "Closed Without Proof — Reason Documented" : "Report Marked as Resolved"}</h3>
          <p className="mt-1 text-[11px] text-[#60738f]">
            {report.closure?.reason
              ? "The no-proof closure and its reason were written to the immutable audit trail."
              : "Proof of response/repair is recorded and the report details were updated."}
          </p>
        </div>
        <div className="mt-5">
          <RowList rows={[
            ["Report ID", report.id],
            ["Status", <Badge key="status" label={report.status} styles={STATUS_STYLES[report.status]} />],
            ["Category", report.category], ["Urgency", shortUrgency(report.urgency)],
            ["Location", `${report.location}, Barangay 167`], ["Assigned Team", report.team],
            ["Publishing", report.published ? `Published ${report.published.at}` : "Not yet published to the public dashboard"],
          ]} />
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------ SLA banner ------------------------------- */

function SlaBanner({ report, now }) {
  const elapsed = now - report.sla.start;
  const remaining = Math.max(0, TAKEOVER_MS - elapsed);
  const reminded = elapsed >= REMINDER_MS;
  return (
    <div className="gf-sla-banner">
      <Siren size={15} style={{ color: "var(--gf-red)" }} />
      <strong className="text-[10px] text-[#263246]">Emergency verification timer — {report.id}</strong>
      <span className="gf-timer gf-timer--armed text-[14px]" style={{ color: "var(--gf-red)" }}>{fmtClock(remaining)} to BDRRMO takeover</span>
      <span className={`gf-badge ${reminded ? "gf-badge--alert" : "gf-badge--reported"}`}>{reminded ? "30s reminder issued" : "Admin reminder at 30s"}</span>
      <span className="text-[9px] text-[#7a3040]">Unverified at 60s → automatic BDRRMO takeover of dispatch.</span>
      <span className="ml-auto h-1.5 max-w-[180px] flex-1 overflow-hidden rounded-full bg-white/70">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (elapsed / TAKEOVER_MS) * 100)}%`, background: "var(--gf-red)" }} />
      </span>
    </div>
  );
}

/* --------------------------- Pending triage timer ------------------------ */

function TriageTimerCell({ report, now }) {
  if (!report.sla?.start) {
    return <td className="px-2 py-3"><span className="text-[9px] text-[#a0b0c6]">No SLA window</span></td>;
  }
  const remaining = Math.max(0, TAKEOVER_MS - (now - report.sla.start));
  if (remaining <= 0) {
    return (
      <td className="px-2 py-3">
        <span className="gf-badge gf-badge--alert"><Siren size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />BDRRMO Escalation Takeover</span>
      </td>
    );
  }
  return (
    <td className="px-2 py-3">
      <span className="gf-timer gf-timer--armed text-[12px]" style={{ color: remaining <= REMINDER_MS ? "var(--gf-red)" : "var(--gf-amber)" }}>{fmtClock(remaining)}</span>
      <div className="text-[8px] text-[#a0b0c6]">to BDRRMO takeover</div>
    </td>
  );
}

/* ---------------------- Consolidated action dropdown --------------------- */

function ActionCell({ report, escalated, menuOpen, onToggleMenu, onCloseMenu, onOpenDrawer, onBackup, onFlag, onMerge, onAudit, onFieldOps }) {
  const pending = report.status === "Reported" || report.status === "BDRRMO Takeover";
  const menu = [
    { key: "backup", label: "Request Police / Fire Backup", icon: Siren, run: onBackup, disabled: report.status === "Verified Fixed" },
    { key: "flag", label: "Flag False Report (Strike)", icon: Flag, run: onFlag },
    { key: "merge", label: "Merge with Duplicate", icon: GitMerge, run: onMerge, disabled: report.status === "Duplicate" },
    { key: "audit", label: "View Audit Trail", icon: History, run: onAudit },
    { key: "field", label: "Field Ops — Responder Assignment", icon: Radio, run: onFieldOps, disabled: report.status === "Verified Fixed" },
  ];
  return (
    <td className="relative px-2 py-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onOpenDrawer(report)}
          className="gf-btn gf-btn--tiny gf-btn--tiny--solid" style={escalated ? { background: "var(--gf-red)", borderColor: "var(--gf-red)" } : undefined}>
          {pending ? "Triage" : "Manage"}
        </button>
        <button type="button" title="More options" aria-expanded={menuOpen} onClick={onToggleMenu} className="gf-btn gf-btn--tiny gf-btn--tiny--outline"><MoreVertical size={10} /></button>
      </div>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onCloseMenu} />
          <div className="absolute right-2 top-full z-[70] w-56 overflow-hidden rounded-lg border border-[#e2e8eb] bg-white py-1 shadow-lg">
            {menu.map((item) => (
              <button key={item.key} type="button" disabled={item.disabled} onClick={() => { onCloseMenu(); item.run(report); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[9px] font-bold text-[#263246] hover:bg-(--gf-green-soft) disabled:cursor-not-allowed disabled:text-[#a0b0c6]">
                <item.icon size={11} style={{ flexShrink: 0, color: item.key === "flag" ? "var(--gf-red)" : "var(--gf-green)" }} />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </td>
  );
}

/* ------------------------------- Main page ------------------------------- */

const seededStrikes = { "Danny Delgado": { count: 1, lastStep: STRIKE_STEPS[0] } };
const seededAudit = () => [
  { key: "a1", reportId: "GF-001", actor: "Field Tanod", system: false, at: "Apr 22, 08:34", action: "QR handover scanned", detail: "Rizal Medical Center — ER Desk scanned handover code GF-001-HV-8241 and acknowledged receipt." },
  { key: "a2", reportId: "GF-004", actor: "System — SLA", system: true, at: "Apr 19, 21:02", action: "Emergency verification window opened", detail: "60-second verification timer armed; 30s reminder and BDRRMO takeover armed." },
  { key: "a3", reportId: "GF-006", actor: "System — Language", system: true, at: "Apr 17, 05:52", action: "Language sanitization", detail: "Flagged terms masked for the sanitized staff copy. Submission was never blocked or delayed." },
];

export default function IncidentReports() {
  const [reports, setReports] = useState(initialReports);
  const [tab, setTab] = useState(TABS[0]);
  const [menuFor, setMenuFor] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [category, setCategory] = useState("All Categories");
  const [location, setLocation] = useState("All Locations");
  const [month, setMonth] = useState("April 2026");
  const [selectedReport, setSelectedReport] = useState(null);
  const [dispatchReport, setDispatchReport] = useState(null);
  const [savedReport, setSavedReport] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [trackOpen, setTrackOpen] = useState(false);
  const [fieldReport, setFieldReport] = useState(null);
  const [flagReport, setFlagReport] = useState(null);
  const [dupReport, setDupReport] = useState(null);
  const [audit, setAudit] = useState({ open: false, reportId: "All reports" });
  const [strikes, setStrikes] = useState(seededStrikes);
  const [auditLog, setAuditLog] = useState(seededAudit);
  const [now, setNow] = useState(() => NEW_CALLS());

  const logAudit = useCallback((entry) => {
    setAuditLog((log) => [{ key: `${log.length + 1}-${NEW_CALLS()}-${entry.reportId}`, at: stamp(true), ...entry }, ...log]);
  }, []);

  /* Emergency timers: per-second tick only while a 60-second window is open. */
  const activeTimers = useMemo(() => reports.filter((r) => r.sla?.start && r.status === "Reported" && !r.sla.acknowledged), [reports]);
  useEffect(() => {
    if (!activeTimers.length) return undefined;
    const ticker = setInterval(() => setNow(NEW_CALLS()), 1000);
    return () => clearInterval(ticker);
  }, [activeTimers.length]);

  useEffect(() => {
    reports.forEach((report) => {
      if (!report.sla?.start || report.sla.acknowledged) return;
      if (report.status !== "Reported") return;
      const elapsed = now - report.sla.start;
      if (elapsed >= TAKEOVER_MS) {
        setReports((current) => current.map((r) => (r.id === report.id ? { ...r, status: "BDRRMO Takeover", sla: { ...r.sla, takeover: true } } : r)));
        logAudit({ reportId: report.id, actor: "System — SLA", system: true, action: "Automatic BDRRMO takeover", detail: "Unverified past the 60-second window — dispatch control transferred to BDRRMO." });
        toast.add({ type: "error", title: "BDRRMO takeover", description: `${report.id} sat unverified for 60 seconds. Dispatch control moved to BDRRMO.` });
        return;
      }
      if (elapsed >= REMINDER_MS && !report.sla.reminded) {
        setReports((current) => current.map((r) => (r.id === report.id ? { ...r, sla: { ...r.sla, reminded: true } } : r)));
        logAudit({ reportId: report.id, actor: "System — SLA", system: true, action: "Emergency admin reminder", detail: "30 seconds elapsed without verification — reminder issued." });
        toast.add({ type: "warning", title: "Emergency verification reminder", description: `${report.id} is unverified after 30 seconds. Verify now or BDRRMO takes over at 60s.` });
      }
    });
  }, [now, reports, logAudit]);

  function updateReportData(id, changes) {
    setReports((current) => current.map((report) => (report.id === id ? { ...report, ...changes } : report)));
  }

  function beginTransaction(updated, units, maintenance) {
    setTrackOpen(false);
    setTransaction({
      report: updated, units, maintenance,
      transactionId: `DSP-${updated.id.replace("GF-", "")}-${String(NEW_CALLS()).slice(-4)}`,
      time: stamp(),
    });
  }

  function acknowledgeSla(id) {
    setReports((current) => current.map((r) => (r.id === id ? { ...r, sla: { ...r.sla, acknowledged: true } } : r)));
  }

  function handleDispatch(id, changes) {
    updateReportData(id, changes);
    if (isEmergency({ ...reports.find((r) => r.id === id), ...changes })) acknowledgeSla(id);
  }

  function handleResolve(id, changes, mode) {
    updateReportData(id, changes);
    logAudit({
      reportId: id, actor: "Admin",
      action: mode === "proof" ? "Resolution closed with proof" : "Closed without proof — reason documented",
      detail: mode === "proof" ? `Proof uploaded before closing the incident.` : `${changes.closure.reason}: ${changes.closure.note}`,
      system: false,
    });
    setSavedReport({ ...reports.find((r) => r.id === id), ...changes });
    toast.add({ type: "success", title: "Incident closed", description: mode === "proof" ? "Proof recorded and the incident is marked resolved." : "No-proof closure recorded with a documented reason." });
  }

  function handlePublish(id) {
    const summary = privacySummary(reports.find((r) => r.id === id));
    updateReportData(id, { published: { at: stamp(true), summary } });
    logAudit({ reportId: id, actor: "Admin", action: "Accomplishment summary published", detail: "Privacy-safe summary posted to the public dashboard (addresses and identifiers stripped)." });
    toast.add({ type: "success", title: "Published to public dashboard", description: "Privacy-safe accomplishment summary is now visible to the public feed." });
  }

  function handleAssign(id, { tanod, vehicle }) {
    updateReportData(id, { responders: { tanod, vehicle, sent: stamp(true), accepted: null } });
    const tanodName = TANODS.find((t) => t.id === tanod)?.name ?? tanod;
    const vehicleName = VEHICLES.find((v) => v.id === vehicle)?.id ?? vehicle;
    logAudit({ reportId: id, actor: "BDRRMO", action: "Responder assigned", detail: `${tanodName} + vehicle ${vehicleName} assigned; awaiting field acceptance.` });
  }

  function handleAccepted(id) {
    updateReportData(id, { responders: { ...reports.find((r) => r.id === id).responders, accepted: stamp(true) } });
    logAudit({ reportId: id, actor: "Field Tanod", action: "Assignment accepted", detail: "Tanod confirmed the assignment in the field app." });
    toast.add({ type: "success", title: "Responder accepted", description: `The assigned Tanod accepted the response duty for ${id}.` });
  }

  function handleStage(id, stage) {
    updateReportData(id, { fieldStage: stage });
    if (stage === "Completed") {
      updateReportData(id, { fieldStage: stage, gpsEnded: true });
      logAudit({ reportId: id, actor: "System — GPS", system: true, action: "Live tracking automatically disabled", detail: "Duty reached Completed — privacy-scoped GPS sharing turned off." });
    } else {
      logAudit({ reportId: id, actor: "Field Tanod", action: `Status → ${stage}`, detail: "Field progress updated from the responder app." });
    }
    toast.add({ type: "info", title: `Status updated: ${stage}`, description: stage === "Completed" ? "Live GPS sharing ended automatically." : `${id} → ${stage}.` });
  }

  function handleHandover(id, handover) {
    updateReportData(id, { handover, fieldStage: reportStageAfterScan(reports.find((r) => r.id === id)) });
  }

  function reportStageAfterScan(report) {
    return report?.fieldStage === "On Scene" ? "Handover" : (report?.fieldStage ?? "Handover");
  }

  function handleLinkDuplicate(childId, masterId) {
    const master = reports.find((r) => r.id === masterId);
    const child = reports.find((r) => r.id === childId);
    if (!master || !child) return;
    updateReportData(childId, { duplicateOf: masterId, status: "Duplicate" });
    updateReportData(masterId, { linked: [...(master.linked ?? []), childId] });
    logAudit({ reportId: childId, actor: "Admin", action: "Duplicate linked", detail: `Linked to master incident ${masterId}. Status set to Duplicate.` });
    toast.add({ type: "info", title: "Duplicate linked", description: `${childId} now follows master incident ${masterId}.` });
    setDupReport(null);
  }

  function handleStrike(id) {
    const report = reports.find((r) => r.id === id);
    const current = strikes[report.reporter] ?? { count: 0 };
    const count = Math.min(STRIKE_STEPS.length, current.count + 1);
    const step = STRIKE_STEPS[count - 1];
    setStrikes((s) => ({ ...s, [report.reporter]: { count, lastStep: step } }));
    logAudit({ reportId: id, actor: "Admin", action: `False report strike ${count}`, detail: `${report.reporter}: ${step}.` });
    toast.add({ type: count >= 2 ? "error" : "warning", title: `Strike ${count} recorded`, description: `${report.reporter} — ${step}.` });
    setFlagReport(null);
  }

  const filteredReports = useMemo(() => reports.filter((report) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || `${report.id} ${report.title} ${report.category} ${report.location} ${report.reporter} ${report.status} ${report.team}`.toLowerCase().includes(search);
    return matchesQuery
      && bucketFor(report) === tab
      && (status === "All Statuses" || report.status === status)
      && (category === "All Categories" || report.category === category)
      && (location === "All Locations" || report.location === location);
  }), [category, location, query, reports, status, tab]);

  const restrictedReporters = Object.entries(strikes).filter(([, s]) => s.count >= 2).map(([name]) => name);

  function resetFilters() {
    setQuery(""); setStatus("All Statuses"); setCategory("All Categories"); setLocation("All Locations"); setMonth("April 2026");
  }

  return (
    <div className="space-y-3">
      {activeTimers.map((report) => <SlaBanner key={report.id} report={report} now={now} />)}
      {reports.some((r) => r.status === "BDRRMO Takeover") && (
        <div className="gf-note gf-note--danger">
          <TriangleAlert size={14} style={{ flexShrink: 0, color: "var(--gf-red)" }} />
          <span>
            <strong>Escalated:</strong>{" "}
            {reports.filter((r) => r.status === "BDRRMO Takeover").map((r) => `${r.id} (unverified 60s — ${r.title})`).join(" • ")}
            . Dispatch control is with BDRRMO; use Responder Assignment to field units immediately.
          </span>
        </div>
      )}

      <section className="rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="gf-tabs">
          {TABS.map((name) => {
            const count = reports.filter((report) => bucketFor(report) === name).length;
            const alerting = name === "Pending Triage" && reports.some((report) => bucketFor(report) === name
              && (report.status === "BDRRMO Takeover" || (report.sla?.start && now - report.sla.start >= REMINDER_MS)));
            return (
              <button key={name} type="button" aria-pressed={tab === name} onClick={() => setTab(name)} className={`gf-tab ${tab === name ? "gf-tab--active" : ""}`}>
                {name}
                <span className={`gf-badge ${alerting ? "gf-badge--alert" : "gf-badge--duplicate"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
        <label className="gf-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports..." className="w-full text-[9px] outline-none placeholder:text-[#a0b0c0]" />
        </label>
        <SelectFilter value={status} options={statuses} onChange={setStatus} ariaLabel="Filter status" />
        <SelectFilter value={category} options={categories} onChange={setCategory} ariaLabel="Filter category" />
        <SelectFilter value={location} options={locations} onChange={setLocation} ariaLabel="Filter location" />
        <SelectFilter value={month} options={["April 2026", "March 2026", "February 2026"]} onChange={setMonth} ariaLabel="Filter month" />
        <button type="button" onClick={resetFilters} className="flex items-center gap-1 px-2 text-[9px] text-[#60738f] hover:text-(--gf-green)"><RotateCcw size={11} /> Reset</button>
      </section>

      <section className="rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[12px] font-bold text-(--gf-green)">Incident & Infrastructure Reports ({filteredReports.length})</h2>
            <span className="gf-badge gf-badge--guest">Guest pathways: {reports.filter((r) => r.reporterType === "guest").length}</span>
            {restrictedReporters.length > 0 && <span className="gf-badge gf-badge--alert"><Ban size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />Restricted: {restrictedReporters.join(", ")}</span>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setAudit({ open: true, reportId: "All reports" })} className="gf-btn gf-btn--chip"><History size={11} />Audit Trail</button>
            <button type="button" onClick={() => toast.add({ title: "Export ready", description: "CSV export is available for the filtered reports.", type: "success" })} className="gf-btn gf-btn--chip"><Download size={11} /> Export CSV</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {(() => {
            const pendingTab = tab === "Pending Triage";
            const headings = ["ID", "Incident Details", "Category", "Urgency", "Location", "Reporter", "Date Reported", "Assigned Team", "Status", ...(pendingTab ? ["Triage Timer"] : []), "Action"];
            return (
              <table className="gf-table">
                <thead>
                  <tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => {
                    const escalated = pendingTab && (report.status === "BDRRMO Takeover"
                      || (report.sla?.start && now - report.sla.start >= TAKEOVER_MS));
                    return (
                      <tr key={report.id} style={escalated ? { background: "#fdeceb" } : undefined}>
                        <td className="px-2 py-3 font-bold text-(--gf-green)">
                          {report.id}
                          {report.duplicateOf && <div><span className="gf-badge gf-badge--duplicate"><GitMerge size={8} style={{ display: "inline", verticalAlign: "-1px", marginRight: 2 }} />dup of {report.duplicateOf}</span></div>}
                          {report.published && <div><span className="gf-badge gf-badge--fixed">published</span></div>}
                        </td>
                        <td className="px-2 py-3 font-semibold text-[#263246]">{report.title}</td>
                        <td className="px-2 py-3 text-[#60738f]">{report.category}</td>
                        <td className="px-2 py-3"><Badge label={shortUrgency(report.urgency)} styles={URGENCY_STYLES[report.urgency]} /></td>
                        <td className="px-2 py-3 text-[#60738f]">{report.location}</td>
                        <td className="px-2 py-3">
                          {report.reporter}
                          <div className="mt-0.5 flex gap-1">
                            <Badge label={report.reporterType === "guest" ? "Guest" : "Verified"} styles={report.reporterType === "guest" ? "gf-badge gf-badge--guest" : "gf-badge gf-badge--resident"} />
                            {strikes[report.reporter]?.count >= 2 && <Badge label="Restricted" styles="gf-badge gf-badge--alert" />}
                            {strikes[report.reporter]?.count === 1 && <Badge label="Warned" styles="gf-badge gf-badge--warn" />}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-[#60738f]">{report.date}</td>
                        <td className="px-2 py-3 font-medium text-(--gf-green)">{report.team}</td>
                        <td className="px-2 py-3"><Badge label={report.status} styles={STATUS_STYLES[report.status]} /></td>
                        {pendingTab && <TriageTimerCell report={report} now={now} />}
                        <ActionCell report={report} escalated={escalated} menuOpen={menuFor === report.id}
                          onToggleMenu={() => setMenuFor((current) => (current === report.id ? null : report.id))}
                          onCloseMenu={() => setMenuFor(null)}
                          onOpenDrawer={(target) => { setMenuFor(null); setSelectedReport(target); }}
                          onBackup={(target) => setDispatchReport(target)}
                          onFlag={(target) => setFlagReport(target)}
                          onMerge={(target) => setDupReport(target)}
                          onAudit={(target) => setAudit({ open: true, reportId: target.id })}
                          onFieldOps={(target) => { acknowledgeSla(target.id); setFieldReport(target); }} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
          {filteredReports.length === 0 && <p className="py-8 text-center text-xs text-[#60738f]">No reports match the selected filters.</p>}
        </div>
      </section>

      {selectedReport && <IncidentDrawer key={selectedReport.id} report={reports.find((r) => r.id === selectedReport.id)} onClose={() => setSelectedReport(null)} onResolve={handleResolve} onPublish={handlePublish} onDispatch={handleDispatch} onOpenAudit={(id) => { setSelectedReport(null); setAudit({ open: true, reportId: id }); }} logAudit={logAudit} />}
      {dispatchReport && <DispatchModal key={dispatchReport.id} report={dispatchReport} onClose={() => setDispatchReport(null)} onDispatch={handleDispatch} onTransaction={beginTransaction} logAudit={logAudit} />}
      {savedReport && <SuccessModal key={savedReport.id} report={savedReport} onClose={() => setSavedReport(null)} />}
      {transaction && <DispatchTransactionModal key={`txn-${transaction.transactionId}`} data={{ ...transaction, report: reports.find((r) => r.id === transaction.report.id) ?? transaction.report }} onClose={() => setTransaction(null)} onTrack={() => setTrackOpen(true)} onFieldOps={() => { setTrackOpen(false); setTransaction(null); acknowledgeSla(transaction.report.id); setFieldReport(reports.find((r) => r.id === transaction.report.id)); }} />}
      {transaction && trackOpen && <UnitTrackModal key={`trk-${transaction.transactionId}`} units={transaction.units} report={reports.find((r) => r.id === transaction.report.id) ?? transaction.report} onClose={() => setTrackOpen(false)} />}
      {fieldReport && <FieldOpsModal report={reports.find((r) => r.id === fieldReport.id) ?? fieldReport} onClose={() => setFieldReport(null)} onAssign={handleAssign} onAccepted={handleAccepted} onStage={handleStage} onHandover={handleHandover} logAudit={logAudit} />}
      {flagReport && <StrikeModal key={flagReport.id} report={flagReport} strikes={strikes} onClose={() => setFlagReport(null)} onStrike={handleStrike} />}
      {dupReport && <LinkDuplicateModal key={dupReport.id} report={dupReport} reports={reports} onClose={() => setDupReport(null)} onLink={handleLinkDuplicate} />}
      {audit.open && <AuditTrailModal log={auditLog} filter={audit.reportId} onFilter={(reportId) => setAudit((a) => ({ ...a, reportId }))} onClose={() => setAudit({ open: false, reportId: "All reports" })} />}
    </div>
  );
}
