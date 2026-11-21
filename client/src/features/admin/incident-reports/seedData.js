/* --------------------------------------------------------------------------
   DEMO / MOCK DATA — NOT PRODUCTION RECORDS.

   These seed reports, strikes, and audit entries exist so the Incident Reports
   workspace can be exercised without a populated backend. The page merges live
   `/api/reports` results on top of this list; replace or delete this file once
   every queue is backed by real data. Names, locations, and timestamps here are
   fictional sample values.
   -------------------------------------------------------------------------- */
import { STRIKE_STEPS } from "./constants";
import { NEW_CALLS } from "./utils";

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

const seededStrikes = { "Danny Delgado": { count: 1, lastStep: STRIKE_STEPS[0] } };
const seededAudit = () => [
  { key: "a1", reportId: "GF-001", actor: "Field Tanod", system: false, at: "Apr 22, 08:34", action: "QR handover scanned", detail: "Rizal Medical Center — ER Desk scanned handover code GF-001-HV-8241 and acknowledged receipt." },
  { key: "a2", reportId: "GF-004", actor: "System — SLA", system: true, at: "Apr 19, 21:02", action: "Emergency verification window opened", detail: "60-second verification timer armed; 30s reminder and BDRRMO takeover armed." },
  { key: "a3", reportId: "GF-006", actor: "System — Language", system: true, at: "Apr 17, 05:52", action: "Language sanitization", detail: "Flagged terms masked for the sanitized staff copy. Submission was never blocked or delayed." },
];

export { initialReports, seededStrikes, seededAudit };
