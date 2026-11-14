import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, ClipboardList, Clock,
  Download, MapPin, Printer, RotateCcw, ShieldAlert, TrendingDown,
  TrendingUp, Wrench, Zap,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import { PATHS } from "../../router/paths";
import MapViewer from "../../shared/components/MapViewer";
import { LineChart, DonutChart, BarChart, HBarChart, GroupedBarChart, StackedHBar } from "./analytics/Charts";
import {
  KPI_DATA, TREND_MONTHLY, TREND_WEEKLY, TREND_DAILY,
  BY_CATEGORY, BY_STATUS, TOP_ISSUES,
  EMERGENCY_METRICS, EMERGENCY_BY_CAT,
  MAINTENANCE_BY_CAT, MAINTENANCE_MONTHLY,
  GEO_INCIDENTS,
} from "./analytics/mockData";

// ── Constants ────────────────────────────────────────────────────────────────
const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
];

const TREND_MAP = { today: TREND_DAILY, week: TREND_WEEKLY, month: TREND_MONTHLY, year: TREND_MONTHLY };
const TREND_LABEL = { today: "Daily", week: "Weekly", month: "Monthly", year: "Monthly" };

const CATEGORY_OPTS = ["All Categories", "Road Damage", "Electrical", "Sanitation", "Incident / Emergency", "Flooding", "Hazardous Tree", "Water Pipe"];
const STATUS_OPTS = ["All Statuses", "Pending", "Dispatched", "In Progress", "Resolved", "Rejected"];
const TYPE_OPTS = ["All Types", "Emergency", "Maintenance"];

// ── Helpers ──────────────────────────────────────────────────────────────────
function delta(curr, prev) {
  const diff = curr - prev;
  const pct = prev ? Math.round(Math.abs(diff / prev) * 100) : 0;
  return { diff, pct, up: diff >= 0 };
}

function fmtDelta(d, unit = "") {
  const sign = d.up ? "+" : "−";
  return `${sign}${Math.abs(d.diff)}${unit} (${d.pct}%) vs prev`;
}

