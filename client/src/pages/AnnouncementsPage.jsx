import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Clock3, MapPin, Megaphone, Search } from "lucide-react";
import AccessibleDropdown from "../shared/components/AccessibleDropdown";
import AnnouncementDetailsModal from "./AnnouncementDetailsModal";
import { announcementCategoryBadge, announcementCategoryOptions } from "../shared/constants/announcementCategoryStyles";
import catalog from "../../../server/src/shared/announcementCatalog.json";

const dateLabel = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";
const timeLabel = (value) => value ? new Date(`1970-01-01T${value}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

export default function AnnouncementsPage({ initialSelectedId = "", onCloseAnnouncement } = {}) {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  useEffect(() => setSelectedId(initialSelectedId), [initialSelectedId]);
  const categoryOptions = useMemo(() => [
    { value: "", label: "All categories", tone: "green", tag: String(catalog.categories.length) },
    ...announcementCategoryOptions(catalog.categories),
  ], []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "10", offset: String(offset) });
    if (category) params.set("category", category);
    if (query.trim()) params.set("q", query.trim());
    fetch(`/api/announcements?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load announcements.");
        setItems((current) => offset ? [...current, ...(data.announcements || [])] : data.announcements || []);
        setMore((data.announcements || []).length === 10);
      })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [category, query, offset]);

  const resetResults = (update) => { setItems([]); setOffset(0); update(); };
  const closeAnnouncement = useCallback(() => { setSelectedId(""); onCloseAnnouncement?.(); }, [onCloseAnnouncement]);

  return <div className="min-h-full bg-[#f4f8f5] pb-12">
    <section className="bg-[#103b2b] text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-14">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-100"><Megaphone size={13} /> Barangay 167 · Caloocan City</div>
        <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Community information</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Barangay Announcements</h1><p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/85">Official updates, safety advisories, and events for residents of Barangay 167.</p></div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Public information feed</div>
        </div>
      </div>
    </section>

    <section className="mx-auto w-full max-w-6xl px-5 pt-7">
      <div className="rounded-2xl border border-[#dce8df] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-bold text-slate-900">Find an update</h2><p className="mt-1 text-xs text-slate-500">Filter by topic or search announcement details.</p></div>
          <div className="grid gap-2 sm:w-[460px] sm:grid-cols-[190px_1fr]">
            <AccessibleDropdown label="Filter announcements by category" value={category} options={categoryOptions} onChange={(value) => resetResults(() => setCategory(value))} />
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-slate-400 focus-within:ring-2 focus-within:ring-emerald-600"><Search size={14} /><input value={query} onChange={(event) => resetResults(() => setQuery(event.target.value))} aria-label="Search announcements" placeholder="Search announcements" className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400" /></label>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={() => setOffset(0)} className="ml-2 font-semibold underline">Retry</button></div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {items.map((item) => <button key={item.id} type="button" aria-haspopup="dialog" onClick={() => setSelectedId(item.id)} className="group flex min-h-56 flex-col rounded-2xl border border-[#dce8df] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
          <div className="flex w-full items-start justify-between gap-3"><span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${announcementCategoryBadge(item.category)}`}>{item.category}</span><span className="shrink-0 text-[10px] text-slate-400">Posted {dateLabel(item.published_at)}</span></div>
          <h2 className="mt-4 text-lg font-bold leading-snug text-slate-900 group-hover:text-emerald-800">{item.title}</h2>
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-600">{item.details}</p>
          {(item.event_date || item.event_time || item.venue) && <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-500">
            {item.event_date && <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-emerald-700" />{dateLabel(item.event_date)}</span>}
            {item.event_time && <span className="inline-flex items-center gap-1.5"><Clock3 size={13} className="text-emerald-700" />{timeLabel(item.event_time)}</span>}
            {item.venue && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-emerald-700" />{item.venue}</span>}
          </div>}
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-emerald-800">View announcement <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" /></span>
        </button>)}
      </div>
      {!loading && !error && items.length === 0 && <div className="mt-5 rounded-2xl border border-dashed border-[#cbd9cf] bg-white px-5 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Megaphone size={21} /></div><h2 className="mt-4 text-base font-bold text-slate-900">No announcements found</h2><p className="mt-1 text-sm text-slate-500">Try another category or search term.</p></div>}
      {loading && <p className="py-8 text-center text-sm text-slate-500">Loading announcements…</p>}
      {more && <button disabled={loading} onClick={() => setOffset((current) => current + 10)} className="mx-auto mt-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50">Load more announcements <ArrowRight size={13} /></button>}
    </section>
    {selectedId && <AnnouncementDetailsModal id={selectedId} onClose={closeAnnouncement} />}
  </div>;
}
