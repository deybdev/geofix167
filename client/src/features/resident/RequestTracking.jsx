import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, MessageCircle, Phone } from "lucide-react";

import MapPage from "../../shared/components/MapPage";
import { Button, buttonVariants } from "../../shared/components/ui/button";
import { PATHS } from "../../router/paths";
import {
  FACILITY_PIN_CATEGORY,
  RESPONDERS,
  RESPONSE_FACILITIES,
  facilityInfo,
  fetchRoadRoute,
  pointAtFraction,
  routePoints,
} from "../../shared/utils/dispatch";

const ASSIGN_DELAY_MS = 4000;
const TRAVEL_TICK_MS = 900;
const TRAVEL_STEP = 0.04;

const EXPANDED_H = "85vh";
const MAX_DRAG_RATIO = 0.85; // keep in sync with EXPANDED_H
const TAP_THRESHOLD = 6;

const TIMELINE_COLORS = {
  Submitted: "#94a3b8",
  Dispatched: "#8b5cf6",
  "En route": "#f97316",
  "On site": "#16a34a",
};

/* Which station answers this report: fire truck, patrol, ambulance,
   or the barangay maintenance crew for infrastructure work. */
function unitFor(category) {
  if (category === "fire") return "fire";
  if (category === "crime") return "police";
  if (category === "medical" || category === "accident") return "hospital";
  return "barangay";
}

function TimelineItem({ entry, isLast }) {
  const color = TIMELINE_COLORS[entry.status] ?? "#94a3b8";
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
        <span className="text-[11px] font-bold" style={{ color }}>
          {entry.status}
        </span>
        {entry.note && (
          <p className="mt-0.5 text-xs leading-5 text-slate-600">{entry.note}</p>
        )}
      </div>
    </div>
  );
}

