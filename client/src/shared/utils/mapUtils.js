import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

const CATEGORIES = {
  fire: { color: "#dc2626", label: "Fire" },
  incident: { color: "#2563eb", label: "Incident" },
  crime: { color: "#7c3aed", label: "Crime" },
  infrastructure: { color: "#d97706", label: "Infrastructure" },
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
