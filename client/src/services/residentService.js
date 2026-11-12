// Sample data — replace with real API calls when the backend is ready.

export const SAMPLE_STATS = {
  total: 5,
  submitted: 1,
  under_review: 0,
  assigned: 1,
  in_progress: 1,
  resolved: 2,
};

export const SAMPLE_REPORTS = [
  {
    public_id: "rpt_a1b2c3d4",
    report_type: "infrastructure",
    category: "drainage",
    description: "Clogged drainage near the wet market causing flooding every time it rains.",
    address: "Purok 4, near the wet market",
    latitude: 14.7365,
    longitude: 121.0155,
    urgency: "High",
    status: "in_progress",
    photo_url: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    public_id: "rpt_e5f6g7h8",
    report_type: "infrastructure",
    category: "streetlight",
    description: "Broken streetlight at the end of the alley making the area unsafe at night.",
    address: "Purok 5, Sampaguita St.",
    latitude: 14.7342,
    longitude: 121.0125,
    urgency: "Moderate",
    status: "submitted",
    photo_url: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    public_id: "rpt_i9j0k1l2",
    report_type: "infrastructure",
    category: "road",
    description: "Deep pothole on the main road damaging motorcycle tires.",
    address: "Purok 6, along Balagtas St.",
    latitude: 14.7315,
    longitude: 121.0185,
    urgency: "High",
    status: "resolved",
    photo_url: null,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    public_id: "rpt_m3n4o5p6",
    report_type: "emergency",
    category: "fire",
    description: "Smoke coming from the second floor of a residential house.",
    address: "Purok 2, along Molave St.",
    latitude: 14.7391,
    longitude: 121.0162,
    urgency: "Critical",
    status: "assigned",
    photo_url: null,
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    public_id: "rpt_q7r8s9t0",
    report_type: "emergency",
    category: "medical",
    description: "An elderly neighbor collapsed and needs immediate medical help.",
    address: "Purok 3, near the chapel",
    latitude: 14.7378,
    longitude: 121.0131,
    urgency: "Critical",
    status: "resolved",
    photo_url: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const SAMPLE_ANNOUNCEMENTS = [
  {
    public_id: "ann_001",
    title: "Barangay De-Clogging & Cleanliness Drive",
    content:
      "De-clogging and desilting operations scheduled across Molave, Sampaguita, and Prosera Streets this Saturday starting 7:00 AM. Residents are requested to coordinate waste segregation with Barangay Agents.",
    category: "Clean & Green",
    published_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    author_name: "Admin",
  },
  {
    public_id: "ann_002",
    title: "Heavy Rainfall Alert & Emergency Hotline Standby",
    content:
      "PAGASA monsoon rains forecast for Northern Caloocan. BDRRMO response teams are stationed on 24/7 emergency alert. Report waterlogged areas immediately via GeoFix 167 or call Hotline 668-338-3141.",
    category: "BDRRMO Advisory",
    published_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    author_name: "Admin",
  },
  {
    public_id: "ann_003",
    title: "Free Anti-Rabies Vaccination & Medical Mission",
    content:
      "Caloocan City Health Department in partnership with Barangay 167 will conduct free pet anti-rabies vaccination and adult blood pressure checkups at the Barangay Covered Court this Tuesday from 8:00 AM to 3:00 PM.",
    category: "Health & Safety",
    published_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    author_name: "Admin",
  },
];

export const SAMPLE_NOTIFICATIONS = [
  {
    id: 1,
    title: "Team Dispatched",
    body: "A maintenance team has been dispatched to address your drainage report.",
    type: "report_update",
    ref_id: "rpt_a1b2c3d4",
    is_read: 0,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    title: "Report Submitted",
    body: "Your report about clogged drainage has been received and is under review.",
    type: "report_update",
    ref_id: "rpt_a1b2c3d4",
    is_read: 0,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 3,
    title: "Report Resolved",
    body: "Your pothole report on Balagtas St. has been resolved. Thank you for reporting!",
    type: "report_update",
    ref_id: "rpt_i9j0k1l2",
    is_read: 1,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Simulated async helpers — swap these for real axios calls later.
const delay = (ms = 300) => new Promise((res) => setTimeout(res, ms));

export async function getReportStats() {
  await delay();
  return { data: { stats: SAMPLE_STATS } };
}

export async function getReports({ status, limit } = {}) {
  await delay();
  let reports = [...SAMPLE_REPORTS];
  if (status) reports = reports.filter((r) => r.status === status);
  if (limit) reports = reports.slice(0, limit);
  return { data: { reports } };
}

export async function getAnnouncements() {
  await delay();
  return { data: { announcements: SAMPLE_ANNOUNCEMENTS } };
}

export async function getNotifications() {
  await delay();
  const unread_count = SAMPLE_NOTIFICATIONS.filter((n) => !n.is_read).length;
  return { data: { notifications: SAMPLE_NOTIFICATIONS, unread_count } };
}

export async function markNotificationRead(id) {
  await delay(100);
  const n = SAMPLE_NOTIFICATIONS.find((n) => n.id === id);
  if (n) n.is_read = 1;
  return { data: { ok: true } };
}

export async function markAllNotificationsRead() {
  await delay(100);
  SAMPLE_NOTIFICATIONS.forEach((n) => { n.is_read = 1; });
  return { data: { ok: true } };
}
