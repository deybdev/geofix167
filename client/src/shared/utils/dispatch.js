/* Mocked dispatch data + route math shared by the admin dispatch console
   (IncidentReports) and the resident request-tracking view. */

/* Response-station coordinates around Barangay 167, matched to MapViewer
   pin categories (crime/fire/incident/infrastructure). */
export const RESPONSE_FACILITIES = {
  police: { name: "Police Community Precinct 7", lat: 14.7331, lng: 121.0158, via: "Quezon Ave" },
  fire: { name: "Caloocan Fire Sub-Station 167", lat: 14.7301, lng: 121.0201, via: "Rizal St Ext." },
  hospital: { name: "Rizal Medical Center", lat: 14.7284, lng: 121.0106, via: "Magsaysay Blvd" },
  barangay: { name: "Barangay Hall 167", lat: 14.7315, lng: 121.0185, via: "Barangay Rd" },
};

export const FACILITY_PIN_CATEGORY = {
  police: "crime",
  fire: "fire",
  hospital: "incident",
  barangay: "infrastructure",
};

/* Responder profiles shown to the reporting resident once dispatch confirms. */
export const RESPONDERS = {
  fire: { name: "SFO2 Ramon Dela Cruz", unit: "FT-02", agency: "Caloocan Fire Sub-Station 167", contact: "09175550202" },
  police: { name: "PCpl. Andres Reyes", unit: "PN-07", agency: "Police Community Precinct 7", contact: "09175550707" },
  hospital: { name: "EMT Maria Santos", unit: "AMB-03", agency: "Rizal Medical Center", contact: "09175550303" },
  barangay: { name: "Engr. Lito Mendoza", unit: "MT-A1", agency: "Barangay Maintenance Team A", contact: "09175550101" },
};

/* Three-point route walked by the responder, departing the responding station
   and terminating at the incident, with a perpendicular bend at the midpoint
   so it reads as a road rather than a straight line. */
export function routePoints(unitKey, report) {
  const facility = RESPONSE_FACILITIES[unitKey];
  const mid = { lat: (report.lat + facility.lat) / 2, lng: (report.lng + facility.lng) / 2 };
  const bend = { lat: mid.lat + (report.lng - facility.lng) * 0.14, lng: mid.lng - (report.lat - facility.lat) * 0.14 };
  return [{ lat: facility.lat, lng: facility.lng }, bend, { lat: report.lat, lng: report.lng }];
}

/* Progress fraction of each tracking stage along the responder's route. */
export const STAGE_PROGRESS = [0.18, 0.62, 1];

/* Position on a polyline at fraction t of its total length. */
export function pointAtFraction(points, t) {
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

/* Straight-line distance (km) and driving ETA at ~28 km/h + 1 min dispatch overhead. */
export function distanceKm(point, facility) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (facility.lat - point.lat) * rad, dLng = (facility.lng - point.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(point.lat * rad) * Math.cos(facility.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function facilityInfo(agencyKey, report) {
  const facility = RESPONSE_FACILITIES[agencyKey];
  const km = Number(distanceKm(report, facility).toFixed(1));
  const mins = Math.max(2, Math.round((km / 28) * 60) + 1);
  return { name: facility.name, via: facility.via, km, eta: `${mins} mins` };
}

/* --------------------------- Real road routing --------------------------- */

const routeCache = new Map();

/* Road-following geometry between two points via the public OSRM demo
   router (free, no API key — same pattern as the Nominatim geocoder).
   Resolves { points, distanceKm, durationMin } or throws; callers fall
   back to the mock bent-line route when it fails. */
export async function fetchRoadRoute(from, to, signal) {
  const key = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
  if (routeCache.has(key)) return routeCache.get(key);

  const url =
    "https://router.project-osrm.org/route/v1/driving" +
    `/${from.lng},${from.lat};${to.lng},${to.lat}` +
    "?overview=full&geometries=geojson";

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Routing failed (${res.status})`);

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) throw new Error("No route found");

  const result = {
    points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
  routeCache.set(key, result);
  return result;
}
