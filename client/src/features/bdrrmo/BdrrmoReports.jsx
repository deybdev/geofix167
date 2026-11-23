import { useMemo, useState } from "react";
import { BarChart3, Download, FileText, Maximize2, Minimize2, Printer, TriangleAlert } from "lucide-react";
import { toast } from "../../shared/components/ui/toast";
import { INCIDENT_STATUS, PRIORITY, activeIncidentCodes, displayStatus } from "./statusModel";
import { validateReport } from "./validation";
import { useBdrrmoDemo } from "./BdrrmoDemoContext";

const templates = {
  monthly: {
    title: "Monthly BDRRMO Operations Report",
    description:
      "This report summarizes the emergency response operations of the Barangay 167 BDRRMO for the selected reporting period, including incident volume, priority classification, response performance, responder deployment, external support requests, handover records, closure outcomes, and pending operational obligations.",
  },
  accomplishment: {
    title: "Monthly Accomplishment Report",
    description:
      "This report presents completed BDRRMO emergency response activities for the selected month, including responder deployment, assistance coordination, handover completion, closure outcomes, and remaining operational obligations.",
  },
  performance: {
    title: "Response Performance Report",
    description:
      "This report evaluates BDRRMO response activity using the verification, assignment, support, handover, and closure records available for the selected incidents.",
  },
  handover: {
    title: "Handover and Closure Report",
    description:
      "This report consolidates migration-backed QR handover records and incidents awaiting or completing closure review for the selected reporting period.",
  },
};

