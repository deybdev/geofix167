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
  selectedCoordinates = null,
  onLocationSelect = null,
  isPickingLocation = false,
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
      {isPickingLocation && (
        <div className="absolute inset-x-3 top-3 z-[1000] mx-auto max-w-md rounded-lg bg-[#174b37]/95 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-sm">
          Click inside Barangay 167 to set the report location
        </div>
      )}
      <MapViewer
        incidents={incidents}
        selectedIncident={selectedReport}
        onIncidentSelect={onSelectReport}
        selectedLocation={selectedCoordinates}
        onLocationSelect={onLocationSelect}
        trackers={trackers}
        showBackButton={false}
      />
    </div>
  );
}
