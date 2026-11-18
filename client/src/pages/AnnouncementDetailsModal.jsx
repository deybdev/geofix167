import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Expand, MapPin, Megaphone, X } from "lucide-react";
import { announcementCategoryBadge } from "../shared/constants/announcementCategoryStyles";

const dateLabel = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "";
const timeLabel = (value) => value ? new Date(`1970-01-01T${value}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

export default function AnnouncementDetailsModal({ id, onClose }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

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
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (selectedImage) setSelectedImage(null);
      else onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, selectedImage]);

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
              {item.media?.length > 0 && <section className="mt-6"><h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Photos and videos</h2><div className="grid gap-3 sm:grid-cols-2">{item.media.map((media) => <div key={media.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{media.media_type === "VIDEO" ? <video controls preload="metadata" className="max-h-[360px] w-full bg-slate-950" aria-label={media.original_filename}><source src={media.url} type={media.content_type} />Your browser does not support video playback.</video> : <button type="button" onClick={() => setSelectedImage(media)} aria-label={`View image ${media.original_filename}`} className="group relative block w-full cursor-zoom-in bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"><img src={media.url} alt={media.original_filename} loading="lazy" className="max-h-[360px] w-full object-contain" /><span className="absolute inset-x-3 bottom-3 hidden items-center justify-center gap-2 rounded-lg bg-slate-950/80 px-3 py-2 text-xs font-semibold text-white shadow transition sm:inline-flex sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100"><Expand size={14} />View image</span></button>}<div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2"><p className="truncate text-[10px] text-slate-500" title={media.original_filename}>{media.original_filename}</p>{media.media_type !== "VIDEO" && <button type="button" onClick={() => setSelectedImage(media)} className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"><Expand size={12} />View image</button>}</div></div>)}</div></section>}
              <div className="mt-6 border-l-2 border-emerald-200 pl-4 sm:pl-5"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">{item.details}</p></div>
              <div className="mt-7 border-t border-slate-100 pt-4 text-[11px] font-medium text-slate-400">GeoFix 167 <span className="px-1">·</span> Barangay 167, Caloocan City</div>
            </>}
      </div>
    </section>
    {selectedImage && <div role="dialog" aria-modal="true" aria-label={`Image preview: ${selectedImage.original_filename}`} className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedImage(null); }}><div className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950"><div className="flex items-center justify-between gap-3 px-4 py-3 text-white"><span className="truncate text-xs font-semibold">{selectedImage.original_filename}</span><button type="button" onClick={() => setSelectedImage(null)} aria-label="Close image preview" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X size={18} /></button></div><img src={selectedImage.url} alt={selectedImage.original_filename} className="max-h-[82dvh] max-w-full self-center object-contain" /></div></div>}
  </div>;
}
