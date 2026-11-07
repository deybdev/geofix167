import { useMemo, useState } from "react";
import { BarChart3, CheckCircle2, Clock, Download, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "../../shared/components/ui/toast";

const DATASETS = {
  "This Month": {
    summary: [
      { label: "Reports Received", value: "18", delta: "+3 vs last month", icon: BarChart3 },
      { label: "Resolution Rate", value: "83%", delta: "+9% vs last month", icon: CheckCircle2 },
      { label: "Avg. Response Time", value: "14 min", delta: "−4 min vs last month", icon: Clock },
      { label: "Safety Alerts Issued", value: "6", delta: "+2 vs last month", icon: ShieldAlert },
    ],
    categories: [
      ["Incident / Emergency", 34],
      ["Electrical", 27],
      ["Road Damage", 21],
      ["Sanitation", 18],
    ],
    weekly: [
      ["Week 1", [2, 3, 1, 2], []],
      ["Week 2", [3, 2, 2, 1], []],
      ["Week 3", [1, 4, 2, 3], []],
      ["Week 4", [4, 2, 1, 1], []],
    ],
  },
  "Last Month": {
    summary: [
      { label: "Reports Received", value: "15", delta: "baseline", icon: BarChart3 },
      { label: "Resolution Rate", value: "74%", delta: "baseline", icon: CheckCircle2 },
      { label: "Avg. Response Time", value: "18 min", delta: "baseline", icon: Clock },
      { label: "Safety Alerts Issued", value: "4", delta: "baseline", icon: ShieldAlert },
    ],
    categories: [
      ["Incident / Emergency", 30],
      ["Electrical", 24],
      ["Road Damage", 26],
      ["Sanitation", 20],
    ],
    weekly: [
      ["Week 1", [2, 2, 2, 1], []],
      ["Week 2", [3, 1, 1, 2], []],
      ["Week 3", [2, 3, 1, 1], []],
      ["Week 4", [2, 2, 2, 1], []],
    ],
  },
};

const WEEK_STATUSES = ["Emergency", "Electrical", "Road", "Sanitation"];
const WEEK_COLORS = ["#dc2626", "#e69500", "#7184a0", "#2e8b57"];
const BAR_COLORS = ["#2e8b57", "#e69500", "#7184a0", "#b45309"];

export default function ReportsAnalytics() {
  const [period, setPeriod] = useState("This Month");
  const dataset = DATASETS[period];

  const maxCategory = useMemo(() => Math.max(...dataset.categories.map(([, value]) => value)), [dataset]);
  const maxWeekTotal = useMemo(() => Math.max(...dataset.weekly.map(([, values]) => values.reduce((sum, value) => sum + value, 0))), [dataset]);

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4ed] text-[#2e8b57]"><TrendingUp size={18} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold text-[#2e8b57]">Reports &amp; Analytics</h2>
          <p className="text-[9px] text-[#60738f]">Organization performance of Barangay 167 operations — reports, resolutions, and response efficiency.</p>
        </div>
        <div className="flex rounded-md border border-[#dfe5e8] p-0.5">
          {Object.keys(DATASETS).map((option) => (
            <button key={option} type="button" aria-pressed={period === option} onClick={() => setPeriod(option)}
              className={`rounded px-2.5 py-1 text-[9px] font-bold ${period === option ? "bg-[#2e8b57] text-white" : "text-[#60738f] hover:bg-[#f3faf6]"}`}>
              {option}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => toast.add({ title: "Export ready", description: `Analytics summary for ${period.toLowerCase()} exported.`, type: "success" })} className="flex items-center gap-1 rounded-md border border-[#d9e8df] px-2.5 py-2 text-[9px] font-semibold text-[#2e8b57]"><Download size={11} /> Export Report</button>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {dataset.summary.map(({ label, value, delta, icon: Icon }) => (
          <article key={label} className="rounded-lg border border-[#e2e8eb] bg-white p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f3faf6] text-[#2e8b57]"><Icon size={14} /></div>
              <p className="text-[9px] font-bold uppercase tracking-wide text-[#60738f]">{label}</p>
            </div>
            <p className="mt-2 text-[20px] font-bold text-[#263246]">{value}</p>
            <p className="mt-0.5 text-[9px] text-[#7184a0]">{delta}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-[#e2e8eb] bg-white p-4">
          <h3 className="text-[11px] font-bold text-[#2e8b57]">Reports by Category</h3>
          <div className="mt-3 grid gap-2.5">
            {dataset.categories.map(([label, value], index) => (
              <div key={label}>
                <div className="flex items-center justify-between text-[9px] font-medium text-[#60738f]"><span>{label}</span><span className="font-bold text-[#263246]">{value}%</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f0f3f5]">
                  <div className="h-full rounded-full" style={{ width: `${(value / maxCategory) * 100}%`, background: BAR_COLORS[index % BAR_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-[#e2e8eb] bg-white p-4">
          <h3 className="text-[11px] font-bold text-[#2e8b57]">Weekly Report Volume</h3>
          <div className="mt-3 flex h-[150px] items-end justify-between gap-3 px-1">
            {dataset.weekly.map(([week, values]) => {
              const total = values.reduce((sum, value) => sum + value, 0);
              return (
                <div key={week} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-[120px] w-full flex-col-reverse justify-start overflow-hidden rounded-md bg-[#f0f3f5]">
                    <div className="flex w-full" style={{ height: `${(total / maxWeekTotal) * 100}%` }}>
                      {values.map((value, index) => (
                        <div key={WEEK_STATUSES[index]} className="flex-1" style={{ background: WEEK_COLORS[index], height: `${(value / total) * 100}%` }} title={`${WEEK_STATUSES[index]}: ${value}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[8px] font-semibold text-[#60738f]">{week}</span>
                  <span className="text-[8px] font-bold text-[#263246]">{total}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEK_STATUSES.map((label, index) => (
              <span key={label} className="flex items-center gap-1 text-[8px] text-[#60738f]"><span className="h-2 w-2 rounded-full" style={{ background: WEEK_COLORS[index] }} />{label}</span>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
