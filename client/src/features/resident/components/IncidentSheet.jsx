import { useEffect, useRef, useState } from "react";
import { getCategory, getStatus } from "../../../shared/components/MapViewer";

/* Snapped heights (sheet slides between them), in viewport height units */
const COLLAPSED_VH = 26; // visible height when collapsed
const EXPANDED_VH = 72; // visible height when expanded
const SHEET_VH = 80; // actual DOM height of the sheet

const vh = (v) => (v / 100) * (window.innerHeight || 800);

/* Glyph badge, same look as the map legend */
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

const Detail = ({ label, value }) => (
  <div className="rounded-xl bg-gray-50 p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
      {label}
    </p>
    <p className="mt-1 break-words text-sm font-semibold text-gray-800">
      {value || "—"}
    </p>
  </div>
);

export default function IncidentSheet({ incident, onClose }) {
  /* Keep rendering during the pop-down animation */
  const [shown, setShown] = useState(incident);
  const [closing, setClosing] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(0); // current translateY in px
  const dragRef = useRef({ startY: 0, baseY: 0, last: null });
  const sheetRef = useRef(null);

  const collapsedY = vh(SHEET_VH - COLLAPSED_VH); // translateY when collapsed
  const baseY = expanded ? 0 : collapsedY;

  /* Keep the incident on screen while it animates out */
  useEffect(() => {
    if (incident) {
      setShown(incident);
      setClosing(false);
    } else if (shown) {
      setClosing(true);
      const timer = setTimeout(() => {
        setShown(null);
        setClosing(false);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [incident?.id]);

  // Click outside the sheet closes it (map pans/drags don't, only real clicks;
  // marker clicks are ignored so switching pins doesn't blink the sheet)
  useEffect(() => {
    const onOutsideClick = (e) => {
      if (closingRef.current || dragRef.current?.startY) return;
      if (e.target.closest?.(".leaflet-marker-icon")) return;
      if (!sheetRef.current?.contains(e.target)) onCloseRef.current?.();
    };

    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, []);

  const closingRef = useRef(false);
  closingRef.current = closing;
  const onCloseRef = useRef(null);
  onCloseRef.current = onClose;

  // Snap to the resting position after a drag ends
  useEffect(() => {
    if (!dragging) setPos(baseY);
  }, [baseY, dragging]);

  // New selection starts collapsed
  useEffect(() => {
    setExpanded(false);
  }, [shown?.id]);

  if (!shown) return null;

  const category = getCategory(shown.category);
  const status = getStatus(shown.status);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { startY: e.clientY, baseY: pos, last: e.clientY };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    // Follow the finger, rubber-banded: slightly past the top, and well
    // past the collapsed spot so it can be dragged all the way down
    const raw = dragRef.current.baseY + (e.clientY - dragRef.current.startY);
    setPos(Math.max(-40, Math.min(collapsedY + 120, raw)));
    dragRef.current.last = e.clientY;
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const moved = e.clientY - dragRef.current.startY;
    dragRef.current.last = moved;
    setDragging(false);

    const fromCollapsed = dragRef.current.baseY >= collapsedY - 1;

    // First swipe down from fully open minimizes; swiping down again closes
    if (pos < collapsedY * 0.45 || (moved < -60 && !expanded)) {
      setExpanded(true);
    } else if (fromCollapsed && (pos > collapsedY + 40 || moved > 80)) {
      onClose?.();
    } else if (pos > collapsedY + 100) {
      // dragged well past the minimized spot -> dismissed outright
      onClose?.();
    } else {
      setExpanded(false);
    }
  };

  return (
    <div
      ref={sheetRef}
      className={closing ? "pointer-events-none" : ""}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col
                   rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,.25)]
                   ring-1 ring-black/5"
        style={{
          height: `${SHEET_VH}vh`,
          transform: `translateY(${pos}px)`,
          transition: dragging
            ? "none"
            : "transform .4s cubic-bezier(.34,1.3,.64,1)",
          animation: closing
            ? "sheet-pop-down .28s ease-in forwards"
            : "sheet-pop-up .42s cubic-bezier(.34,1.4,.64,1) both",
          pointerEvents: "auto",
        }}
      >
        {/* Drag handle + peek content */}
        <div
          className="touch-none cursor-grab select-none p-3 pb-1 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={() => {
            if (Math.abs(dragRef.current.last ?? 0) < 8) setExpanded(!expanded);
          }}
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />

          <div className="flex items-center gap-2">
            <Badge color={category.color} glyph={category.glyph} />
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {category.label}
            </span>
            <StatusChip label={status.label} color={status.color} />
          </div>

          <h2 className="mt-2 text-base font-bold text-gray-900">
            {shown.title}
          </h2>
          <p
            className={`text-[13px] leading-snug text-gray-500 ${
              expanded ? "hidden" : ""
            }`}
          >
            {shown.description}
            <span className="mt-1 block text-[11px] font-medium text-emerald-600">
              Swipe up for full details
            </span>
          </p>
        </div>

        {/* Full details: scrollable when expanded */}
        <div
          className={`min-h-0 flex-1 overflow-y-auto px-4 pb-6 ${
            expanded ? "" : "overflow-hidden"
          }`}
        >
          <div className="mb-2 h-px bg-gray-100" />
          <p className="mb-3 text-sm leading-relaxed text-gray-700">
            {shown.description}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Detail label="Status" value={status.label} />
            <Detail label="Location" value={shown.address} />
            <Detail
              label="Date reported"
              value={
                shown.reportedAt
                  ? new Date(shown.reportedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : ""
              }
            />
            <Detail
              label="Reference No."
              value={String(shown.id).toUpperCase()}
            />
          </div>

          <div className="mt-2 rounded-xl bg-emerald-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-600/70">
              Reported by
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-800">
              {shown.reporter || "Anonymous resident"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
