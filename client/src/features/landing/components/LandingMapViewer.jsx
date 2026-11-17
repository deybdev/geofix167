import { useMemo } from "react";
import MapViewer from "../../../shared/components/MapViewer";

function getMapCategory(report) {
  if (report.type === "maintenance" || report.type === "pending") {
    return "infrastructure";
  }

  const category = String(report.category || "").toLowerCase();
  if (category.includes("fire")) return "fire";
  if (category.includes("crime") || category.includes("police")) return "crime";
  return "incident";
}

export default function LandingMapViewer({
  reports = [],
  bdrrmoUnits = [],
  selectedReport = null,
  onSelectReport = () => {},
}) {
  const incidents = useMemo(
    () => reports.map((report) => ({
      ...report,
      category: getMapCategory(report),
      status: report.statusLabel || report.status,
    })),
    [reports],
  );

  const trackers = useMemo(
    () => bdrrmoUnits.map((unit) => ({
      id: unit.id,
      lat: unit.lat,
      lng: unit.lng,
      color: unit.type === "maintenance" ? "#d97706" : "#0284c7",
    })),
    [bdrrmoUnits],
  );

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-[#dbe5dc] bg-slate-100 shadow-sm">
      <MapViewer
        incidents={incidents}
        selectedIncident={selectedReport}
        onIncidentSelect={onSelectReport}
        trackers={trackers}
        showBackButton={false}
      />
    </div>
  );
}
