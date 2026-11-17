import { useEffect, useState } from "react";
import { CalendarDays, Clock3, MapPin, Megaphone, X } from "lucide-react";
import { announcementCategoryBadge } from "../shared/constants/announcementCategoryStyles";

const dateLabel = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "";
const timeLabel = (value) => value ? new Date(`1970-01-01T${value}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

export default function AnnouncementDetailsModal({ id, onClose }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setItem(null);
    fetch(`/api/announcements/${encodeURIComponent(id)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load this announcement.");
        setItem(data.announcement);
      })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="announcement-dialog-title" className="relative max-h-[min(88dvh,720px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/70 bg-[#fffefa] shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-[#fffefa]/95 px-5 py-4 backdrop-blur sm:px-7">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50"><Megaphone size={16} /></span>Barangay 167 announcement</div>
        <button type="button" onClick={onClose} aria-label="Close announcement" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><X size={19} /></button>
      </div>

      <div className="p-5 sm:p-8">
        {loading ? <div className="space-y-4 py-8" aria-live="polite"><div className="h-6 w-28 animate-pulse rounded-full bg-slate-100" /><div className="h-8 w-3/4 animate-pulse rounded bg-slate-100" /><div className="h-28 animate-pulse rounded-xl bg-slate-50" /></div>
          : error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
            : item && <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold ${announcementCategoryBadge(item.category)}`}>{item.category}</span>
                <span className="text-[11px] text-slate-400">Published {new Date(item.published_at).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              <h1 id="announcement-dialog-title" className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-3xl">{item.title}</h1>
              {(item.event_date || item.event_time || item.venue) && <div className="mt-5 grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 sm:grid-cols-2">
                {item.event_date && <div className="flex items-center gap-2.5 text-sm text-slate-700"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700"><CalendarDays size={15} /></span><span><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Event date</span>{dateLabel(item.event_date)}</span></div>}
                {item.event_time && <div className="flex items-center gap-2.5 text-sm text-slate-700"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700"><Clock3 size={15} /></span><span><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Time</span>{timeLabel(item.event_time)}</span></div>}
                {item.venue && <div className="flex items-center gap-2.5 text-sm text-slate-700 sm:col-span-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-700"><MapPin size={15} /></span><span><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Venue</span>{item.venue}</span></div>}
              </div>}
              <div className="mt-6 border-l-2 border-emerald-200 pl-4 sm:pl-5"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">{item.details}</p></div>
              <div className="mt-7 border-t border-slate-100 pt-4 text-[11px] font-medium text-slate-400">GeoFix 167 <span className="px-1">·</span> Barangay 167, Caloocan City</div>
            </>}
      </div>
    </section>
  </div>;
}
