import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Download, MapPin, Siren, Wrench } from "lucide-react";
import { toast } from "../../shared/components/ui/toast";

const CATEGORY_ICON = {
  "Incident / Emergency": Siren,
  Electrical: Wrench,
  Sanitation: Wrench,
  "Road Damage": Wrench,
};

const STATUS_STYLES = { Verified: "bg-[#d9f7e4] text-[#2e8b57]", Delayed: "bg-[#fff1c6] text-[#e69500]", Ahead: "bg-[#dcefe5] text-[#2e8b57]" };

const initialRecords = [
  { id: "GF-003", title: "Clogged Drainage Canal", category: "Sanitation", location: "Magsaysay Boulevard", team: "Barangay Sanitizers", completed: "April 20, 2026", duration: "1 day", status: "Verified", remarks: "Cleared 2.5 m³ of silt before the weekend rain." },
  { id: "GF-005", title: "Cracked Sidewalk Path", category: "Road Damage", location: "Bonifacio Street", team: "Barangay Public Works", completed: "April 18, 2026", duration: "3 days", status: "Verified", remarks: "Concrete patch passed a 48-hour cure inspection." },
  { id: "GF-002", title: "Broken Streetlight Pole", category: "Electrical", location: "Quezon Avenue", team: "Engineering Crew B", completed: "April 18, 2026", duration: "2 days", status: "Ahead", remarks: "Repaired one day ahead of the assigned deadline." },
  { id: "GF-001", title: "Vehicular Accident on Rizal Street", category: "Incident / Emergency", location: "Rizal Street", team: "BDRRMO Response", completed: "April 17, 2026", duration: "6 hours", status: "Verified", remarks: "Scene cleared in under six hours; two patients transported safely." },
  { id: "GF-004", title: "Exposed Power Lines", category: "Electrical", location: "Roxas Boulevard", team: "Meralco Dispatch", completed: "April 16, 2026", duration: "1 day", status: "Delayed", remarks: "Completed past the target window due to outage scheduling." },
];

const records = initialRecords;

export default function AccomplishmentLog() {
  const [period, setPeriod] = useState("April 2026");
  const [category, setCategory] = useState("All Categories");

  const filtered = useMemo(() => records.filter((record) => category === "All Categories" || record.category === category), [category]);

  const onTime = filtered.filter((record) => record.status !== "Delayed").length;

  return (
    <div className="space-y-3">
      <section className="grid gap-2 sm:grid-cols-3">
        {[
          ["Completed Logs", String(filtered.length), "#2e8b57", "#e7f4ed"],
          ["Completed On Time", `${Math.round((onTime / Math.max(1, filtered.length)) * 100)}%`, "#e69500", "#fff8e7"],
          ["Target Status", "4 of 5 met", "#60738f", "#f5f8fa"],
        ].map(([label, value, color, background]) => (
          <div key={label} className="rounded-lg border border-[#e2e8eb] bg-white p-4" style={{}}>
            <p className="text-[9px] font-bold uppercase tracking-wide text-[#60738f]">{label}</p>
            <p className="mt-1 text-[18px] font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
        <label className="relative min-w-[130px]">
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-7 w-full appearance-none rounded-md border border-[#dfe5e8] bg-white px-2.5 pr-7 text-[9px] text-[#2e8b57] outline-none focus:border-[#2e8b57]">
            {["April 2026", "March 2026", "February 2026"].map((option) => <option key={option}>{option}</option>)}
          </select>
          <CalendarDays size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2e8b57]" />
        </label>
        <label className="relative min-w-[150px]">
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-7 w-full appearance-none rounded-md border border-[#dfe5e8] bg-white px-2.5 pr-7 text-[9px] text-[#2e8b57] outline-none focus:border-[#2e8b57]">
            {["All Categories", "Road Damage", "Electrical", "Sanitation", "Incident / Emergency"].map((option) => <option key={option}>{option}</option>)}
          </select>
          <ClipboardList size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2e8b57]" />
        </label>
        <button type="button" onClick={() => toast.add({ title: "Export ready", description: `Accomplishment log for ${period} exported.`, type: "success" })} className="flex items-center gap-1 rounded-md border border-[#d9e8df] px-2 py-1.5 text-[9px] font-semibold text-[#2e8b57]"><Download size={11} /> Export Log</button>
      </section>

      <section className="rounded-lg border border-[#e2e8eb] bg-white">
        <div className="border-b border-[#e7ecef] px-4 py-3"><h2 className="text-[12px] font-bold text-[#2e8b57]">Accomplishment Timeline — {period}</h2></div>
        <ol className="grid">
          {filtered.map((record, index) => {
            const Icon = CATEGORY_ICON[record.category];
            const badge = STATUS_STYLES[record.status] ?? STATUS_STYLES.Verified;
            return (
              <li key={record.id} className="flex items-start gap-3 border-b border-[#e7ecef] px-4 py-3.5 last:border-0">
                <div className="flex shrink-0 flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7f4ed] text-[#2e8b57]"><Icon size={15} /></div>
                  {index < filtered.length - 1 && <div className="mt-1 w-px flex-1 bg-[#dfe7ea]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-[#263246]">{record.title}</p>
                    <span className={`rounded px-2 py-1 text-[8px] font-bold ${badge}`}>{record.status}</span>
                  </div>
                  <p className="mt-0.5 text-[9px] text-[#60738f]">{record.id} • {record.team}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-3 text-[9px] text-[#7184a0]">
                    <span className="flex items-center gap-1"><MapPin size={10} className="text-[#2e8b57]" />{record.location}</span>
                    <span>Completed {record.completed} • Duration {record.duration}</span>
                  </p>
                  <p className="mt-1.5 rounded-md bg-[#f8fafb] px-2.5 py-1.5 text-[9px] text-[#60738f]">{record.remarks}</p>
                </div>
              </li>
            );
          })}
          {!filtered.length && <li className="py-8 text-center text-xs text-[#60738f]">No accomplished records for the selected filters.</li>}
        </ol>
      </section>
    </div>
  );
}
