import { Ambulance, Flame, Siren, Wrench } from "lucide-react";
import reportCatalog from "../../../../../server/src/shared/reportCatalog.json";

const statuses = ["All Statuses", "Reported", "In Progress", "Forwarded to BDRRMO", "Handed Over", "Verified Fixed", "Duplicate"];
const reportCategories = [...new Set(Object.values(reportCatalog.categories).flat())];
const categories = ["All Categories", ...reportCategories];
const locations = ["All Locations", "Rizal Street", "Quezon Avenue", "Magsaysay Boulevard", "Roxas Boulevard", "Bonifacio Street", "Del Pilar Road"];

const URGENCY_OPTS = Object.values(reportCatalog.adminUrgencies);
const URGENCY_STYLES = {
  [reportCatalog.adminUrgencies.critical]: "gf-badge gf-badge--critical",
  [reportCatalog.adminUrgencies.standard]: "gf-badge gf-badge--emergency",
  [reportCatalog.adminUrgencies.maintenance]: "gf-badge gf-badge--nonemergency",
};
const DISPLAY_URGENCY_STYLES = {
  High: "gf-badge gf-badge--critical",
  Medium: "gf-badge gf-badge--warn",
  Low: "gf-badge gf-badge--nonemergency",
};
const DISPLAY_URGENCY_RANK = { High: 0, Medium: 1, Low: 2 };


const STATUS_STYLES = {
  Reported: "gf-badge gf-badge--reported",
  "In Progress": "gf-badge gf-badge--progress",
  "Forwarded to BDRRMO": "gf-badge gf-badge--takeover",
  "Handed Over": "gf-badge gf-badge--progress",
  "Verified Fixed": "gf-badge gf-badge--fixed",
  Duplicate: "gf-badge gf-badge--duplicate",
};



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


const STRIKE_STEPS = ["Warning issued", "24-hour submission restriction", "7-day restriction (repeat offender)"];

export {
  statuses, reportCategories, categories, locations,
  URGENCY_OPTS, URGENCY_STYLES, DISPLAY_URGENCY_STYLES, DISPLAY_URGENCY_RANK, STATUS_STYLES,
  ROUTES, EXTERNAL_AGENCIES, TEAM_OPTIONS, RESPONSE_FACILITIES, TANOD_BASE, FACILITY_PIN_CATEGORY,
  HOSPITALS, CAPABILITY_OPTS, ROAD_CLOSURES, TANODS, VEHICLES, FIELD_STAGES, STAGE_TARGETS,
  TRACK_STAGES, STAGE_PROGRESS, REMINDER_MS, TAKEOVER_MS, CLOSURE_REASONS, STRIKE_STEPS,
};
