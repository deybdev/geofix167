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
    description:
      "A fire broke out in a two-storey residential house. Flames are spreading to the adjacent unit. Reported by a concerned neighbor passing by the area.",
    address: "Purok 3, along M. L. Quezon St.",
    reportedAt: "2026-11-02T09:41:00",
    reporter: "Resident Juan D.",
  },
  {
    category: "incident",
    title: "Medical emergency",
    status: "Pending",
    description:
      "An elderly resident suddenly collapsed and is unresponsive. Family members are requesting immediate medical assistance.",
    address: "Purok 1, near Barangay Health Center",
    reportedAt: "2026-11-02T10:12:00",
    reporter: "Resident Maria S.",
  },
  {
    category: "crime",
    title: "Reported theft",
    status: "Pending",
    description:
      "A motorcycle parked outside a convenience store was taken by an unidentified individual. CCTV footage from the store is available.",
    address: "Corner Rizal Ave., Purok 2",
    reportedAt: "2026-11-01T21:05:00",
    reporter: "Store owner",
  },
  {
    category: "infrastructure",
    title: "Damaged streetlight",
    status: "Pending",
    description:
      "The streetlight at the end of the alley has been out for three days, making the area dark and unsafe at night for school children who pass by.",
    address: "Purok 5, Sampaguita St.",
    reportedAt: "2026-10-30T18:30:00",
    reporter: "Resident Pedro L.",
  },
  {
    category: "fire",
    title: "Grass fire near vacant lot",
    status: "Pending",
    description:
      "Dry grass on the vacant lot caught fire, possibly from a discarded cigarette. Fire is contained but smoke is drifting toward nearby houses.",
    address: "Vacant lot beside Purok 4 chapel",
    reportedAt: "2026-11-02T11:55:00",
    reporter: "Barangay tanod on patrol",
  },
  {
    category: "incident",
    title: "Vehicle collision on main road",
    status: "Responding",
    description:
      "A tricycle and a delivery van collided at the intersection. No serious injuries reported, but traffic is building up in the area.",
    address: "Intersection of Mabini St. and main road",
    reportedAt: "2026-11-02T13:20:00",
    reporter: "Passer-by Ana K.",
  },
  {
    category: "crime",
    title: "Public disturbance",
    status: "Responding",
    description:
      "A commotion broke out between two groups after a basketball game. Shouting has escalated and bystanders are worried it may turn physical.",
    address: "Covered court, Purok 2",
    reportedAt: "2026-11-02T14:47:00",
    reporter: "Barangay tanod on patrol",
  },
  {
    category: "infrastructure",
    title: "Clogged drainage",
    status: "In progress",
    description:
      "The drainage canal continues to overflow whenever it rains, flooding the street for hours. Village maintenance has begun clearing debris.",
    address: "Purok 4, near the wet market",
    reportedAt: "2026-10-28T07:15:00",
    reporter: "Resident Liza M.",
  },
  {
    category: "incident",
    title: "Resident fainted",
    status: "Resolved",
    description:
      "A resident fainted while queuing at the pharmacy. Bystanders gave first aid and the resident regained consciousness before transport.",
    address: "Pharmacy, Purok 3",
    reportedAt: "2026-10-26T15:02:00",
    reporter: "Barangay health worker",
  },
  {
    category: "infrastructure",
    title: "Pothole on street",
    status: "Resolved",
    description:
      "A deep pothole formed after days of rain, damaging several motorcycle tires. It was reported to barangay maintenance and has been filled in.",
    address: "Purok 6, along Balagtas St.",
    reportedAt: "2026-10-20T09:00:00",
    reporter: "Tricycle driver",
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