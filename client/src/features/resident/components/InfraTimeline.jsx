import { useState } from "react";

/* Demo evidence photo the maintenance team uploads during the repair
   (before-and-after shots), same demo imagery as the sample incidents */
export const REPAIR_PHOTO_URL =
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80";

/* The infrastructure reporting workflow for the resident — exactly five
   statuses: Submitted, Under Review, Assigned, In Progress, Resolved. */
export const STAGES = [
  {
    status: "Submitted",
    color: "#94a3b8",
    note: () => "You submitted this report with a pinned location on the map.",
  },
  {
    status: "Under Review",
    color: "#3b82f6",
    note: ({ id, categoryLabel }) =>
      `GeoFix logged your report as #${id} and set it to Pending. Barangay staff validate that it is genuine, inside Barangay 167, and not a duplicate, then classify it as "${categoryLabel}" with its severity and urgency.`,
  },
  {
    status: "Assigned",
    color: "#f59e0b",
    note: ({ team, target }) =>
      `Assigned to the ${team}, with instructions and a target completion date of ${target}.`,
  },
  {
    status: "In Progress",
    color: "#f97316",
    note: () =>
      "The maintenance team is on site performing the repair and uploading before-and-after photos.",
  },
  {
    status: "Resolved",
    color: "#16a34a",
    note: () =>
      "The barangay verified the repair evidence and closed the report. You have been notified — thank you for helping improve the barangay!",
  },
];

/* Responsible crew per infrastructure category */
export const TEAM_BY_CATEGORY = {
  road: "Barangay Public Works Crew",
  streetlight: "Electrical Maintenance Team",
  drainage: "Drainage and Flood Control Crew",
  garbage: "Waste Management Team",
  utilities: "Utilities Coordination Team",
  other: "Barangay Maintenance Team",
};

/* Header status line per workflow stage */
export const STATUS_LINES = [
  { text: "Report submitted", color: "text-primary" },
  { text: "Under review by barangay staff", color: "text-blue-600" },
  { text: "Assigned to maintenance team", color: "text-amber-600" },
  { text: "Repair in progress", color: "text-orange-600" },
  { text: "Resolved — report closed", color: "text-emerald-600" },
];

/* Maps a stored report status to the furthest workflow stage it has reached.
   "dispatched" is a legacy alias for Assigned. */
export function statusToStage(status) {
  switch (status) {
    case "under_review": return 1;
    case "assigned":
    case "dispatched": return 2;
    case "in_progress": return 3;
    case "resolved": return 4;
    default: return 0; // submitted
  }
}

/* Minutes after submission each stage plausibly completed — used to give
   stored reports demo timestamps for their finished stages. */
export const STAGE_OFFSET_MIN = [0, 30, 120, 240, 2880];

export function formatTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TimelineItem({ entry, isLast }) {
  const [photosOpen, setPhotosOpen] = useState(false);
  const photos = entry.photos ?? [];

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
          style={{ background: entry.color }}
        />
        {!isLast && <span className="mt-1 w-px flex-1 bg-slate-200" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color: entry.color }}>
            {entry.status}
          </span>
          {entry.time && (
            <span className="text-[10px] text-slate-400">
              {formatTime(entry.time)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">
          {entry.note}
        </p>
        {photos.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setPhotosOpen((v) => !v)}
              className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform duration-200 ${
                  photosOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {photosOpen
                ? `Hide ${photos.length > 1 ? "photos" : "photo"}`
                : `View ${photos.length > 1 ? "photos" : "photo"}`}
            </button>
            {photosOpen && (
              <div
                className={
                  photos.length > 1
                    ? "mt-2 flex flex-wrap gap-2"
                    : undefined
                }
              >
                {photos.map((photo, i) => (
                  <img
                    key={`${entry.status}-photo-${i}`}
                    src={photo}
                    alt={`${entry.status} photo ${i + 1}`}
                    className={
                      photos.length > 1
                        ? "h-24 w-24 rounded-xl object-cover"
                        : "mt-2 rounded-xl object-cover"
                    }
                    style={
                      photos.length > 1
                        ? undefined
                        : { width: "100%", maxWidth: 260, maxHeight: 160, display: "block" }
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* The workflow timeline list. Only the stages actually reached render —
   stages beyond `currentStage` are omitted, not grayed out. `stageTimes`
   supplies demo timestamps for completed stages (falls back to createdAt
   for stage 0). `photos` maps a stage name to its photo-evidence array. */
export default function InfraTimeline({
  category,
  categoryLabel,
  reportId,
  currentStage = 0,
  stageTimes = null,
  photos = {},
  createdAt = null,
}) {
  const team = TEAM_BY_CATEGORY[category] ?? TEAM_BY_CATEGORY.other;
  const target = new Date(
    createdAt ? new Date(createdAt).getTime() : Date.now() + 5 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

  const timeline = STAGES.slice(0, currentStage + 1).map((entry, i) => {
    let time = null;
    if (stageTimes?.[i]) time = stageTimes[i];
    else if (i === 0 && createdAt) time = createdAt;
    else if (createdAt) {
      time = new Date(
        new Date(createdAt).getTime() + STAGE_OFFSET_MIN[i] * 60000,
      ).toISOString();
    }
    return {
      ...entry,
      time,
      note: entry.note({ id: reportId, categoryLabel, team, target }),
      photos: photos[entry.status] ?? null,
    };
  });

  return (
    <div>
      {timeline.map((entry, i) => (
        <TimelineItem
          key={`${entry.status}-${i}`}
          entry={entry}
          isLast={i === timeline.length - 1}
        />
      ))}
    </div>
  );
}
