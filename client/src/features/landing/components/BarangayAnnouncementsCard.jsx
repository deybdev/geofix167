import { Megaphone, Calendar, ChevronRight, Bell } from "lucide-react";
import { BARANGAY_ANNOUNCEMENTS } from "../data/landingData";

export default function BarangayAnnouncementsCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
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
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Feed
        </span>
      </div>

      {/* Announcements Feed */}
      <div className="mt-4 flex flex-col gap-3 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
        {BARANGAY_ANNOUNCEMENTS.map((ann) => (
          <div
            key={ann.id}
            className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition-all hover:border-slate-200 hover:bg-white"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${ann.badgeColor}`}
              >
                {ann.tag}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                <Calendar size={11} />
                {ann.date}
              </span>
            </div>

            <h4 className="text-xs font-bold text-slate-900 leading-snug">
              {ann.title}
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 line-clamp-3">
              {ann.content}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>Barangay Hall Hotline: 668-338-3141</span>
        <a
          href="#about"
          className="text-[#2E8B57] font-bold hover:underline inline-flex items-center gap-0.5"
        >
          <span>More updates</span>
          <ChevronRight size={13} />
        </a>
      </div>
    </div>
  );
}

