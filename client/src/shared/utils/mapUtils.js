import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

const CATEGORIES = {
  fire: {
    color: "#dc2626",
    label: "Fire",
    glyph:
      '<path d="M14 18V9H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2M9 18h6"/>' +
      '<path d="M14 12h4l3 3.5V17a1 1 0 0 1-1 1h-1M4 5h9M6 5v4M11 5v4"/>' +
      '<circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  },
  incident: {
    color: "#2563eb",
    label: "Incident",
    glyph:
      '<path d="M10 10H6M8 8v4M9 18h6"/>' +
      '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>' +
      '<path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/>' +
      '<circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  },
  crime: {
    color: "#7c3aed",
    label: "Crime",
    glyph:
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
      '<path fill="#fff" stroke-width="1" d="M12 7.8l.82 2.07 2.22.14-1.71 1.42.55 2.16L12 12.4l-1.88 1.19.55-2.16-1.71-1.42 2.22-.14z"/>',
  },
  infrastructure: {
    color: "#d97706",
    label: "Infrastructure",
    glyph:
      '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  },
};

export const STATUSES = {
  pending: { color: "#f59e0b", label: "Pending" },
  ongoing: { color: "#3b82f6", label: "Ongoing" },
  resolved: { color: "#16a34a", label: "Resolved" },
};

const STATUS_MATCH = [
  ["ongoing", /progress|ongoing|responding|assigned/],
  ["resolved", /resolv|done|complete|closed/],
  ["rejected", /reject|invalid|declin/],
];

const CATEGORY_ALIASES = { emergency: "incident" };

export function getCategory(value) {
  const name = String(value).toLowerCase();
  const alias = CATEGORY_ALIASES[name] ?? name;
  const key = alias in CATEGORIES ? alias : "incident";
  return { key, ...CATEGORIES[key] };
}

export function getStatus(value) {
  const text = String(value || "").toLowerCase();
  const match = STATUS_MATCH.find(([, regex]) => regex.test(text));
  const key = match ? match[0] : "pending";
  return { key, ...STATUSES[key] };
}

export const getFeatures = (boundary) => {
  if (!boundary || typeof boundary !== "object") return [];
  if (boundary.type === "FeatureCollection") return boundary.features ?? [];
  if (boundary.type === "Feature") return [boundary];
  if (boundary.type === "Polygon" || boundary.type === "MultiPolygon") {
    return [{ type: "Feature", properties: {}, geometry: boundary }];
  }
  return [];
};

export function isInside(lat, lng, boundary) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return false;
  }

  return getFeatures(boundary).some((feature) => {
    const geometry = feature?.geometry;
    if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) {
      return false;
    }

    return booleanPointInPolygon([longitude, latitude], feature);
  });
}