export default function RequestTracking({ position, address, category, categoryLabel }) {
  const navigate = useNavigate();
  const unitKey = useMemo(() => unitFor(category), [category]);

  const [responder, setResponder] = useState(null);
  const [progress, setProgress] = useState(0);
  const [assignedAt, setAssignedAt] = useState(null);
  const [roadRoute, setRoadRoute] = useState(null);
  const submittedAt = useRef(new Date().toISOString()).current;

  // Dispatch simulation: a unit is assigned a few seconds after submitting,
  // then travels its route to the pin.
  useEffect(() => {
    const timer = setTimeout(() => {
      setResponder(RESPONDERS[unitKey]);
      setAssignedAt(new Date().toISOString());
    }, ASSIGN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [unitKey]);

  useEffect(() => {
    if (!responder) return undefined;
    const tick = setInterval(() => {
      setProgress((current) => {
        if (current >= 1) {
          clearInterval(tick);
          return 1;
        }
        return Math.min(1, current + TRAVEL_STEP);
      });
    }, TRAVEL_TICK_MS);
    return () => clearInterval(tick);
  }, [responder]);

  // Road-following route from the responder's station to the pin (OSRM).
  // While loading (or on failure) the mock bent-line route is shown.
  useEffect(() => {
    if (!responder) return undefined;
    const controller = new AbortController();
    fetchRoadRoute(RESPONSE_FACILITIES[unitKey], position, controller.signal)
      .then(setRoadRoute)
      .catch((err) => {
        if (err.name !== "AbortError") setRoadRoute(null);
      });
    return () => controller.abort();
  }, [responder, unitKey, position]);

  const travel = useMemo(() => {
    if (!responder) return null;
    const mock = facilityInfo(unitKey, position);
    if (roadRoute) {
      return {
        ...mock,
        km: Number(roadRoute.distanceKm.toFixed(1)),
        eta: `${Math.max(2, Math.round(roadRoute.durationMin))} mins`,
      };
    }
    return mock;
  }, [responder, unitKey, position, roadRoute]);

  const station = RESPONSE_FACILITIES[unitKey];
  const pinCategory = FACILITY_PIN_CATEGORY[unitKey];

  const incidents = useMemo(
    () =>
      responder
        ? [
            {
              id: `facility-${unitKey}`,
              title: station.name,
              category: pinCategory,
              status: "Ready",
              lat: station.lat,
              lng: station.lng,
            },
          ]
        : [],
    [responder, unitKey, pinCategory, station],
  );

  const routes = useMemo(() => {
    if (!responder) return [];
    // Real road geometry when the router answers; bent mock line otherwise.
    const points = roadRoute?.points ?? routePoints(unitKey, position);
    return [{ id: "route-responder", points, color: "#2563eb", dashed: false }];
  }, [responder, roadRoute, unitKey, position]);

  // Pins to frame above the sheet: the user's pin, plus the responder's
  // station once a unit is assigned.
  const fitPoints = useMemo(() => {
    const points = [];
    if (position) points.push(position);
    if (responder) points.push({ lat: station.lat, lng: station.lng });
    return points;
  }, [position, responder, station]);

  const trackers = useMemo(
    () =>
      responder
        ? [
            {
              id: "tracker-responder",
              category: pinCategory,
              ...pointAtFraction(routes[0].points, progress),
            },
          ]
        : [],
    [responder, pinCategory, routes, progress],
  );

  const arrived = Boolean(responder) && progress >= 1;

  const timeline = useMemo(() => {
    const entries = [
      {
        status: "Submitted",
        note: "Request received by Barangay 167 dispatch.",
        time: submittedAt,
      },
    ];
    if (responder) {
      entries.push({
        status: "Dispatched",
        note: `${responder.agency} assigned Unit ${responder.unit} to your location.`,
        time: assignedAt,
      });
    }
    if (responder && progress > 0.15 && !arrived) {
      entries.push({
        status: "En route",
        note: `Unit ${responder.unit} is heading to your pin — ETA ~${travel.eta}.`,
      });
    }
    if (arrived) {
      entries.push({
        status: "On site",
        note: "Responder has arrived at the pinned location.",
      });
    }
    return entries;
  }, [responder, assignedAt, progress, arrived, travel, submittedAt]);

  const status = !responder
    ? { text: "Looking for active responders…", color: "text-primary" }
    : arrived
      ? { text: "Responder has arrived", color: "text-emerald-600" }
      : { text: "Responder on the way", color: "text-amber-600" };

  /* ── draggable sheet state (same mechanics as IncidentSheet) ── */
  const panelRef = useRef(null);
  const collapsedRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [dragH, setDragH] = useState(null); // px override while dragging
  const [collapsedH, setCollapsedH] = useState(null);
  const dragRef = useRef({
    active: false,
    startY: 0,
    startH: 0,
    lastY: 0,
    lastT: 0,
    vy: 0, // upward velocity in px/ms
  });

  const closeRef = useRef(() => {});
  closeRef.current = () => navigate(PATHS.resident);

  // Measure the collapsed height so height can animate in px (auto can't transition)
  useLayoutEffect(() => {
    const el = collapsedRef.current;
    if (!el) return;
    const measure = () => setCollapsedH(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responder, arrived]);

  // Show the timeline while dragging up too, so the sheet isn't blank mid-swipe
  const showTimeline = expanded || (dragH !== null && dragH > (collapsedH ?? 0) + 8);

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
      d.vy = d.vy * 0.6 + inst * 0.4;
    }
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const delta = d.startY - e.clientY;
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

    const low = collapsedH ?? d.startH;
    const high = window.innerHeight * MAX_DRAG_RATIO;
    const releasedH = Math.max(80, Math.min(high, d.startH + delta));
    const FLICK = 0.6; // px/ms
    const flickUp = d.vy > FLICK;
    const flickDown = d.vy < -FLICK;

    // Swiping down only collapses — leaving is a deliberate action
    // (Back to Home button or the map's back arrow)
    if (flickUp) setExpanded(true);
    else if (flickDown) setExpanded(false);
    else setExpanded(releasedH > low + (high - low) * 0.5);
  };

  // Escape: collapse first, then leave the tracking view
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  const height = dragH !== null ? dragH : expanded ? EXPANDED_H : collapsedH ?? "auto";

  // Keep the map's pin in the strip above the sheet: offset the map center by
  // the sheet height (collapsed measurement, or the expanded height). Updated
  // on expand/collapse only, not on every drag tick, so the pan isn't janky.
  const bottomInset = expanded
    ? Math.round(window.innerHeight * MAX_DRAG_RATIO)
    : collapsedH ?? 0;

  return (
    <MapPage
      backPath={PATHS.resident}
      incidents={incidents}
      selectedLocation={position}
      routes={routes}
      trackers={trackers}
      bottomInset={bottomInset}
      highlightBoundary={false}
      fitPoints={fitPoints}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-label="Request status"
        className="absolute inset-x-0 bottom-0 z-[1300] flex flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,.22)] ring-1 ring-black/5"
        style={{
          height,
          maxHeight: "92vh",
          transition:
            dragH !== null ? "none" : "height .35s cubic-bezier(.4,0,.2,1)",
          animation: "sheet-pop-up .38s cubic-bezier(.34,1.4,.64,1) both",
        }}
      >
        {/* Collapsed content — doubles as the measured height and the page */}
        <div ref={collapsedRef} className="px-4 pb-5 pt-3">
          {/* Drag zone: handle + status + summary (buttons stay clickable below) */}
          <div
            className="touch-none cursor-grab select-none pb-1 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => finishDrag(e, false)}
            onPointerCancel={(e) => finishDrag(e, true)}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" />

            <div className="flex items-center gap-2">
              {arrived ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
                  <MapPin size={13} className="text-emerald-600" />
                </span>
              ) : (
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
              )}
              <p className={`text-sm font-bold ${status.color}`}>{status.text}</p>
            </div>

            <p className="mt-1 text-xs leading-4 text-slate-500">
              {categoryLabel || "Report"} • {address || "Current location"}
            </p>

            {!expanded && !showTimeline && (
              <p className="mt-2 text-[11px] font-semibold text-emerald-600">
                Swipe up for the response timeline ↑
              </p>
            )}
          </div>

          {responder ? (
            <div className="mt-2 rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e7f4ed] text-sm font-bold text-[#2e8b57]">
                  {responder.name
                    .split(" ")
                    .filter((part) => /[a-zA-Z]/.test(part))
                    .slice(-2)
                    .map((part) => part[0])
                    .join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{responder.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {responder.agency} • Unit {responder.unit}
                  </p>
                </div>
                {!arrived && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600">
                    ETA ~{travel.eta} • {travel.km} km
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <a
                  href={`sms:${responder.contact}`}
                  className={`${buttonVariants({ variant: "outline" })} h-10 flex-1 gap-1.5 rounded-lg text-xs font-semibold`}
                >
                  <MessageCircle size={14} />
                  Message
                </a>
                <a
                  href={`tel:${responder.contact}`}
                  className={`${buttonVariants()} h-10 flex-1 gap-1.5 rounded-lg text-xs font-semibold`}
                >
                  <Phone size={14} />
                  Call
                </a>
              </div>
            </div>
          ) : (
            <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
              Admin and responders have been notified. Help will be dispatched
              shortly — stay on this page to see who is coming.
            </p>
          )}

          <Button
            type="button"
            onClick={() => navigate(PATHS.resident)}
            variant={responder ? "outline" : "default"}
            className="mt-3 h-11 w-full rounded-xl text-sm font-semibold"
          >
            Back to Home
          </Button>
        </div>

        {/* Expanded content: live response timeline */}
        {showTimeline && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            <div className="mb-4 h-px bg-gray-100" />
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">
              Response timeline
            </p>
            <div>
              {timeline.map((entry, i) => (
                <TimelineItem
                  key={`${entry.status}-${i}`}
                  entry={entry}
                  isLast={i === timeline.length - 1}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </MapPage>
  );
}
