import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Plus, ChevronRight } from "lucide-react";
import { getReports } from "../../services/residentService";
import { PATHS } from "../../router/paths";

const STATUS_LABELS = {
  submitted: { label: "Submitted", color: "bg-slate-100 text-slate-700" },
  under_review: { label: "Under Review", color: "bg-blue-100 text-blue-700" },
  assigned: { label: "Assigned", color: "bg-purple-100 text-purple-700" },
  in_progress: { label: "In Progress", color: "bg-amber-100 text-amber-700" },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700" },
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const CATEGORY_LABELS = {
  fire: "Fire", medical: "Medical", crime: "Crime or Threat",
  accident: "Road Accident", flood: "Flood or Storm",
  road: "Road Damage", streetlight: "Streetlight",
  drainage: "Drainage", garbage: "Garbage",
  utilities: "Water / Electricity", other: "Other",
};

export default function MyReports() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialStatus = location.state?.status ?? "";
  const [activeFilter, setActiveFilter] = useState(initialStatus);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = activeFilter ? { status: activeFilter } : {};
    getReports(params)
      .then(({ data }) => setReports(data.reports))
      .catch(() => setError("Failed to load reports."))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => navigate(PATHS.report)}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Plus size={14} />
          New Report
        </button>
      </div>

      {/* Filter tabs */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveFilter(value)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeFilter === value
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-slate-100">
            <FileText size={28} className="text-slate-400" />
          </span>
          <p className="text-sm font-semibold text-slate-700">No reports found</p>
          <p className="text-xs text-slate-500">
            {activeFilter ? "No reports with this status." : "You haven't submitted any reports yet."}
          </p>
          <button
            type="button"
            onClick={() => navigate(PATHS.report)}
            className="mt-1 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
          >
            Submit a Report
          </button>
        </div>
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="space-y-3">
          {reports.map((report) => {
            const st = STATUS_LABELS[report.status] ?? { label: report.status, color: "bg-slate-100 text-slate-700" };
            return (
              <div
                key={report.public_id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(PATHS.reportDetails, { state: { report } })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(PATHS.reportDetails, { state: { report } });
                  }
                }}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                {report.photo_url && (
                  <img
                    src={report.photo_url}
                    alt="Incident"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                      #{report.public_id.slice(-8).toUpperCase()}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-slate-800">
                    {CATEGORY_LABELS[report.category] ?? report.category}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{report.description}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {report.address || "—"} · {new Date(report.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
