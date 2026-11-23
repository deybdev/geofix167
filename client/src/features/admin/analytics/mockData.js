// ─── Mock / demo data for GeoFix 167 Analytics Dashboard ────────────────────
// Clearly labelled as demo data. Structure mirrors future real API responses.

export const KPI_DATA = {
  today: {
    totalReports: 4, pendingReports: 2, resolvedReports: 1,
    activeEmergencies: 1, avgResponseTime: 11, resolutionRate: 25,
    prev: { totalReports: 3, pendingReports: 1, resolvedReports: 2, activeEmergencies: 0, avgResponseTime: 14, resolutionRate: 67 },
  },
  week: {
    totalReports: 18, pendingReports: 6, resolvedReports: 9,
    activeEmergencies: 3, avgResponseTime: 13, resolutionRate: 50,
    prev: { totalReports: 15, pendingReports: 8, resolvedReports: 6, activeEmergencies: 2, avgResponseTime: 17, resolutionRate: 40 },
  },
  month: {
    totalReports: 64, pendingReports: 14, resolvedReports: 42,
    activeEmergencies: 8, avgResponseTime: 14, resolutionRate: 66,
    prev: { totalReports: 55, pendingReports: 18, resolvedReports: 32, activeEmergencies: 5, avgResponseTime: 18, resolutionRate: 58 },
  },
  year: {
    totalReports: 312, pendingReports: 28, resolvedReports: 248,
    activeEmergencies: 12, avgResponseTime: 16, resolutionRate: 79,
    prev: { totalReports: 274, pendingReports: 35, resolvedReports: 210, activeEmergencies: 9, avgResponseTime: 21, resolutionRate: 77 },
  },
};

export const TREND_MONTHLY = [
  { label: "Nov", value: 38 }, { label: "Dec", value: 29 },
  { label: "Jan", value: 44 }, { label: "Feb", value: 51 },
  { label: "Mar", value: 47 }, { label: "Apr", value: 64 },
];

export const TREND_WEEKLY = [
  { label: "W1", value: 12 }, { label: "W2", value: 18 },
  { label: "W3", value: 15 }, { label: "W4", value: 19 },
];

export const TREND_DAILY = [
  { label: "Mon", value: 3 }, { label: "Tue", value: 5 },
  { label: "Wed", value: 4 }, { label: "Thu", value: 7 },
  { label: "Fri", value: 6 }, { label: "Sat", value: 2 },
  { label: "Sun", value: 1 },
];

export const BY_CATEGORY = [
  { label: "Road Damage", value: 22, color: "#f59e0b" },
  { label: "Electrical", value: 18, color: "#3b82f6" },
  { label: "Sanitation", value: 14, color: "#2e8b57" },
  { label: "Incident / Emergency", value: 10, color: "#dc2626" },
  { label: "Flooding", value: 8, color: "#0ea5e9" },
  { label: "Hazardous Tree", value: 5, color: "#84cc16" },
  { label: "Water Pipe", value: 4, color: "#8b5cf6" },
];

export const BY_STATUS = [
  { label: "Pending", value: 14, color: "#f59e0b" },
  { label: "Dispatched", value: 8, color: "#3b82f6" },
  { label: "In Progress", value: 12, color: "#8b5cf6" },
  { label: "Resolved", value: 42, color: "#2e8b57" },
  { label: "Rejected", value: 4, color: "#dc2626" },
];

export const TOP_ISSUES = [
  { label: "Potholes / Road Damage", value: 22 },
  { label: "Broken Streetlights", value: 18 },
  { label: "Clogged Drainage", value: 14 },
  { label: "Garbage Accumulation", value: 11 },
  { label: "Leaking Water Pipes", value: 9 },
  { label: "Hazardous Trees", value: 5 },
  { label: "Dangling Electrical Wires", value: 4 },
];

export const EMERGENCY_METRICS = {
  avgDispatchTime: 4,
  avgArrivalTime: 9,
  avgResolutionTime: 38,
  totalRequests: 34,
  completed: 26,
  pending: 8,
};

export const EMERGENCY_BY_CAT = [
  { label: "Medical", value: 12, color: "#dc2626" },
  { label: "Accident", value: 9, color: "#f59e0b" },
  { label: "Fire", value: 6, color: "#ea580c" },
  { label: "Flood", value: 5, color: "#0ea5e9" },
  { label: "Crime", value: 2, color: "#7c3aed" },
];

export const MAINTENANCE_BY_CAT = [
  { label: "Road Damage", resolved: 18, unresolved: 4, color: "#f59e0b" },
  { label: "Electrical", resolved: 14, unresolved: 4, color: "#3b82f6" },
  { label: "Sanitation", resolved: 11, unresolved: 3, color: "#2e8b57" },
  { label: "Water Pipe", resolved: 7, unresolved: 2, color: "#8b5cf6" },
  { label: "Hazardous Tree", resolved: 4, unresolved: 1, color: "#84cc16" },
];

export const MAINTENANCE_MONTHLY = [
  { label: "Nov", reported: 28, resolved: 22 },
  { label: "Dec", reported: 21, resolved: 18 },
  { label: "Jan", reported: 33, resolved: 27 },
  { label: "Feb", reported: 38, resolved: 31 },
  { label: "Mar", reported: 35, resolved: 29 },
  { label: "Apr", reported: 48, resolved: 38 },
];

export const GEO_INCIDENTS = [
  { id: "A-001", title: "Pothole on Rizal Street", category: "infrastructure", status: "In Progress", lat: 14.7299, lng: 121.0129 },
  { id: "A-002", title: "Broken Streetlight", category: "infrastructure", status: "Reported", lat: 14.7321, lng: 121.0192 },
  { id: "A-003", title: "Clogged Drainage", category: "infrastructure", status: "Verified Fixed", lat: 14.7269, lng: 121.0174 },
  { id: "A-004", title: "Vehicular Accident", category: "incident", status: "In Progress", lat: 14.7307, lng: 121.0138 },
  { id: "A-005", title: "Exposed Power Lines", category: "infrastructure", status: "Reported", lat: 14.7292, lng: 121.0161 },
  { id: "A-006", title: "Fire Incident", category: "fire", status: "Resolved", lat: 14.7315, lng: 121.0148 },
  { id: "A-007", title: "Flooding on Magsaysay", category: "incident", status: "In Progress", lat: 14.7278, lng: 121.0182 },
  { id: "A-008", title: "Cracked Sidewalk", category: "infrastructure", status: "Reported", lat: 14.7334, lng: 121.0165 },
  { id: "A-009", title: "Garbage Accumulation", category: "infrastructure", status: "Reported", lat: 14.7258, lng: 121.0143 },
  { id: "A-010", title: "Medical Emergency", category: "incident", status: "Resolved", lat: 14.7302, lng: 121.0197 },
];