const CHART_COLORS = ["#0f766e", "#2563eb", "#e69500", "#dc2626", "#7c3aed", "#64748b", "#0891b2", "#65a30d"];

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  const largeArcFlag = sweep > 180 ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function DonutChart({ title, subtitle, data }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const safeTotal = total || 1;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = 88;
  const innerRadius = 56;

  const segments = data.reduce((acc, d, index) => {
    const angle = (d.value / safeTotal) * 360;
    const startAngle = acc.currentAngle;
    const endAngle = acc.currentAngle + (d.value === safeTotal ? 359.999 : angle);
    acc.items.push({
      ...d,
      index,
      startAngle,
      endAngle,
      color: d.color || CHART_COLORS[index % CHART_COLORS.length],
    });
    acc.currentAngle += angle;
    return acc;
  }, { items: [], currentAngle: 0 }).items;

  const active = activeIndex === null ? null : segments[activeIndex];
  const centerValue = active ? active.value : total;
  const centerLabel = active ? active.label : "Total";
  const centerPct = total > 0 ? Math.round(((active ? active.value : total) / safeTotal) * 100) : 0;

  return (
    <article className="rounded-xl border border-[#e2e8eb] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#263246]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-[#60738f]">{subtitle}</p>}
        </div>
        {active && (
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="rounded-md border border-[#dfe7ea] px-2.5 py-1 text-[10px] font-bold text-[#60738f] hover:border-(--gf-green) hover:text-(--gf-green)"
          >
            Show all
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
            {total === 0 ? (
              <circle cx={cx} cy={cy} r={outerRadius} fill="#eef2f4" />
            ) : (
              segments.map((seg) => {
                const isActive = activeIndex === seg.index;
                const isDimmed = activeIndex !== null && !isActive;
                return (
                  <path
                    key={seg.label}
                    d={describeArc(cx, cy, isActive ? outerRadius + 4 : outerRadius, innerRadius, seg.startAngle, seg.endAngle)}
                    fill={seg.color}
                    opacity={isDimmed ? 0.35 : 1}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setActiveIndex(seg.index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={() => setActiveIndex((prev) => (prev === seg.index ? null : seg.index))}
                  >
                    <title>{`${seg.label}: ${seg.value}`}</title>
                  </path>
                );
              })
            )}
            <circle cx={cx} cy={cy} r={innerRadius - 2} fill="white" />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#7c8ba3]">{centerLabel}</span>
            <strong className="text-2xl font-extrabold text-[#263246]">{centerValue}</strong>
            <span className="text-[11px] font-semibold text-[#60738f]">{active ? `${centerPct}%` : "records"}</span>
          </div>
        </div>

        <div className="space-y-2">
          {segments.map((seg) => {
            const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
            const isActive = activeIndex === seg.index;
            const isDimmed = activeIndex !== null && !isActive;
            return (
              <button
                key={seg.label}
                type="button"
                onMouseEnter={() => setActiveIndex(seg.index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex((prev) => (prev === seg.index ? null : seg.index))}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${
                  isActive ? "border-(--gf-green) bg-(--gf-green-soft)/40" : "border-[#edf0f2] bg-white hover:border-[#d5e3da]"
                } ${isDimmed ? "opacity-50" : ""}`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-[#263246]">{seg.label}</span>
                  <span className="block text-[10px] text-[#60738f]">{pct}% of total</span>
                </span>
                <span className="text-sm font-bold text-[#263246]">{seg.value}</span>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

function InteractiveBarChart({ title, subtitle, data, valueSuffix = "" }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <article className="rounded-xl border border-[#e2e8eb] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#263246]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-[#60738f]">{subtitle}</p>}
      </div>

      <div className="space-y-3">
        {data.map((d, index) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          const width = (d.value / max) * 100;
          const isActive = activeIndex === index;
          const isDimmed = activeIndex !== null && !isActive;
          const color = d.color || CHART_COLORS[index % CHART_COLORS.length];
          return (
            <button
              key={d.label}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex((prev) => (prev === index ? null : index))}
              className={`block w-full rounded-lg border px-3 py-2.5 text-left transition ${
                isActive ? "border-(--gf-green) bg-(--gf-green-soft)/30" : "border-transparent hover:border-[#edf0f2]"
              } ${isDimmed ? "opacity-45" : ""}`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-[#263246]">{d.label}</span>
                <span className="font-bold text-[#263246]">
                  {d.value}{valueSuffix} <span className="font-semibold text-[#7c8ba3]">({pct}%)</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#eef2f4]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${width}%`, backgroundColor: color }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </article>
  );
}

export default function BdrrmoReports() {
  const { incidents, assignments, supportRequests, handovers } = useBdrrmoDemo();
  const [tab, setTab] = useState("Overview");
  const [template, setTemplate] = useState("monthly");
  const [month, setMonth] = useState("2026-11");
  const [priority, setPriority] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [description, setDescription] = useState(templates.monthly.description);
  const [previewed, setPreviewed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(
    () =>
      incidents
        .map((incident) => ({
          incident,
          assignment: assignments.find((a) => a.incidentId === incident.id) ?? null,
          support: supportRequests.filter((s) => s.incidentId === incident.id),
          handovers: handovers.filter((h) => h.incidentId === incident.id),
        }))
        .filter(
          ({ incident }) =>
            incident.submittedAt.startsWith(month) &&
            (priority === "ALL" || incident.priorityCode === priority) &&
            (status === "ALL" || incident.incidentStatusCode === status),
        ),
    [incidents, assignments, supportRequests, handovers, month, priority, status],
  );

  const exceptions = rows.flatMap(({ incident, assignment, handovers: hs }) =>
    [
      !assignment && incident.incidentStatusCode === "FORWARDED_TO_BDRRMO"
        ? `${incident.id}: No assignment record`
        : null,
      hs.some((h) => h.qrStatusCode === "NEEDS_CORRECTION") ? `${incident.id}: QR handover needs correction` : null,
    ].filter(Boolean),
  );

  function choose(value) {
    setTemplate(value);
    setDescription(templates[value].description);
    setPreviewed(false);
  }

  function exportCsv() {
    const head = [
      "Incident ID",
      "Submitted",
      "Category",
      "Priority Code",
      "Incident Status Code",
      "Assignment Status Code",
      "Support Status Codes",
      "QR Status Codes",
    ];
    const body = rows.map(({ incident, assignment, support, handovers: hs }) => [
      incident.id,
      incident.submittedAt,
      incident.category,
      incident.priorityCode,
      incident.incidentStatusCode,
      assignment?.statusCode ?? "Not recorded",
      support.map((s) => s.statusCode).join("|") || "Not recorded",
      hs.map((h) => h.qrStatusCode).join("|") || "Not recorded",
    ]);
    const csv = [head, ...body].map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `bdrrmo-${template}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const reportErrors = validateReport({ template, month, rowCount: rows.length, previewed });

  const statusDonutData = useMemo(() => {
    const counts = new Map();
    incidents.forEach((i) => {
      counts.set(i.incidentStatusCode, (counts.get(i.incidentStatusCode) || 0) + 1);
    });
    return Object.keys(INCIDENT_STATUS)
      .filter((code) => (counts.get(code) || 0) > 0)
      .map((code, index) => ({
        label: displayStatus(INCIDENT_STATUS, code),
        value: counts.get(code) || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [incidents]);

  const priorityBarData = useMemo(
    () =>
      Object.keys(PRIORITY).map((code, index) => ({
        label: `${code} · ${displayStatus(PRIORITY, code)}`,
        value: incidents.filter((i) => i.priorityCode === code).length,
        color: ["#dc2626", "#e69500", "#2563eb", "#64748b"][index] || CHART_COLORS[index],
      })),
    [incidents],
  );

  const categoryBarData = useMemo(() => {
    const counts = new Map();
    incidents.forEach((i) => {
      const key = i.category || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, value], index) => ({ label, value, color: CHART_COLORS[index % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [incidents]);

  const overviewMetrics = [
    ["Total Emergencies", incidents.length],
    ["Awaiting Dispatch", incidents.filter((i) => i.incidentStatusCode === "FORWARDED_TO_BDRRMO").length],
    ["Active Units", assignments.filter((a) => !["COMPLETED", "CANCELLED", "DECLINED"].includes(a.statusCode)).length],
    ["For Closure", incidents.filter((i) => i.incidentStatusCode === "FOR_CLOSURE_REVIEW").length],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-(--gf-green-soft) p-3 text-(--gf-green)">
          <BarChart3 size={20} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-[#263246]">Reports & Analytics</h2>
          <p className="text-xs text-[#60738f]">Live Barangay 167 emergency metrics and printable operational reports.</p>
        </div>
      </div>

      <div className="inline-flex min-w-full gap-1 rounded-xl border border-[#e2e8eb] bg-white p-1 sm:min-w-0" role="tablist">
        {["Overview", "Report Builder"].map((item) => {
          const active = tab === item;
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                active ? "bg-(--gf-green) text-white shadow-sm" : "text-[#60738f] hover:bg-(--gf-green-soft) hover:text-(--gf-green)"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>

      {tab === "Report Builder" ? (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 xl:sticky xl:top-20">
            <h3 className="font-bold text-emerald-950">Build report</h3>
            <label className="mt-4 block text-xs font-semibold">
              Template
              <select value={template} onChange={(e) => choose(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3">
                {Object.entries(templates).map(([key, v]) => (
                  <option key={key} value={key}>{v.title}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold">
              Reporting month
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3" />
            </label>
            <label className="mt-3 block text-xs font-semibold">
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3">
                <option value="ALL">All priorities</option>
                {Object.keys(PRIORITY).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold">
              Incident status
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3">
                <option value="ALL">All statuses</option>
                {Object.keys(INCIDENT_STATUS).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                setPreviewed(true);
                document.getElementById("report-preview")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="mt-4 w-full rounded-lg bg-emerald-800 py-3 text-xs font-bold text-white"
            >
              Preview report
            </button>
          </aside>

          <main id="report-preview" className={`scroll-mt-20 space-y-4 ${expanded ? "fixed inset-4 z-50 overflow-y-auto rounded-xl bg-slate-50 p-5 shadow-2xl" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Report preview</h3>
                <p className="text-xs text-slate-500">{rows.length} joined incident records · {exceptions.length} exceptions</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setExpanded((v) => !v)} className="rounded-lg border bg-white p-2" aria-label={expanded ? "Minimize report preview" : "Maximize report preview"}>
                  {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button disabled={reportErrors.length > 0} onClick={exportCsv} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">
                  <Download size={14} /> CSV
                </button>
                <button disabled={reportErrors.length > 0} onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-bold disabled:opacity-40">
                  <Printer size={14} /> Print / PDF
                </button>
              </div>
            </div>

            {!previewed ? (
              <div className="rounded-xl border border-dashed bg-white p-12 text-center text-sm text-slate-500">
                <FileText className="mx-auto mb-3" /> Select filters and preview the report.
              </div>
            ) : (
              <article className="bdrrmo-report rounded-xl border bg-white p-6 shadow-sm">
                <header className="border-b pb-5 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">GeoFix 167 · Barangay 167 BDRRMO</p>
                  <h2 className="mt-2 text-xl font-bold">{templates[template].title}</h2>
                  <p className="mt-1 text-xs text-slate-500">Reporting period: {month} · DEMO DATA</p>
                </header>
                <label className="mt-5 block text-xs font-bold">
                  Report description
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-2 w-full rounded-lg border p-3 font-normal leading-5" />
                </label>
                <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[["Incidents", rows.length], ["P1", rows.filter((r) => r.incident.priorityCode === "P1").length], ["Assignments", rows.filter((r) => r.assignment).length], ["Handovers", rows.reduce((n, r) => n + r.handovers.length, 0)]].map(([a, b]) => (
                    <div key={a} className="rounded-lg bg-slate-50 p-3">
                      <span className="text-[10px] text-slate-500">{a}</span>
                      <strong className="block text-xl">{b}</strong>
                    </div>
                  ))}
                </section>
                {exceptions.length > 0 && (
                  <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900">
                      <TriangleAlert size={16} /> Exceptions and follow-up
                    </h3>
                    <ul className="mt-2 list-disc pl-5 text-xs text-amber-900">
                      {exceptions.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </section>
                )}
                <section className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-[10px]">
                    <thead className="bg-slate-100">
                      <tr>
                        {["Incident", "Category", "Priority", "Incident status", "Assignment", "Support", "Handover"].map((h) => (
                          <th key={h} className="p-2">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ incident, assignment, support, handovers: hs }) => (
                        <tr key={incident.id} className="border-b border-[#f1f4f6] last:border-b-0">
                          <td className="px-2 py-2 font-bold text-(--gf-green)">{incident.id}</td>
                          <td className="px-2 py-2">{incident.category}</td>
                          <td className="px-2 py-2">{incident.priorityCode}</td>
                          <td className="px-2 py-2">{displayStatus(INCIDENT_STATUS, incident.incidentStatusCode)}</td>
                          <td className="px-2 py-2">{assignment?.statusCode ?? "Not recorded"}</td>
                          <td className="px-2 py-2">{support.map((s) => s.statusCode).join("|") || "Not recorded"}</td>
                          <td className="px-2 py-2">{hs.map((h) => h.qrStatusCode).join("|") || "Not recorded"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </article>
            )}

            {previewed && reportErrors.length > 0 && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <strong>Report cannot be generated:</strong>
                <ul className="mt-1 list-disc pl-5">
                  {reportErrors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </div>
            )}

            <button
              onClick={() => toast.add({ type: "success", title: "Report prepared", description: "Preview is ready for browser Print / Save as PDF." })}
              disabled={reportErrors.length > 0}
              className="rounded-lg bg-emerald-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-40"
            >
              Prepare monthly report
            </button>
          </main>
          {expanded && <button className="fixed inset-0 z-40 bg-slate-950/30" aria-label="Minimize report preview" onClick={() => setExpanded(false)} />}
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                const head = ["ID", "Title", "Category", "Location", "Priority", "Status", "Submitted"];
                const lines = [
                  head.join(","),
                  ...incidents.map((i) =>
                    [i.id, i.title, i.category, i.location, i.priorityCode, i.incidentStatusCode, i.submittedAt]
                      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
                      .join(","),
                  ),
                ];
                const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `bdrrmo-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-2 rounded-md bg-(--gf-green) px-3.5 py-2 text-xs font-bold text-white transition hover:bg-(--gf-green-dark)"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overviewMetrics.map(([label, value]) => (
              <article key={label} className="rounded-xl border border-[#e2e8eb] bg-white p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#60738f]">{label}</span>
                <strong className="mt-2 block text-2xl font-extrabold text-[#263246]">{value}</strong>
              </article>
            ))}
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <DonutChart
              title="Incident Status Distribution"
              subtitle="Hover or click a segment to inspect status counts."
              data={statusDonutData}
            />
            <InteractiveBarChart
              title="Incidents by Priority"
              subtitle="Priority distribution based on system P1–P4 classification."
              data={priorityBarData}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <InteractiveBarChart
              title="Incidents by Category"
              subtitle="Category volume across current BDRRMO incident records."
              data={categoryBarData}
            />
            <article className="rounded-xl border border-[#e2e8eb] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-[#263246]">Operational Snapshot</h3>
              <p className="mt-0.5 text-[11px] text-[#60738f]">Live operational indicators aligned with BDRRMO records.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Active Incidents", incidents.filter((i) => activeIncidentCodes.includes(i.incidentStatusCode)).length, "Assigned / En Route / On Scene"],
                  ["Closed Incidents", incidents.filter((i) => i.incidentStatusCode === "CLOSED").length, "Completed and closed records"],
                  ["QR Handovers", handovers.length, "Hospital handover records"],
                  ["Backup Requests", supportRequests.length, "External/support request records"],
                ].map(([label, value, hint]) => (
                  <div key={label} className="rounded-lg border border-[#edf0f2] bg-[#f8fafb] p-4">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#60738f]">{label}</span>
                    <strong className="mt-2 block text-2xl font-extrabold text-[#263246]">{value}</strong>
                    <p className="mt-1 text-[11px] text-[#60738f]">{hint}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}