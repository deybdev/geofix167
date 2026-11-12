import { useEffect, useState } from "react";
import LandingFooter from "../features/landing/components/LandingFooter";
import LandingHeader from "../features/landing/components/LandingHeader";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import LandingMapViewer from "../features/landing/components/LandingMapViewer";
import ResidentReportingCard from "../features/landing/components/ResidentReportingCard";
import BarangayAnnouncementsCard from "../features/landing/components/BarangayAnnouncementsCard";
import QuickReportModal from "../features/landing/components/QuickReportModal";
import { INITIAL_BDRRMO_UNITS } from "../features/landing/data/landingData";

function toMapReport(report) {
  const lat = report.latitude == null ? null : Number(report.latitude);
  const lng = report.longitude == null ? null : Number(report.longitude);
  return {
    id: report.incident_id,
    reportNumber: report.reference_number,
    type: report.is_emergency ? "sudden" : "maintenance",
    category: report.incident_category || report.category,
    title: report.title,
    location: report.location_description || report.landmark_description || "Location not provided",
    status: report.status_code,
    statusLabel: report.status_label,
    urgency: report.priority_level,
    reportedAt: report.received_at || report.submitted_at,
    description: report.sanitized_description || report.description_sanitized || "",
    ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
  };
}

export default function LiveMapPage() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);
  const handleAddReport = (report) => { setReports((current) => [report, ...current]); setSelectedReport(report); setSelectedCoordinates(null); };

  useEffect(() => {
    let active = true;
    fetch("/api/reports", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          const incidentId = sessionStorage.getItem("geofix:last-guest-report");
          const token = incidentId && sessionStorage.getItem(`geofix:guest-report:${incidentId}`);
          if (!incidentId || !token) return [];
          const guestResponse = await fetch(`/api/reports/${encodeURIComponent(incidentId)}`, {
            headers: { "X-Guest-Token": token },
            cache: "no-store",
          });
          if (!guestResponse.ok) return [];
          const detail = await guestResponse.json();
          return detail.report ? [toMapReport(detail.report)] : [];
        }
        if (!response.ok) throw new Error("Unable to load reports.");
        const data = await response.json();
        return (data.reports || []).map(toMapReport);
      })
      .then((items) => { if (active) setReports(items); })
      .catch((error) => console.error("Report list error:", error));
    return () => { active = false; };
  }, []);

  return <><LandingHeader onReportClick={() => setIsQuickReportOpen(true)} /><BarangayStatusBanner />
    <main className="mx-auto min-h-[70vh] max-w-[1600px] px-4 py-7 sm:px-8 lg:px-10">
      <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Barangay 167 · Caloocan City</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Live Map &amp; Reports</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">View community reports, response activity, and choose a location for your report.</p></div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="relative z-0 isolate flex h-[500px] flex-col sm:h-[580px] lg:col-span-7 lg:h-[680px] xl:col-span-8"><LandingMapViewer reports={reports} bdrrmoUnits={INITIAL_BDRRMO_UNITS} selectedReport={selectedReport} onSelectReport={setSelectedReport} selectedCoordinates={selectedCoordinates} onLocationSelect={(coords) => { setSelectedCoordinates(coords); if (isPickingLocation) setActiveTab("submit"); }} isPickingLocation={isPickingLocation} /></div>
        <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4"><ResidentReportingCard reports={reports} selectedReport={selectedReport} onSelectReport={setSelectedReport} onSubmitNewReport={handleAddReport} activeTab={activeTab} setActiveTab={setActiveTab} selectedCoordinates={selectedCoordinates} isPickingLocation={isPickingLocation} setIsPickingLocation={setIsPickingLocation} /><BarangayAnnouncementsCard /></div>
      </div>
    </main><LandingFooter /><QuickReportModal isOpen={isQuickReportOpen} onClose={() => setIsQuickReportOpen(false)} onSubmitNewReport={handleAddReport} defaultCoordinates={selectedCoordinates} /></>;
}
