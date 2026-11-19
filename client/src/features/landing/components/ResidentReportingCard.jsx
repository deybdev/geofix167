import { CheckCircle } from "lucide-react";
import GuestReportForm from "./GuestReportForm";

function reportLocationLabel(report) {
  const location = typeof report.location === "string" ? report.location.trim() : "";
  const looksLikeCoordinates = /^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(location);
  if (location && !looksLikeCoordinates) return location;
  if (report.outsideBarangayBoundary || report.withinBarangayBoundary === 0 || report.withinBarangayBoundary === false) {
    return "Pinned outside Barangay 167";
  }
  if (report.withinBarangayBoundary === 1 || report.withinBarangayBoundary === true) {
    return "Pinned location, Barangay 167";
  }
  return report.lat != null && report.lng != null ? "Pinned on map" : "Location details under review";
}

export default function ResidentReportingCard({
  reports = [],
  selectedReport = null,
  onSelectReport = () => {},
  onViewReport = onSelectReport,
  onSubmitNewReport = () => {},
  activeTab = "active",
  setActiveTab = () => {},
}) {
  return (
    <div className="landing-card flex min-w-0 flex-col p-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-slate-900">Resident Reporting Dashboard</h3>
          <p className="text-xs font-medium text-slate-500">Live public reports &amp; community response tracker</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${activeTab === "active" ? "bg-[#174b37] text-white" : "text-slate-600 hover:text-slate-900"}`}
        >
          <span>Active Reports</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === "active" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}>{reports.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("submit")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${activeTab === "submit" ? "bg-[#174b37] text-white" : "text-slate-600 hover:text-slate-900"}`}
        >
          <span>Submit Report</span>
        </button>
      </div>

      {activeTab === "active" && (
        <div className="mt-4 flex max-h-[300px] flex-col gap-2.5 overflow-y-auto pr-1 scrollbar-thin">
          {reports.map((report) => {
            const isSelected = selectedReport?.id === report.id;
            const location = reportLocationLabel(report);
            const hasCoordinates = report.lat != null && report.lng != null
              && Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng));
            return (
              <article
                key={report.id}
                onClick={() => onSelectReport(report)}
                className={`group rounded-xl border p-3 transition-all ${isSelected ? "border-[#174b37] bg-[#edf3ec]" : "border-slate-100 bg-slate-50/60 hover:border-slate-300 hover:bg-white"}`}
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle size={17} className={`mt-0.5 shrink-0 ${report.status === "resolved" ? "text-emerald-600" : "text-[#2E8B57]"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-snug text-slate-900 group-hover:text-[#2E8B57]">{report.title}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-600">{location}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">({report.statusLabel})</p>
                    {hasCoordinates && (
                      <button type="button" aria-label={`View ${report.title} on map`} aria-pressed={isSelected} onClick={(event) => { event.stopPropagation(); onViewReport(report); }} className="relative z-10 mt-1 inline-flex min-h-8 cursor-pointer items-center rounded-md px-2 text-[10px] font-bold text-[#247447] underline-offset-2 transition hover:bg-emerald-50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                        View on map
                      </button>
                    )}
                  </div>
                  {report.hasProof && <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">QR Verified</span>}
                </div>
                <button type="button" aria-label={`Focus ${report.title} on map`} onClick={() => onSelectReport(report)} className="sr-only">View report on map</button>
              </article>
            );
          })}
          {!reports.length && <p className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-center text-xs text-slate-500">No active reports to show yet.</p>}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Click any report to zoom on map</span>
            <span className="font-semibold text-[#2E8B57]">Auto-refreshed</span>
          </div>
        </div>
      )}

      {activeTab === "submit" && (
        <div className="mt-4 min-w-0">
          <GuestReportForm
            embedded
            onSubmitNewReport={onSubmitNewReport}
            onSuccess={(report) => { if (!report?.tracking_url) setActiveTab("active"); }}
            onClose={() => setActiveTab("active")}
          />
        </div>
      )}
    </div>
  );
}
