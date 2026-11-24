import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flame,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const dateTime = (value) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });

const monthOf = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(value));

const currentMonth = () => monthOf(new Date());

function responseTone(minutes) {
  if (minutes <= 15) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (minutes <= 30) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function useCompletedTasks() {
  const [state, setState] = useState({ tasks: [], loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/bdrrmo/completed-tasks", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Could not load completed BDRRMO tasks.");
        setState({ tasks: Array.isArray(data?.tasks) ? data.tasks : [], loading: false, error: "" });
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setState({ tasks: [], loading: false, error: err?.message || "Unable to load completed tasks." });
        }
      });
    return () => controller.abort();
  }, []);
  return state;
}

function TaskDetails({ task, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);

  const photos = Array.isArray(task.photos) ? task.photos : [];
  const timeline = [
    ["Reported", task.reported],
    ["Dispatched", task.dispatched],
    ["Arrived on Scene", task.arrived],
    ["Verified & Closed", task.resolved],
  ];

  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="completed-task-title"
      className="fixed inset-y-0 left-auto right-0 m-0 flex h-dvh max-h-dvh w-full max-w-xl flex-col border-l border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]"
    >
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-emerald-100 bg-emerald-50/70 px-6 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-(--gf-green) px-2 py-0.5 text-xs font-extrabold tracking-wide text-white">
              {task.id}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
              <CheckCircle2 size={12} /> Closed by BDRRMO
            </span>
          </div>
          <h2 id="completed-task-title" className="mt-2 text-base font-extrabold text-slate-900">
            {task.categories.join(" + ")}
          </h2>
        </div>
        <button
          autoFocus
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-full p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <MapPin size={15} className="mt-0.5 shrink-0 text-(--gf-green)" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-800">{task.location}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Users size={15} className="mt-0.5 shrink-0 text-(--gf-green)" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Responding Units</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-800">{task.team}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock size={15} className="mt-0.5 shrink-0 text-(--gf-green)" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Response Time</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900">{task.responseMinutes} min</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CalendarDays size={15} className="mt-0.5 shrink-0 text-(--gf-green)" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Closed At (PH)</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-800">{dateTime(task.resolved)}</p>
            </div>
          </div>
        </div>

        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <Clock size={13} className="text-(--gf-green)" /> Response Timeline
          </h3>
          <ol className="mt-3 space-y-3 border-l-2 border-emerald-200 pl-4">
            {timeline.map(([label, time]) => (
              <li key={label} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-(--gf-green) bg-white" />
                <strong className="block text-xs font-bold text-slate-800">{label}</strong>
                <time dateTime={time} className="text-xs text-slate-500">
                  {dateTime(time)}
                </time>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <FileText size={13} className="text-(--gf-green)" /> Resolution Outcome
          </h3>
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
            {task.outcome}
          </p>
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            <Camera size={13} className="text-(--gf-green)" /> Attached Evidence ({photos.length})
          </h3>
          {photos.length > 0 ? (
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-emerald-300"
                >
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="h-32 w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                  <span className="block truncate px-2.5 py-1.5 text-[11px] font-semibold text-slate-700">
                    {photo.label}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
              No photographic evidence attached to this record.
            </p>
          )}
        </section>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-6 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
        >
          Close
        </button>
        {task.incidentId && (
          <a
            href={`/api/reports/${encodeURIComponent(task.incidentId)}/handover-summary`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-(--gf-green) px-4 py-2 text-xs font-bold text-white transition hover:bg-(--gf-green-dark)"
          >
            <Download size={14} /> Open Summary PDF
          </a>
        )}
      </footer>
    </dialog>
  );
}

export default function BdrrmoCompletedTasks() {
  const { tasks, loading, error } = useCompletedTasks();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [month, setMonth] = useState("");
  const [selected, setSelected] = useState(null);

  const types = [...new Set(tasks.flatMap((task) => task.categories))].sort();
  const months = [...new Set(tasks.map((task) => monthOf(task.resolved)))].sort().reverse();
  const filtered = tasks.filter(
    (task) =>
      (!type || task.categories.includes(type)) &&
      (!month || monthOf(task.resolved) === month) &&
      [task.id, ...task.categories, task.location, task.team, task.outcome]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  const average = tasks.length
    ? Math.round(tasks.reduce((sum, task) => sum + task.responseMinutes, 0) / tasks.length)
    : 0;
  const common =
    [...types].sort(
      (a, b) =>
        tasks.filter((task) => task.categories.includes(b)).length -
        tasks.filter((task) => task.categories.includes(a)).length,
    )[0] || "None";

  const metrics = [
    { label: "Total Completed", value: tasks.length, icon: ShieldCheck, accent: "text-emerald-700 bg-emerald-50" },
    { label: "Avg Response Time", value: `${average} min`, icon: Clock, accent: "text-blue-700 bg-blue-50" },
    {
      label: "Completed This Month",
      value: tasks.filter((task) => monthOf(task.resolved) === currentMonth()).length,
      icon: CalendarDays,
      accent: "text-violet-700 bg-violet-50",
    },
    { label: "Most Common Incident", value: common, icon: Flame, accent: "text-amber-700 bg-amber-50" },
  ];

  const hasFilters = Boolean(query || type || month);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">BDRRMO Completed Emergencies</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Verified emergency completion summaries automatically synced from BDRRMO closure.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={13} /> Live Synced
        </span>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-1.5 truncate text-xl font-extrabold text-slate-900">
                {loading ? "…" : value}
              </p>
            </div>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accent}`}>
              <Icon size={18} />
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search completed tasks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search reference ID, incident type, location, or team…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-(--gf-green) focus:bg-white"
          />
        </div>
        <select
          aria-label="Incident type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-(--gf-green)"
        >
          <option value="">All Incident Types</option>
          {types.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Completion month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-(--gf-green)"
        >
          <option value="">All Months</option>
          {months.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setType("");
              setMonth("");
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      {loading ? (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading completed BDRRMO emergencies…
        </div>
      ) : !filtered.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <ShieldCheck size={32} className="mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-bold text-slate-700">No completed emergencies found</p>
          <p className="mt-1 text-xs text-slate-500">
            Closed emergency summaries from BDRRMO will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    {[
                      "Reference",
                      "Incident Type",
                      "Location",
                      "Responding Team",
                      "Response",
                      "Closed (PH)",
                      "Outcome",
                      "Action",
                    ].map((label) => (
                      <th key={label} scope="col" className="px-4 py-3.5">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((task) => (
                    <tr key={task.id} className="transition hover:bg-emerald-50/40">
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-emerald-50 px-2 py-1 font-extrabold text-(--gf-green)">
                          {task.id}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {task.categories.map((cat) => (
                            <span
                              key={cat}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-slate-700" title={task.location}>
                        {task.location}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">{task.team}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${responseTone(task.responseMinutes)}`}
                        >
                          <Clock size={11} /> {task.responseMinutes}m
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">
                        <time dateTime={task.resolved}>{dateTime(task.resolved)}</time>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3.5 text-slate-600" title={task.outcome}>
                        {task.outcome}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelected(task)}
                          className="whitespace-nowrap rounded-lg bg-(--gf-green) px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark)"
                        >
                          View Summary
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {filtered.map((task) => (
              <article key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-(--gf-green)">
                    {task.id}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${responseTone(task.responseMinutes)}`}
                  >
                    <Clock size={11} /> {task.responseMinutes}m
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold text-slate-900">{task.categories.join(" + ")}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                  <MapPin size={12} className="shrink-0 text-slate-400" /> {task.location}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {task.team} • <time dateTime={task.resolved}>{dateTime(task.resolved)}</time>
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">{task.outcome}</p>
                <button
                  type="button"
                  onClick={() => setSelected(task)}
                  className="mt-3 w-full rounded-xl bg-(--gf-green) py-2 text-xs font-bold text-white"
                >
                  View Summary
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {selected && <TaskDetails task={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
