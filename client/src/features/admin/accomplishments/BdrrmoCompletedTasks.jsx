import { useEffect, useRef, useState } from "react";
import { SHOW_SAMPLE_BADGE, useCompletedTasks } from "./bdrrmoTasksSample";

const dateTime = value => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const monthOf = value => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).format(new Date(value));
const currentMonth = () => monthOf(new Date());
const control = "min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm";

function TaskDetails({ task, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="completed-task-title" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-lg overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-xl backdrop:bg-black/40">
    <div className="flex items-start justify-between gap-4"><h2 id="completed-task-title" className="text-lg font-bold">{task.id}</h2><button autoFocus type="button" onClick={onClose} className="gf-btn">Close</button></div>
    <p className="mt-4 font-semibold">{task.categories.join(" + ")}</p>
    <p className="mt-2 text-sm text-slate-600">{task.location}</p>
    <p className="mt-2 text-sm">{task.team}</p>
    <h3 className="mt-6 font-semibold">Response timeline</h3>
    <ol className="mt-3 space-y-4">{[["Reported",task.reported],["Dispatched",task.dispatched],["Arrived",task.arrived],["Resolved",task.resolved]].map(([label, time]) =>
      <li key={label} className="border-l-2 border-(--gf-green) pl-3"><strong className="block text-sm">{label}</strong><time dateTime={time} className="text-sm text-slate-600">{dateTime(time)}</time></li>
    )}</ol>
    <h3 className="mt-6 font-semibold">Outcome</h3><p className="mt-2 text-sm leading-6">{task.outcome}</p>
    <h3 className="mt-6 font-semibold">Evidence</h3><p className="mt-2 rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">Evidence preview will appear here. This sample record has no attachments.</p>
  </dialog>;
}

export default function BdrrmoCompletedTasks() {
  const { tasks, loading } = useCompletedTasks();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState(null);
  const types = [...new Set(tasks.flatMap(task => task.categories))].sort();
  const months = [...new Set(tasks.map(task => monthOf(task.resolved)))].sort().reverse();
  const filtered = tasks.filter(task => (!type || task.categories.includes(type))
    && (!month || monthOf(task.resolved) === month)
    && [task.id, ...task.categories, task.location, task.team, task.outcome].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const average = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.responseMinutes, 0) / tasks.length) : 0;
  const common = [...types].sort((a, b) => tasks.filter(task => task.categories.includes(b)).length - tasks.filter(task => task.categories.includes(a)).length)[0] || "None";
  const metrics = [["Total completed",tasks.length],["Average response time",average + " min"],["Completed this month",tasks.filter(task => monthOf(task.resolved) === currentMonth()).length],["Most common incident type",common]];

  return <section className="space-y-4">
    <header className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-bold text-slate-800">BDRRMO Completed Tasks</h1>{SHOW_SAMPLE_BADGE && <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-500">Sample data</span>}</header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-bold text-(--gf-green)">{loading ? "..." : value}</p></div>)}</div>
    <div className="flex flex-wrap gap-3">
      <input aria-label="Search completed tasks" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search tasks, locations or teams" className={control + " min-w-0 flex-1"} />
      <select aria-label="Incident type" value={type} onChange={event => setType(event.target.value)} className={control}><option value="">All incident types</option>{types.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Completion month" value={month} onChange={event => setMonth(event.target.value)} className={control}><option value="">All months</option>{months.map(value => <option key={value}>{value}</option>)}</select>
      <button type="button" className="gf-btn" onClick={() => { setQuery(""); setType(""); setMonth(""); }}>Reset</button>
    </div>
    {loading ? <p role="status" className="p-8 text-center">Loading completed tasks...</p> : !filtered.length ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No completed tasks match these filters.</p> : <>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm"><thead className="bg-(--gf-green-soft) text-slate-600"><tr>{["Task / Incident ID","Incident types","Location","Completed","Responding team","Response time","Outcome / remarks","Action"].map(label => <th key={label} scope="col" className="p-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody>{filtered.map(task => <tr key={task.id} className="border-t border-slate-100">
            <td className="p-3 font-semibold">{task.id}</td><td className="p-3">{task.categories.join("; ")}</td><td className="p-3">{task.location}</td><td className="p-3"><time dateTime={task.resolved}>{dateTime(task.resolved)}</time></td><td className="p-3">{task.team}</td><td className="p-3">{task.responseMinutes} min</td><td className="min-w-48 p-3">{task.outcome}</td><td className="p-3"><button type="button" className="gf-btn whitespace-nowrap" onClick={() => setSelected(task)}>View details</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">{filtered.map(task => <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold">{task.id}</h2><p className="mt-1 text-sm font-semibold text-(--gf-green)">{task.categories.join(" + ")}</p>
        <p className="mt-2 text-sm">{task.location}</p><time dateTime={task.resolved} className="text-xs text-slate-500">{dateTime(task.resolved)}</time>
        <p className="mt-2 text-sm">{task.team} / {task.responseMinutes} min response</p><p className="mt-2 text-sm text-slate-600">{task.outcome}</p>
        <button type="button" className="gf-btn mt-3" onClick={() => setSelected(task)}>View details</button>
      </article>)}</div>
    </>}
    {selected && <TaskDetails task={selected} onClose={() => setSelected(null)} />}
  </section>;
}
