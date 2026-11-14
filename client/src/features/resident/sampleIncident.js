import L from "leaflet";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

// Demo data only. Delete this file once real incidents come from your API.
//
// Positions are picked at runtime from inside the barangay boundary, so every
// pin is guaranteed to be inside it and the pins are spread far apart.

const BOUNDARY_URL = "/barangay-167.geojson";
const MARGIN = 0.0002; // ~22 m, keeps pins off the boundary line
const CANDIDATES = 40; // more candidates = more even spacing

// category: fire | incident | crime | infrastructure
const SAMPLES = [
  {
    category: "fire",
    title: "Residential fire reported",
    status: "Responding",
    description: "A fire broke out in a two-storey residential house. Flames are spreading to the adjacent unit. Reported by a concerned neighbor passing by the area.",
    address: "Purok 3, along M. L. Quezon St.",
    reportedAt: "2026-11-02T09:41:00",
    reporter: "Resident Juan D.",
    photo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-11-02T09:41:00", note: "Report submitted by resident.", photo: null },
      { status: "Under Review", time: "2026-11-02T09:43:00", note: "Admin verified the report and escalated to fire response team.", photo: null },
      { status: "Dispatched",   time: "2026-11-02T09:46:00", note: "BFP Unit 3 dispatched to the scene.", photo: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80" },
      { status: "Responding",   time: "2026-11-02T09:52:00", note: "Responders on site. Fire being contained.", photo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80" },
    ],
  },
  {
    category: "incident",
    title: "Medical emergency",
    status: "Pending",
    description: "An elderly resident suddenly collapsed and is unresponsive. Family members are requesting immediate medical assistance.",
    address: "Purok 1, near Barangay Health Center",
    reportedAt: "2026-11-02T10:12:00",
    reporter: "Resident Maria S.",
    photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-11-02T10:12:00", note: "Report submitted by resident.", photo: null },
      { status: "Under Review", time: "2026-11-02T10:14:00", note: "Admin reviewing the report.", photo: null },
    ],
  },
  {
    category: "crime",
    title: "Reported theft",
    status: "Pending",
    description: "A motorcycle parked outside a convenience store was taken by an unidentified individual. CCTV footage from the store is available.",
    address: "Corner Rizal Ave., Purok 2",
    reportedAt: "2026-11-01T21:05:00",
    reporter: "Store owner",
    photo: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-11-01T21:05:00", note: "Report submitted by store owner.", photo: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=600&q=80" },
      { status: "Under Review", time: "2026-11-01T21:20:00", note: "Barangay tanod reviewing CCTV footage.", photo: null },
    ],
  },
  {
    category: "infrastructure",
    title: "Damaged streetlight",
    status: "Pending",
    description: "The streetlight at the end of the alley has been out for three days, making the area dark and unsafe at night for school children who pass by.",
    address: "Purok 5, Sampaguita St.",
    reportedAt: "2026-10-30T18:30:00",
    reporter: "Resident Pedro L.",
    photo: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-10-30T18:30:00", note: "Report submitted with photo of broken fixture.", photo: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=600&q=80" },
    ],
  },
  {
    category: "fire",
    title: "Grass fire near vacant lot",
    status: "Pending",
    description: "Dry grass on the vacant lot caught fire, possibly from a discarded cigarette. Fire is contained but smoke is drifting toward nearby houses.",
    address: "Vacant lot beside Purok 4 chapel",
    reportedAt: "2026-11-02T11:55:00",
    reporter: "Barangay tanod on patrol",
    photo: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-11-02T11:55:00", note: "Tanod reported grass fire on patrol.", photo: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&q=80" },
      { status: "Under Review", time: "2026-11-02T11:58:00", note: "Admin acknowledged and monitoring.", photo: null },
    ],
  },
  {
    category: "incident",
    title: "Vehicle collision on main road",
    status: "Responding",
    description: "A tricycle and a delivery van collided at the intersection. No serious injuries reported, but traffic is building up in the area.",
    address: "Intersection of Mabini St. and main road",
    reportedAt: "2026-11-02T13:20:00",
    reporter: "Passer-by Ana K.",
    photo: "https://images.unsplash.com/photo-1543393716-375f47996a77?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-11-02T13:20:00", note: "Collision reported by passer-by.", photo: "https://images.unsplash.com/photo-1543393716-375f47996a77?w=600&q=80" },
      { status: "Under Review", time: "2026-11-02T13:22:00", note: "Admin verified and dispatched tanod.", photo: null },
      { status: "Responding",   time: "2026-11-02T13:28:00", note: "Tanod on site managing traffic flow.", photo: "https://images.unsplash.com/photo-1566933293069-b55c7f326dd4?w=600&q=80" },
    ],
  },
  {
    category: "crime",
    title: "Public disturbance",
    status: "Responding",
    description: "A commotion broke out between two groups after a basketball game. Shouting has escalated and bystanders are worried it may turn physical.",
    address: "Covered court, Purok 2",
    reportedAt: "2026-11-02T14:47:00",
    reporter: "Barangay tanod on patrol",
    photo: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-11-02T14:47:00", note: "Disturbance reported by tanod.", photo: null },
      { status: "Dispatched",   time: "2026-11-02T14:50:00", note: "Additional tanod units dispatched.", photo: null },
      { status: "Responding",   time: "2026-11-02T14:55:00", note: "Situation being de-escalated by tanod.", photo: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80" },
    ],
  },
  {
    category: "infrastructure",
    title: "Clogged drainage",
    status: "In progress",
    description: "The drainage canal continues to overflow whenever it rains, flooding the street for hours. Village maintenance has begun clearing debris.",
    address: "Purok 4, near the wet market",
    reportedAt: "2026-10-28T07:15:00",
    reporter: "Resident Liza M.",
    photo: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-10-28T07:15:00", note: "Resident reported clogged drainage with photo.", photo: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=600&q=80" },
      { status: "Under Review", time: "2026-10-28T08:00:00", note: "Admin verified flooding extent.", photo: null },
      { status: "Dispatched",   time: "2026-10-28T09:30:00", note: "Maintenance team dispatched with equipment.", photo: null },
      { status: "In Progress",  time: "2026-10-28T10:00:00", note: "Crew clearing debris from drainage canal.", photo: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80" },
    ],
  },
  {
    category: "incident",
    title: "Resident fainted",
    status: "Resolved",
    description: "A resident fainted while queuing at the pharmacy. Bystanders gave first aid and the resident regained consciousness before transport.",
    address: "Pharmacy, Purok 3",
    reportedAt: "2026-10-26T15:02:00",
    reporter: "Barangay health worker",
    photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-10-26T15:02:00", note: "Health worker reported fainting incident.", photo: null },
      { status: "Under Review", time: "2026-10-26T15:04:00", note: "Admin acknowledged and dispatched medic.", photo: null },
      { status: "Responding",   time: "2026-10-26T15:09:00", note: "BDRRMO medic arrived and administered first aid.", photo: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80" },
      { status: "Resolved",     time: "2026-10-26T15:30:00", note: "Resident regained consciousness. Endorsed to clinic.", photo: "https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=600&q=80" },
    ],
  },
  {
    category: "infrastructure",
    title: "Pothole on street",
    status: "Resolved",
    description: "A deep pothole formed after days of rain, damaging several motorcycle tires. It was reported to barangay maintenance and has been filled in.",
    address: "Purok 6, along Balagtas St.",
    reportedAt: "2026-10-20T09:00:00",
    reporter: "Tricycle driver",
    photo: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&q=80",
    timeline: [
      { status: "Submitted",    time: "2026-10-20T09:00:00", note: "Tricycle driver reported pothole with photo.", photo: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=600&q=80" },
      { status: "Under Review", time: "2026-10-20T09:30:00", note: "Admin assessed severity as high.", photo: null },
      { status: "Dispatched",   time: "2026-10-20T10:00:00", note: "Public works crew dispatched.", photo: null },
      { status: "In Progress",  time: "2026-10-20T11:00:00", note: "Asphalt patching underway.", photo: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80" },
      { status: "Resolved",     time: "2026-10-20T13:00:00", note: "Pothole fully patched and road cleared.", photo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80" },
    ],
  },
];

// Small seeded random generator, so the pins stay put between reloads
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSampleIncidents(boundary) {
  const features =
    boundary.type === "FeatureCollection" ? boundary.features : [boundary];
  const bounds = L.geoJSON(boundary).getBounds();
  if (!bounds.isValid()) return [];

  const random = seededRandom(167);
  const center = bounds.getCenter();
  const lngScale = Math.cos((center.lat * Math.PI) / 180);

  const inside = (lat, lng) =>
    features.some(
      (f) => f.geometry && booleanPointInPolygon([lng, lat], f),
    );

  // Inside, and also a little away from the edge
  const insideSafe = (lat, lng) =>
    [[0, 0], [MARGIN, 0], [-MARGIN, 0], [0, MARGIN], [0, -MARGIN]].every(
      ([dLat, dLng]) => inside(lat + dLat, lng + dLng),
    );

  const between = (min, max) => min + random() * (max - min);

  const randomPoint = () => {
    for (let i = 0; i < 200; i++) {
      const lat = between(bounds.getSouth(), bounds.getNorth());
      const lng = between(bounds.getWest(), bounds.getEast());
      if (insideSafe(lat, lng)) return { lat, lng };
    }
    return null;
  };

  const distance = (a, b) =>
    Math.hypot((a.lng - b.lng) * lngScale, a.lat - b.lat);

  const placed = [];

  return SAMPLES.map((sample, index) => {
    let best = null;
    let bestGap = -1;

    // Try several spots, keep the one farthest from the pins already placed
    for (let i = 0; i < CANDIDATES; i++) {
      const point = randomPoint();
      if (!point) continue;

      const gap = placed.length
        ? Math.min(...placed.map((p) => distance(point, p)))
        : Infinity;

      if (gap > bestGap) {
        best = point;
        bestGap = gap;
      }
    }

    best ??= { lat: center.lat, lng: center.lng };
    placed.push(best);

    return { id: `sample-${index + 1}`, ...sample, ...best };
  });
}

export async function loadSampleIncidents() {
  const response = await fetch(BOUNDARY_URL);
  return buildSampleIncidents(await response.json());
}