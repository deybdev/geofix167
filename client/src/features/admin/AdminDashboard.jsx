import { useState } from "react";
import {
  BarChart3, CheckCircle2, ChevronRight, Clock, Flame, Siren, Wrench,
} from "lucide-react";
import { PATHS } from "../../router/paths";
import MapViewer from "../../shared/components/MapViewer";
import { BY_STATUS, GEO_INCIDENTS, KPI_DATA } from "./analytics/mockData";

const KPI = KPI_DATA.month;
const statusCount = (label) => BY_STATUS.find((status) => status.label === label)?.value ?? 0;

const metrics = [
  ["TOTAL REPORTS", KPI.totalReports, "All reports this month", BarChart3, "bg-[#e7f4ed] text-[#2e8b57]"],
  ["PENDING", KPI.pendingReports, "Awaiting dispatch or action", Clock, "bg-[#fff8e6] text-[#f59e0b]"],
  ["DISPATCHED", statusCount("Dispatched"), "Units assigned, rolling out", Siren, "bg-[#eff6ff] text-[#3b82f6]"],
  ["IN PROGRESS", statusCount("In Progress"), "Being handled in the field", Wrench, "bg-[#f5f0ff] text-[#8b5cf6]"],
  ["RESOLVED", KPI.resolvedReports, "Fixed and verified this month", CheckCircle2, "bg-[#e7f4ed] text-[#2e8b57]"],
];

const reports = [
  ["GF-001", "Pothole on Rizal Street", "Road Damage", "Rizal Street", "Marvin Navarrete", "April 22, 2026", "Reported", "reported"],
  ["GF-002", "Broken Streetlight Pole", "Electrical", "Quezon Avenue", "John Kyle Paroni", "April 21, 2026", "In Progress", "progress"],
  ["GF-003", "Clogged Drainage Canal", "Sanitation", "Magsaysay Boulevard", "Efren Cahilig", "April 20, 2026", "Verified Fixed", "fixed"],
  ["GF-006", "Accident (DEMO)", "Incident / Emergency", "Rizal Street", "Demo Guest", "Demo record", "Dispatch Pending", "reported"],
];

const URGENT_BG = { fire: "bg-[#fdecea]", incident: "bg-[#fdecea]", infrastructure: "bg-[#fff1c6]" };
const URGENT_TEXT = { fire: "text-[#dc2626]", incident: "text-[#dc2626]", infrastructure: "text-[#f59e0b]" };

const urgentReports = GEO_INCIDENTS
  .filter((incident) => incident.status !== "Resolved" && incident.status !== "Verified Fixed")
  .slice(0, 5)
  .map((incident) => [
    `${incident.id} — ${incident.category === "infrastructure" ? "Infrastructure" : "Incident / Emergency"}`,
    incident.title,
    URGENT_BG[incident.category] ?? "bg-[#fff1c6]",
    URGENT_TEXT[incident.category] ?? "text-[#f59e0b]",
  ]);

const mapIncidents = GEO_INCIDENTS;

export default function AdminDashboard() {
  const [heatmap, setHeatmap] = useState(false);

  return (
    <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {metrics.map(([label, value, description, Icon, iconBg]) => <div key={label} className="rounded-lg border border-[#e2e8eb] bg-white p-4 shadow-[0_2px_8px_rgba(27,52,70,0.03)]"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold leading-tight text-slate-500">{label}</p><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconBg}`}><Icon size={14} /></div></div><div className="mt-2 text-[23px] font-bold text-[#2e8b57]">{value}</div><div className="text-[9px] text-slate-400">{description}</div></div>)}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_270px]">
            <div className="rounded-lg border border-[#e2e8eb] bg-white p-3">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-[12px] font-bold text-[#2e8b57]">Live Incident &amp; Infrastructure Cluster</h2><div className="flex items-center gap-2"><button type="button" onClick={() => setHeatmap((on) => !on)} className={`flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-semibold ${heatmap ? "border-[#2e8b57] bg-[#2e8b57] text-white" : "border-[#d9e8df] text-[#2e8b57]"}`}><Flame size={11} /> {heatmap ? "Show Pins" : "Heatmap"}</button><button className="flex items-center gap-1 rounded border border-[#d9e8df] px-2 py-1 text-[9px] font-semibold text-[#2e8b57]">Go to Map View <ChevronRight size={11} /></button></div></div>
              <MapViewer incidents={mapIncidents} compact heatmap={heatmap} expandPath={PATHS.adminMapView} />
            </div>
            <div className="rounded-lg border border-[#e2e8eb] bg-white p-3">
              <h2 className="mb-2 text-[12px] font-bold text-[#2e8b57]">Urgent Reports &amp; Dispatch</h2>
              <div className="space-y-2">{urgentReports.map(([title, detail, bg, color], index) => <div key={title} className={`flex gap-2 rounded-md p-2 ${bg}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold ${color}`}>{index + 1}</span><div className="min-w-0 text-[9px]"><strong className="block truncate text-[#2e8b57]">{title}</strong><span className="text-slate-500">{detail}</span></div></div>)}</div>
            </div>
          </section>

          <section className="rounded-lg border border-[#e2e8eb] bg-white p-3">
            <h2 className="mb-2 text-[12px] font-bold text-[#2e8b57]">Recent Incident &amp; Infrastructure Reports</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-[9px]"><thead><tr className="rounded bg-[#f5f8fa] text-slate-500"><th className="rounded-l px-3 py-2">Report ID</th><th className="px-3 py-2">Incident Report</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Reporter</th><th className="px-3 py-2">Date Submitted</th><th className="rounded-r px-3 py-2">Status</th></tr></thead><tbody>{reports.map(([id, incident, category, location, reporter, date, status, type]) => <tr key={id} className="border-b border-[#e7ecef] last:border-0"><td className="px-3 py-3 font-bold text-[#2e8b57]">{id}</td><td className="px-3 py-3 font-medium">{incident}</td><td className="px-3 py-3 text-slate-500">{category}</td><td className="px-3 py-3 text-slate-500">{location}</td><td className="px-3 py-3">{reporter}</td><td className="px-3 py-3 text-slate-500">{date}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[8px] font-semibold ${type === "fixed" ? "bg-[#d9f7e4] text-[#2e8b57]" : type === "progress" ? "bg-[#dcefe5] text-[#2e8b57]" : "bg-[#fff1c6] text-[#e69500]"}`}>{status}</span></td></tr>)}</tbody></table></div>
          </section>
    </div>
  );
}
