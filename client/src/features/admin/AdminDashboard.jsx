import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, BarChart3, CheckCircle2, ChevronRight, Clock, Flame, Siren, Wrench,
} from "lucide-react";
import { PATHS } from "../../router/paths";
import AdminReportActions from "../../shared/components/AdminReportActions";
import MapViewer from "../../shared/components/MapViewer";
import { BY_STATUS, GEO_INCIDENTS, KPI_DATA } from "./analytics/mockData";

const KPI = KPI_DATA.month;
const statusCount = (label) => BY_STATUS.find((status) => status.label === label)?.value ?? 0;

const reports = [
  { id: "GF-001", incident: "Pothole on Rizal Street", category: "Road Damage", location: "Rizal Street", reporter: "Marvin Navarrete", date: "April 22, 2026", status: "Reported", tone: "reported" },
  { id: "GF-002", incident: "Broken Streetlight Pole", category: "Electrical", location: "Quezon Avenue", reporter: "John Kyle Paroni", date: "April 21, 2026", status: "In Progress", tone: "progress" },
  { id: "GF-003", incident: "Clogged Drainage Canal", category: "Sanitation", location: "Magsaysay Boulevard", reporter: "Efren Cahilig", date: "April 20, 2026", status: "Verified Fixed", tone: "fixed" },
  { id: "GF-006", incident: "Accident (DEMO)", category: "Incident / Emergency", location: "Rizal Street", reporter: "Demo Guest", date: "Demo record", status: "Dispatch Pending", tone: "reported" },
];

const metrics = [
  { label: "Reports this month", value: KPI.totalReports, hint: "All emergency and service reports", icon: BarChart3, tone: "bg-(--gf-green-tint) text-(--gf-green)", path: PATHS.adminIncidentReports },
  { label: "Awaiting action", value: KPI.pendingReports, hint: "Needs triage, dispatch, or assignment", icon: Clock, tone: "bg-amber-50 text-amber-600", path: `${PATHS.adminIncidentReports}?queue=pending-triage` },
  { label: "Active workload", value: statusCount("Dispatched") + statusCount("In Progress"), hint: "Assigned or handled in the field", icon: Wrench, tone: "bg-blue-50 text-blue-600", path: PATHS.adminMaintenanceTasks },
  { label: "Resolution rate", value: `${KPI.resolutionRate}%`, hint: `${KPI.resolvedReports} verified resolutions`, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700", path: PATHS.adminResolutionVerification },
];

const operatingMetrics = [
  ["Dispatched", statusCount("Dispatched"), Siren, "text-blue-600", PATHS.adminDispatch],
  ["In progress", statusCount("In Progress"), Activity, "text-violet-600", PATHS.adminMaintenanceTasks],
  ["Active emergencies", KPI.activeEmergencies, Flame, "text-red-600", `${PATHS.adminIncidentReports}?queue=active-emergencies`],
  ["Average response", `${KPI.avgResponseTime} min`, Clock, "text-amber-600", PATHS.adminReportsAnalytics],
];

const urgentReports = GEO_INCIDENTS
  .filter((incident) => incident.status !== "Resolved" && incident.status !== "Verified Fixed")
  .slice(0, 5);

export default function AdminDashboard() {
  const [heatmap, setHeatmap] = useState(false);

  return <div className="space-y-4 admin-print-surface">
    <section className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-(--gf-green)">Operations overview</p>
        <h2 className="mt-1 text-lg font-bold text-(--gf-ink)">Barangay 167 command center</h2>
        <p className="mt-1 text-xs text-(--gf-slate)">Triage demand, field workload, response speed, and verified outcomes for this month.</p>
      </div>
      <AdminReportActions filename="geofix167-admin-overview" title="GeoFix 167 Admin Overview" rows={reports} label="Export Excel" presentationPath={PATHS.adminReportDeck} />
    </section>

    <section aria-label="Administrative KPI summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, hint, icon: Icon, tone, path }) => <Link to={path} key={label} className="gf-card admin-metric-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[11px] font-bold uppercase tracking-wide text-(--gf-slate)">{label}</p><p className="mt-2 text-2xl font-bold leading-none text-(--gf-ink)">{value}</p></div>
          <span className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}><Icon size={17} /></span>
        </div>
        <p className="mt-2 text-[11px] text-(--gf-slate-2)">{hint}</p>
        <ChevronRight className="admin-metric-card__arrow" size={16} />
      </Link>)}
    </section>

    <section aria-label="Live operations status" className="grid gap-px overflow-hidden rounded-lg border border-(--gf-border) bg-(--gf-border) sm:grid-cols-2 xl:grid-cols-4">
      {operatingMetrics.map(([label, value, Icon, color, path]) => <Link to={path} key={label} className="admin-operating-metric flex items-center gap-3 bg-white px-4 py-3">
        <Icon size={16} className={color} />
        <div><p className="text-sm font-bold text-(--gf-ink)">{value}</p><p className="text-[11px] text-(--gf-slate)">{label}</p></div>
      </Link>)}
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <article className="gf-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-sm font-bold text-(--gf-ink)">Live incident cluster</h3><p className="text-[11px] text-(--gf-slate)">Emergency and infrastructure activity within Barangay 167.</p></div>
          <div className="flex items-center gap-2 print:hidden">
            <button type="button" onClick={() => setHeatmap((on) => !on)} className={`gf-btn gf-btn--chip ${heatmap ? "bg-(--gf-green)! text-white!" : ""}`}><Flame size={12} />{heatmap ? "Show pins" : "Heatmap"}</button>
            <Link to={PATHS.adminMapView} className="gf-btn gf-btn--chip">Open map <ChevronRight size={12} /></Link>
          </div>
        </div>
        <MapViewer incidents={GEO_INCIDENTS} compact heatmap={heatmap} expandPath={PATHS.adminMapView} />
      </article>
      <article className="gf-card p-4">
        <div className="mb-3"><h3 className="text-sm font-bold text-(--gf-ink)">Priority queue</h3><p className="text-[11px] text-(--gf-slate)">Open records needing operational attention.</p></div>
        <div className="space-y-2">{urgentReports.map((incident, index) => <div key={incident.id} className="flex gap-3 rounded-lg border border-(--gf-border) p-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-50 text-[11px] font-bold text-red-600">{index + 1}</span>
          <div className="min-w-0"><p className="truncate text-xs font-bold text-(--gf-ink)">{incident.id} · {incident.title}</p><p className="mt-0.5 text-[11px] text-(--gf-slate)">{incident.status}</p></div>
        </div>)}</div>
      </article>
    </section>

    <section className="gf-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-(--gf-ink)">Recent reports</h3><p className="text-[11px] text-(--gf-slate)">Latest administrative records across operations.</p></div><Link to={PATHS.adminIncidentReports} className="gf-btn gf-btn--chip print:hidden">View all <ChevronRight size={12} /></Link></div>
      <div className="overflow-x-auto"><table className="gf-table min-w-[760px]"><thead><tr><th>Report ID</th><th>Incident</th><th>Category</th><th>Location</th><th>Reporter</th><th>Date submitted</th><th>Status</th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td className="font-bold text-(--gf-green)">{report.id}</td><td className="font-semibold text-(--gf-ink)">{report.incident}</td><td>{report.category}</td><td>{report.location}</td><td>{report.reporter}</td><td>{report.date}</td><td><span className={`gf-badge ${report.tone === "fixed" ? "gf-badge--fixed" : report.tone === "progress" ? "gf-badge--progress" : "gf-badge--reported"}`}>{report.status}</span></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
