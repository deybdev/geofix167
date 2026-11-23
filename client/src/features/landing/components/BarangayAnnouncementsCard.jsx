import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Calendar, ChevronRight, Video } from "lucide-react";
import { PATHS } from "../../../router/paths";
import AnnouncementDetailsModal from "../../../pages/AnnouncementDetailsModal";
import { announcementCategoryBadge } from "../../../shared/constants/announcementCategoryStyles";

export default function BarangayAnnouncementsCard() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const closeAnnouncement = useCallback(() => setSelectedId(""), []);
  useEffect(() => { const controller = new AbortController(); fetch("/api/announcements?limit=5", { signal: controller.signal, cache: "no-store" }).then((r) => r.ok ? r.json() : { announcements: [] }).then((d) => setItems(d.announcements || [])).catch(() => setItems([])); return () => controller.abort(); }, []);
  return (
    <div className="landing-card flex flex-col p-5">
      {/* Header matching screenshot */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#2E8B57]">
            <Megaphone size={16} />
          </div>
          <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
            Barangay Announcements
          </h3>
        </div>
        {items.length > 0 && <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2f7550]"></span>
          Live Feed
        </span>}
      </div>

      {/* Announcements Feed */}
      <div className="mt-4 flex flex-col gap-3 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
        {items.map((ann) => (
          <button key={ann.id} type="button" aria-haspopup="dialog" onClick={() => setSelectedId(ann.id)} className="landing-card w-full rounded-lg p-3.5 text-left">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${announcementCategoryBadge(ann.category)}`}
              >
                {ann.category}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                <Calendar size={11} />
                {new Date(ann.published_at).toLocaleDateString()}
              </span>
            </div>

            <h4 className="text-xs font-bold text-slate-900 leading-snug">
              {ann.title}
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 line-clamp-3">
              {ann.details}
            </p>
            {ann.media?.length > 0 && <div className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-emerald-800"><span className="flex h-7 w-9 items-center justify-center overflow-hidden rounded border border-emerald-100 bg-emerald-50">{ann.media[0].media_type === "VIDEO" ? <Video size={14} /> : <img src={ann.media[0].url} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>{ann.media.length} media attachment{ann.media.length === 1 ? "" : "s"}</div>}
          </button>
        ))}
        {items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">No announcements yet.</p>}
      </div>
      {selectedId && <AnnouncementDetailsModal id={selectedId} onClose={closeAnnouncement} />}

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Barangay Hall Hotline: 668-338-3141</span>
        <Link
          to={PATHS.announcements}
          className="text-[#2E8B57] font-bold hover:underline inline-flex items-center gap-0.5"
        >
          <span>More updates</span>
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}

