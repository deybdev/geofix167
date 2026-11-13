import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getCategory, getStatus } from "../../../shared/utils/mapUtils";

const EXPANDED_H = "85vh";
const MAX_DRAG_RATIO = 0.85; // keep in sync with EXPANDED_H
const SWIPE_THRESHOLD = 60;
const TAP_THRESHOLD = 6;
const CLOSE_ANIM_MS = 260;

const Badge = ({ color, glyph }) => (
  <span
    className="flex h-6 w-6 items-center justify-center rounded-full"
    style={{ background: color }}
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      // glyph must be a trusted, hard-coded SVG fragment (never user input)
      dangerouslySetInnerHTML={{ __html: glyph }}
    />
  </span>
);

const StatusChip = ({ label, color }) => (
  <span
    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
    style={{ background: `${color}1a`, color }}
  >
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    {label}
  </span>
);

const TIMELINE_COLORS = {
  Submitted: "#94a3b8",
  "Under Review": "#3b82f6",
  Dispatched: "#8b5cf6",
  "In Progress": "#f59e0b",
  Responding: "#f97316",
  Resolved: "#16a34a",
  Rejected: "#ef4444",
};

function formatTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TimelineItem({ entry, isLast }) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const color = TIMELINE_COLORS[entry.status] ?? "#94a3b8";
  const time = formatTime(entry.time);
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
          style={{ background: color }}
        />
        {!isLast && <span className="mt-1 w-px flex-1 bg-slate-200" />}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color }}>
            {entry.status}
          </span>
          {time && <span className="text-[10px] text-slate-400">{time}</span>}
        </div>
        {entry.note && (
          <p className="mt-0.5 text-xs leading-5 text-slate-600">{entry.note}</p>
        )}
        {entry.photo && (
          <>
            <button
              type="button"
              onClick={() => setPhotoOpen((v) => !v)}
              className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-800"
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-200 ${photoOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              {photoOpen ? "Hide photo" : "View photo"}
            </button>
            {photoOpen && (
              <img
                src={entry.photo}
                alt={`${entry.status} photo`}
                className="mt-2 rounded-xl object-cover"
                style={{ width: "100%", maxWidth: 260, maxHeight: 160, display: "block" }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function IncidentSheet({ incident, onClose }) {
  const [shown, setShown] = useState(incident);
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragH, setDragH] = useState(null); // px override while dragging
  const [collapsedH, setCollapsedH] = useState(null);

  const panelRef = useRef(null); // the visible sheet (NOT the full-screen wrapper)
  const headerRef = useRef(null);
  const dragRef = useRef({
    active: false,
    startY: 0,
    startH: 0,
    lastY: 0,
    lastT: 0,
    vy: 0, // upward velocity in px/ms (positive = moving up)
  });
  const detailsRef = useRef(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const hasIncidentRef = useRef(!!incident);

  closingRef.current = closing;
  onCloseRef.current = onClose;
  hasIncidentRef.current = !!incident;

  // Keep `shown` in sync with the prop (including updates to the same incident,
  // e.g. a status change) and run the exit animation when it goes away.
  useEffect(() => {
    if (incident) {
      setShown(incident);
      setClosing(false);
      return;
    }
    if (!shown) return;
    setClosing(true);
    const t = setTimeout(() => {
      setShown(null);
      setClosing(false);
    }, CLOSE_ANIM_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident]);

  // Collapse again whenever a different incident is shown
  useEffect(() => {
    setExpanded(false);
    setDragH(null);
  }, [shown?.id]);

  // Outside click closes the sheet (ignore map markers and clicks while closed/closing)
  useEffect(() => {
    const onOutside = (e) => {
      if (closingRef.current || !hasIncidentRef.current) return;
      if (e.target.closest?.(".leaflet-marker-icon")) return;
      if (!panelRef.current?.contains(e.target)) onCloseRef.current?.();
    };
    document.addEventListener("click", onOutside, true);
    return () => document.removeEventListener("click", onOutside, true);
  }, []);

  // Escape: collapse first, then close
  useEffect(() => {
    if (!incident) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [incident, expanded]);

  // Measure the collapsed height so height can animate in px (auto can't transition)
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    // Only measure the compact layout (the header is shorter when details show)
    const measure = () => {
      if (detailsRef.current) return;
      setCollapsedH(el.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown?.id, expanded]);

  // Show the detail content while dragging too, so the sheet isn't blank mid-swipe
  const showDetails =
    expanded || (dragH !== null && dragH > (collapsedH ?? 0) + 8);
  detailsRef.current = showDetails;

  if (!shown) return null;

  const category = getCategory(shown.category);
  const status = getStatus(shown.status);
  const timeline = shown.timeline ?? [];

  // ── pointer drag on the handle ──
  const onPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const currentH = panelRef.current?.offsetHeight ?? 200;
    dragRef.current = {
      active: true,
      startY: e.clientY,
      startH: currentH,
      lastY: e.clientY,
      lastT: e.timeStamp,
      vy: 0,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) {
      const inst = (d.lastY - e.clientY) / dt;
      d.vy = d.vy * 0.6 + inst * 0.4; // smoothed
    }
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const delta = d.startY - e.clientY; // positive = dragging up
    if (Math.abs(delta) < TAP_THRESHOLD) return;
    const maxH = window.innerHeight * MAX_DRAG_RATIO;
    setDragH(Math.max(80, Math.min(maxH, d.startH + delta)));
  };

  const finishDrag = (e, cancelled) => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const delta = d.startY - e.clientY;
    setDragH(null);
    if (cancelled) return;

    if (Math.abs(delta) < TAP_THRESHOLD) {
      setExpanded((v) => !v); // tap on the handle toggles
      return;
    }

    // Snap by where the sheet was released, not just by swipe direction.
    const low = collapsedH ?? d.startH;
    const high = window.innerHeight * MAX_DRAG_RATIO;
    const releasedH = Math.max(
      80,
      Math.min(high, d.startH + delta)
    );
    const FLICK = 0.6; // px/ms
    const flickUp = d.vy > FLICK;
    const flickDown = d.vy < -FLICK;

    // Sheet pulled below its collapsed height, or flicked down while collapsed -> close
    if (!expanded && (releasedH < low - SWIPE_THRESHOLD / 2 || (flickDown && delta < 0))) {
      onCloseRef.current?.();
      return;
    }

    if (flickUp) setExpanded(true);
    else if (flickDown) setExpanded(false);
    else {
      // nearest snap point: past the halfway mark between collapsed and full
      const midpoint = low + (high - low) * 0.5;
      setExpanded(releasedH > midpoint);
    }
  };

  const onHandleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpanded((v) => !v);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setExpanded(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (expanded) setExpanded(false);
      else onCloseRef.current?.();
    }
  };

  const restingH = expanded ? EXPANDED_H : collapsedH ?? "auto";
  const height = dragH !== null ? dragH : restingH;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1200, pointerEvents: "none" }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={shown.title}
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,.22)] ring-1 ring-black/5"
        style={{
          height,
          maxHeight: "92vh",
          transition:
            dragH !== null ? "none" : "height .35s cubic-bezier(.4,0,.2,1)",
          // NOTE: requires @keyframes sheet-pop-up / sheet-pop-down in your CSS
          animation: closing
            ? `sheet-pop-down ${CLOSE_ANIM_MS}ms ease-in forwards`
            : "sheet-pop-up .38s cubic-bezier(.34,1.4,.64,1) both",
          pointerEvents: closing ? "none" : "auto",
          overflow: "hidden",
        }}
      >
        {/* ── Handle + collapsed content ── */}
        <div
          ref={headerRef}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onKeyDown={onHandleKeyDown}
          className="touch-none shrink-0 cursor-grab select-none px-4 pb-3 pt-3 outline-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finishDrag(e, false)}
          onPointerCancel={(e) => finishDrag(e, true)}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" />

          <div className="flex items-center gap-2">
            <Badge color={category.color} glyph={category.glyph} />
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {category.label}
            </span>
            <StatusChip label={status.label} color={status.color} />
          </div>

          <h2 className="mt-2 text-base font-bold text-gray-900">{shown.title}</h2>
          {!showDetails && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-gray-500">
              {shown.description}
            </p>
          )}

          {!showDetails && (
            <p className="mt-2 text-[11px] font-semibold text-emerald-600">
              Swipe up to see full details ↑
            </p>
          )}
        </div>

        {/* ── Expanded content ── */}
        {showDetails && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
            <div className="mb-4 h-px bg-gray-100" />

            {shown.photo && (
              <img
                src={shown.photo}
                alt={shown.title}
                className="mb-4 h-44 w-full rounded-2xl object-cover"
              />
            )}

            <p className="mb-5 text-sm leading-relaxed text-gray-700">
              {shown.description}
            </p>

            <div className="mb-5 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Location
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {shown.address || "—"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  Reported by
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {shown.reporter || "Anonymous"}
                </p>
              </div>
            </div>

            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              Timeline
            </p>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400">No timeline available.</p>
            ) : (
              <div>
                {timeline.map((entry, i) => (
                  <TimelineItem
                    key={`${entry.status}-${entry.time}-${i}`}
                    entry={entry}
                    isLast={i === timeline.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}