function exportCSV(period, kpi) {
  const rows = [
    ["Metric", "Value", "Period"],
    ["Total Reports", kpi.totalReports, period],
    ["Pending Reports", kpi.pendingReports, period],
    ["Resolved Reports", kpi.resolvedReports, period],
    ["Active Emergencies", kpi.activeEmergencies, period],
    ["Avg Response Time (min)", kpi.avgResponseTime, period],
    ["Resolution Rate (%)", kpi.resolutionRate, period],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `geofix167-analytics-${period}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast.add({ title: "Export ready", description: `Analytics report for ${period} exported as CSV.`, type: "success" });
}

function printReport(period) {
  window.print();
  void period;
}

// ── Sub-components ───────────────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, children, className = "" }) {
  return (
    <article className={`flex flex-col rounded-lg border border-[#e2e8eb] bg-white p-4 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-[12px] font-bold text-[#2e8b57]">
        <Icon size={14} strokeWidth={2} /> {title}
      </h3>
      <div className="min-h-0 flex-1 flex flex-col">{children}</div>
    </article>
  );
}

function DemoBadge() {
  return (
    <span className="rounded bg-[#fff0c1] px-1.5 py-0.5 text-[8px] font-bold text-[#d68d00]">
      DEMO DATA
    </span>
  );
}

function DonutBreakdown({ data, size = 120, layout = "rows" }) {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  return (
    <div className="flex items-center gap-4">
      <DonutChart data={data} size={size} />
      {layout === "tiles" ? (
        <div className="min-w-0 flex-1 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((d) => (
            <div key={d.label} className="rounded-md border border-[#e2e8eb] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[9px] text-[#60738f]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="truncate">{d.label}</span>
              </p>
              <p className="mt-1 text-[15px] font-bold leading-none text-[#263246]">
                {d.value}
                <span className="ml-1 text-[9px] font-medium text-[#7184a0]">{Math.round((d.value / total) * 100)}%</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="min-w-0 flex-1 grid gap-1.5">
          {data.map((d) => (
            <div key={d.label} className="flex items-center justify-between gap-2 text-[9px]">
              <span className="flex min-w-0 items-center gap-1.5 text-[#60738f]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="truncate">{d.label}</span>
              </span>
              <span className="shrink-0 font-bold text-[#263246]">
                {d.value} <span className="font-medium text-[#7184a0]">{Math.round((d.value / total) * 100)}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, unit = "", icon: Icon, iconBg, curr, prev }) {
  const d = delta(curr, prev);
  return (
    <article className="rounded-lg border border-[#e2e8eb] bg-white p-4">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
          <Icon size={14} />
        </div>
        <p className="text-[9px] font-bold uppercase tracking-wide text-[#60738f] leading-tight">{label}</p>
      </div>
      <p className="mt-2 text-[22px] font-bold text-[#263246] leading-none">
        {value}<span className="text-[13px] font-semibold text-[#7184a0] ml-0.5">{unit}</span>
      </p>
      <p className={`mt-1 flex items-center gap-0.5 text-[9px] font-medium ${d.up ? "text-[#2e8b57]" : "text-[#dc2626]"}`}>
        {d.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {fmtDelta(d, unit)}
      </p>
    </article>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[#e2e8eb] px-3 py-2">
      <span className="text-[9px] text-[#60738f]">{label}</span>
      <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────
function FilterBar({ period, setPeriod, category, setCategory, status, setStatus, type, setType, onReset }) {
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
      {/* Period toggle */}
      <div className="flex rounded-md border border-[#dfe5e8] p-0.5">
        {PERIODS.map(({ key, label }) => (
          <button key={key} type="button" onClick={() => setPeriod(key)}
            className={`rounded px-2.5 py-1 text-[9px] font-bold transition-colors ${period === key ? "bg-[#2e8b57] text-white" : "text-[#60738f] hover:bg-[#f3faf6]"}`}>
            {label}
          </button>
        ))}
      </div>
      {/* Dropdowns */}
      {[
        [category, setCategory, CATEGORY_OPTS, ClipboardList],
        [status, setStatus, STATUS_OPTS, CheckCircle2],
        [type, setType, TYPE_OPTS, ShieldAlert],
      ].map(([val, setter, opts, SelectIcon]) => (
        <label key={opts[0]} className="relative min-w-[130px]">
          <select value={val} onChange={(e) => setter(e.target.value)}
            className="h-7 w-full appearance-none rounded-md border border-[#dfe5e8] bg-white px-2.5 pr-7 text-[9px] text-[#2e8b57] outline-none focus:border-[#2e8b57]">
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
          <SelectIcon size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2e8b57]" />
        </label>
      ))}
      <button type="button" onClick={onReset} className="flex items-center gap-1 px-2 text-[9px] text-[#60738f] hover:text-[#2e8b57]">
        <RotateCcw size={11} /> Reset
      </button>
    </section>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ReportsAnalytics() {
  const [period, setPeriod] = useState("month");
  const [category, setCategory] = useState("All Categories");
  const [status, setStatus] = useState("All Statuses");
  const [type, setType] = useState("All Types");

  const kpi = KPI_DATA[period];
  const trendData = TREND_MAP[period];

  // Filter category/status data based on selections
  const filteredByCategory = useMemo(() =>
    category === "All Categories" ? BY_CATEGORY : BY_CATEGORY.filter((d) => d.label === category),
    [category]);

  const filteredByStatus = useMemo(() =>
    status === "All Statuses" ? BY_STATUS : BY_STATUS.filter((d) => d.label === status),
    [status]);

  const filteredTopIssues = useMemo(() =>
    type === "Emergency" ? TOP_ISSUES.slice(0, 3) : TOP_ISSUES,
    [type]);

  const filteredGeo = useMemo(() => {
    let data = GEO_INCIDENTS;
    if (type === "Emergency") data = data.filter((d) => d.category === "incident" || d.category === "fire");
    if (type === "Maintenance") data = data.filter((d) => d.category === "infrastructure");
    return data;
  }, [type]);

  function resetFilters() {
    setPeriod("month"); setCategory("All Categories");
    setStatus("All Statuses"); setType("All Types");
  }

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? period;

  return (
    <div className="space-y-3 print:space-y-4">
      {/* ── Header ── */}
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4ed] text-[#2e8b57]">
          <BarChart3 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-bold text-[#2e8b57]">Analytics Dashboard</h2>
            <DemoBadge />
          </div>
          <p className="text-[9px] text-[#60738f]">
            Barangay 167 incident, emergency, and infrastructure performance overview — {periodLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button type="button" onClick={() => exportCSV(period, kpi)}
            className="flex items-center gap-1 rounded-md border border-[#d9e8df] px-2.5 py-2 text-[9px] font-semibold text-[#2e8b57] hover:bg-[#f3faf6]">
            <Download size={11} /> Export CSV
          </button>
          <button type="button" onClick={() => printReport(period)}
            className="flex items-center gap-1 rounded-md border border-[#d9e8df] px-2.5 py-2 text-[9px] font-semibold text-[#2e8b57] hover:bg-[#f3faf6]">
            <Printer size={11} /> Print
          </button>
        </div>
      </section>

      {/* ── Filters ── */}
      <FilterBar
        period={period} setPeriod={setPeriod}
        category={category} setCategory={setCategory}
        status={status} setStatus={setStatus}
        type={type} setType={setType}
        onReset={resetFilters}
      />

      {/* ── KPI Cards ── */}
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Reports" value={kpi.totalReports} icon={BarChart3}
          iconBg="bg-[#e7f4ed] text-[#2e8b57]" curr={kpi.totalReports} prev={kpi.prev.totalReports} />
        <KpiCard label="Pending Reports" value={kpi.pendingReports} icon={Clock}
          iconBg="bg-[#fff8e6] text-[#f59e0b]" curr={kpi.pendingReports} prev={kpi.prev.pendingReports} />
        <KpiCard label="Resolved Reports" value={kpi.resolvedReports} icon={CheckCircle2}
          iconBg="bg-[#e7f4ed] text-[#2e8b57]" curr={kpi.resolvedReports} prev={kpi.prev.resolvedReports} />
        <KpiCard label="Active Emergencies" value={kpi.activeEmergencies} icon={ShieldAlert}
          iconBg="bg-[#fdecea] text-[#dc2626]" curr={kpi.activeEmergencies} prev={kpi.prev.activeEmergencies} />
        <KpiCard label="Avg Response Time" value={kpi.avgResponseTime} unit=" min" icon={Activity}
          iconBg="bg-[#eff6ff] text-[#3b82f6]" curr={kpi.avgResponseTime} prev={kpi.prev.avgResponseTime} />
        <KpiCard label="Resolution Rate" value={kpi.resolutionRate} unit="%" icon={TrendingUp}
          iconBg="bg-[#e7f4ed] text-[#2e8b57]" curr={kpi.resolutionRate} prev={kpi.prev.resolutionRate} />
      </section>

      {/* ── Incident Analytics ── */}
      <section className="grid gap-3 lg:grid-cols-3">
        <SectionCard title={`Incident Trend (${TREND_LABEL[period]})`} icon={TrendingUp} className="lg:col-span-2">
          <LineChart data={trendData} color="#2e8b57" height={130} />
        </SectionCard>

        <SectionCard title="Reports by Category" icon={BarChart3}>
          <DonutBreakdown data={filteredByCategory.length ? filteredByCategory : BY_CATEGORY} />
        </SectionCard>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Reports by Status" icon={Activity}>
          <BarChart data={filteredByStatus.length ? filteredByStatus : BY_STATUS} height={130} />
        </SectionCard>

        <SectionCard title="Top Reported Infrastructure Issues" icon={Wrench}>
          <HBarChart data={filteredTopIssues} color="#f59e0b" />
        </SectionCard>
      </section>

      {/* ── Emergency Response Analytics ── */}
      <section className="grid gap-3 lg:grid-cols-3">
        <SectionCard title="Emergency Response Metrics" icon={ShieldAlert} className="lg:col-span-2">
          <div className="grid gap-1.5 sm:grid-cols-2">
            <StatPill label="Avg Dispatch Time" value={`${EMERGENCY_METRICS.avgDispatchTime} min`} color="#3b82f6" />
            <StatPill label="Avg Arrival Time" value={`${EMERGENCY_METRICS.avgArrivalTime} min`} color="#f59e0b" />
            <StatPill label="Avg Resolution Time" value={`${EMERGENCY_METRICS.avgResolutionTime} min`} color="#8b5cf6" />
            <StatPill label="Total Requests" value={EMERGENCY_METRICS.totalRequests} color="#263246" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-md bg-[#e7f4ed] p-2 text-center">
              <p className="text-[18px] font-bold text-[#2e8b57]">{EMERGENCY_METRICS.completed}</p>
              <p className="text-[8px] text-[#60738f]">Completed</p>
            </div>
            <div className="flex-1 rounded-md bg-[#fff8e6] p-2 text-center">
              <p className="text-[18px] font-bold text-[#f59e0b]">{EMERGENCY_METRICS.pending}</p>
              <p className="text-[8px] text-[#60738f]">Pending</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Emergency Requests by Category" icon={AlertTriangle}>
          <DonutBreakdown data={EMERGENCY_BY_CAT} />
        </SectionCard>
      </section>

      {/* ── Geographic Visualization ── */}
      <SectionCard title="Geographic Incident Map — Barangay 167" icon={MapPin}>
        <p className="mb-2 text-[9px] text-[#7184a0]">
          Showing {filteredGeo.length} incident location{filteredGeo.length !== 1 ? "s" : ""} within Barangay 167.
          Use the filter above to toggle between emergency and maintenance incidents.
        </p>
        <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
          <div className="h-[320px]">
            <MapViewer compact incidents={filteredGeo} expandPath={PATHS.adminMapView} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3">
          {[
            { color: "#d97706", label: "Infrastructure" },
            { color: "#2563eb", label: "Incident / Emergency" },
            { color: "#dc2626", label: "Fire" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[8px] text-[#60738f]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </SectionCard>

      {/* ── Infrastructure Maintenance Analytics ── */}
      <section className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Maintenance Workload by Category" icon={Wrench}>
          <StackedHBar data={MAINTENANCE_BY_CAT} />
          <div className="mt-2 flex gap-3 text-[8px] text-[#60738f]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#2e8b57]" />Resolved</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#e2e8eb]" />Unresolved</span>
          </div>
        </SectionCard>

        <SectionCard title="Monthly Maintenance Trends" icon={Zap}>
          <GroupedBarChart data={MAINTENANCE_MONTHLY} height={140} />
          <div className="mt-1 flex gap-3 text-[8px] text-[#60738f]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#7184a0]" />Reported</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#2e8b57]" />Resolved</span>
          </div>
        </SectionCard>
      </section>

      {/* ── Print footer ── */}
      <div className="hidden print:block text-[9px] text-[#7184a0] border-t border-[#e2e8eb] pt-3 mt-4">
        GeoFix 167 Analytics Report — {periodLabel} — Barangay 167, Caloocan City — Demo Data
      </div>
    </div>
  );
}
