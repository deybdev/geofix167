import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, CheckCircle2, ChevronRight, Clock, Flame, Siren, Wrench,
} from "lucide-react";
import { PATHS } from "../../router/paths";
import MapViewer from "../../shared/components/MapViewer";

function parseUtc(value) {
  if (!value) return NaN;
  const text = String(value).trim();
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? text.replace(" ", "T") + "Z" : text);
}

function formatPhDate(value) {
  const ts = parseUtc(value);
  if (!Number.isFinite(ts)) return "—";
  return new Date(ts).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const STATUS_BADGE = {
  1: { label: "Submitted", type: "reported" },
  2: { label: "Under Review", type: "reported" },
  3: { label: "Needs Clarification", type: "reported" },
  4: { label: "Verified", type: "reported" },
  5: { label: "Forwarded to BDRRMO", type: "reported" },
  6: { label: "Assigned", type: "progress" },
  7: { label: "En Route", type: "progress" },
  8: { label: "On Scene", type: "progress" },
  9: { label: "For Closure Review", type: "progress" },
  10: { label: "Resolved", type: "fixed" },
  11: { label: "Rejected", type: "rejected" },
  12: { label: "Duplicate", type: "rejected" },
  13: { label: "Dispatched", type: "progress" },
  14: { label: "Awaiting DRRMO", type: "reported" },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [heatmap, setHeatmap] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/reports?limit=200", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.reports)) {
          setReports(data.reports);
        }
      } catch {
        // Keep last loaded state on transient network error
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const stats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => [1, 2, 3, 4, 5, 14].includes(Number(r.incident_status_id))).length;
    const dispatched = reports.filter((r) => [6, 13].includes(Number(r.incident_status_id))).length;
    const inProgress = reports.filter((r) => [7, 8, 9].includes(Number(r.incident_status_id))).length;
    const resolved = reports.filter((r) => Number(r.incident_status_id) === 10).length;
    return { total, pending, dispatched, inProgress, resolved };
  }, [reports]);

  const metrics = [
    ["TOTAL REPORTS", stats.total, "All live reports in system", BarChart3, "bg-[#e7f4ed] text-[#2e8b57]"],
    ["PENDING", stats.pending, "Awaiting dispatch or action", Clock, "bg-[#fff8e6] text-[#f59e0b]"],
    ["DISPATCHED", stats.dispatched, "Units assigned, rolling out", Siren, "bg-[#eff6ff] text-[#3b82f6]"],
    ["IN PROGRESS", stats.inProgress, "Being handled in the field", Wrench, "bg-[#f5f0ff] text-[#8b5cf6]"],
    ["RESOLVED", stats.resolved, "Fixed and verified", CheckCircle2, "bg-[#e7f4ed] text-[#2e8b57]"],
  ];

  const mapIncidents = useMemo(
    () =>
      reports
        .filter((r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) && ![11, 12].includes(Number(r.incident_status_id)))
        .map((r) => ({
          id: r.reference_number || r.incident_id,
          title: r.title || r.category || "Incident",
          category: Number(r.is_emergency) === 1 ? "incident" : "infrastructure",
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          location: r.location_description || "Barangay 167",
          status: STATUS_BADGE[Number(r.incident_status_id)]?.label || "Reported",
        })),
    [reports],
  );

  const recentRows = useMemo(() => reports.slice(0, 10), [reports]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {metrics.map(([label, value, description, Icon, iconBg]) => (
          <div key={label} className="rounded-lg border border-[#e2e8eb] bg-white p-4 shadow-[0_2px_8px_rgba(27,52,70,0.03)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold leading-tight text-slate-500">{label}</p>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
                <Icon size={14} />
              </div>
            </div>
            <div className="mt-2 text-[23px] font-bold text-[#2e8b57]">{loading ? "…" : value}</div>
            <div className="text-[9px] text-slate-400">{description}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-[#e2e8eb] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[12px] font-bold text-[#2e8b57]">Live Incident &amp; Infrastructure Cluster</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHeatmap((on) => !on)}
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-semibold ${heatmap ? "border-[#2e8b57] bg-[#2e8b57] text-white" : "border-[#d9e8df] text-[#2e8b57]"}`}
            >
              <Flame size={11} /> {heatmap ? "Show Pins" : "Heatmap"}
            </button>
            <button
              type="button"
              onClick={() => navigate(PATHS.adminMapView)}
              className="flex items-center gap-1 rounded border border-[#d9e8df] px-2 py-1 text-[9px] font-semibold text-[#2e8b57] hover:bg-[#e7f4ed]"
            >
              Go to Map View <ChevronRight size={11} />
            </button>
          </div>
        </div>
        <MapViewer incidents={mapIncidents} compact heatmap={heatmap} expandPath={PATHS.adminMapView} />
      </section>

      <section className="rounded-lg border border-[#e2e8eb] bg-white p-3">
        <h2 className="mb-2 text-[12px] font-bold text-[#2e8b57]">Recent Incident &amp; Infrastructure Reports</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-[10px]">
            <thead>
              <tr className="rounded bg-[#f5f8fa] text-slate-500">
                <th className="rounded-l px-3 py-2">Report ID</th>
                <th className="px-3 py-2">Incident Report</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Date Submitted (PH)</th>
                <th className="rounded-r px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((r) => {
                const badge = STATUS_BADGE[Number(r.incident_status_id)] ?? { label: "Reported", type: "reported" };
                return (
                  <tr key={r.incident_id} className="border-b border-[#e7ecef] last:border-0 hover:bg-[#f8fbf9]">
                    <td className="px-3 py-3 font-bold text-[#2e8b57]">{r.reference_number || r.incident_id.slice(0, 8)}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{r.title || r.category}</td>
                    <td className="px-3 py-3 text-slate-500">{r.category || "General"}</td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-slate-500">{r.location_description || "Barangay 167"}</td>
                    <td className="px-3 py-3 text-slate-600">{Number(r.is_emergency) === 1 ? "Emergency" : "Maintenance"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatPhDate(r.submitted_at)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded px-2 py-1 text-[9px] font-semibold ${
                          badge.type === "fixed"
                            ? "bg-[#d9f7e4] text-[#2e8b57]"
                            : badge.type === "progress"
                              ? "bg-[#dcefe5] text-[#2e8b57]"
                              : badge.type === "rejected"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-[#fff1c6] text-[#e69500]"
                        }`}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!recentRows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-400">
                    {loading ? "Loading live reports…" : "No reports submitted yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
