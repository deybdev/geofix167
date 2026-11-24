import ReportCategories from "../shared/components/ReportCategories";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import { ArrowLeft, Check, Clock3, Copy, Share2, ShieldAlert } from "lucide-react";
import L from "leaflet";
import { PATHS } from "../router/paths";
import PublicLoader from "../shared/components/PublicLoader";
import "leaflet/dist/leaflet.css";

const EXPIRED_MESSAGE = "This incident has been resolved. This tracking link has expired.";
const WAITING_MESSAGE = "Your report is being reviewed. A responder will be assigned soon.";

function FitTrackingLocations({ incident, responder }) {
  const map = useMap();
  const incidentLat = incident?.lat;
  const incidentLng = incident?.lng;
  const responderLat = responder?.lat;
  const responderLng = responder?.lng;
  useEffect(() => {
    const points = [];
    if (Number.isFinite(incidentLat) && Number.isFinite(incidentLng)) points.push([incidentLat, incidentLng]);
    if (Number.isFinite(responderLat) && Number.isFinite(responderLng)) points.push([responderLat, responderLng]);
    if (points.length === 1) map.setView(points[0], 16, { animate: false });
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16, animate: false });
  }, [map, incidentLat, incidentLng, responderLat, responderLng]);
  return null;
}

function timeAgo(dateValue, now) {
  if (!dateValue) return "Waiting for location";
  const seconds = Math.max(0, Math.floor((now - Date.parse(dateValue)) / 1000));
  return `${seconds}s ago`;
}

function formatTimestamp(value) {
  if (!value) return "Waiting";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recorded" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function PublicTrackingPage() {
  const { token = "" } = useParams();
  const [data, setData] = useState(null);
  const [problem, setProblem] = useState("");
  const [now, setNow] = useState(0);
  const [copied, setCopied] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const shareUrl = useMemo(() => window.location.href, []);

  const loadStatus = useCallback(async (signal) => {
    if (document.visibilityState !== "visible") return;
    try {
      const response = await fetch(`/api/track/${encodeURIComponent(token)}/status`, {
        cache: "no-store",
        signal,
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => null);
      if (response.status === 410) {
        setProblem(EXPIRED_MESSAGE);
        setData(null);
        return;
      }
      if (response.status === 404) {
        setProblem("This tracking link is invalid or no longer available.");
        setData(null);
        return;
      }
      if (!response.ok || !result) throw new Error("Tracking is temporarily unavailable.");
      setProblem("");
      setData(result);
    } catch (error) {
      if (error?.name !== "AbortError") setProblem((current) => current || "Tracking is temporarily unavailable. Please try again shortly.");
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => { void loadStatus(controller.signal); }, 0);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadStatus(controller.signal);
    }, 5000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const onVisibility = () => { if (document.visibilityState === "visible") void loadStatus(controller.signal); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      window.clearTimeout(initialLoad);
      window.clearInterval(poll);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadStatus]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setProblem("Copy is unavailable in this browser. You can copy the page address from the address bar.");
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "GeoFix 167 incident tracking", url: shareUrl }); }
      catch (error) { if (error?.name !== "AbortError") await copyLink(); }
    } else await copyLink();
  };

  const incident = data?.incident_location ?? null;
  const responderPosition = data?.responder_location ?? null;
  const incLat = incident?.lat;
  const incLng = incident?.lng;
  const respLat = responderPosition?.lat;
  const respLng = responderPosition?.lng;

  useEffect(() => {
    if (!Number.isFinite(incLat) || !Number.isFinite(incLng) || !Number.isFinite(respLat) || !Number.isFinite(respLng)) {
      return;
    }
    const fallback = [[respLat, respLng], [incLat, incLng]];
    const controller = new AbortController();
    fetch(`https://router.project-osrm.org/route/v1/driving/${respLng},${respLat};${incLng},${incLat}?overview=full&geometries=geojson`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const coords = json?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length > 1) {
          setRouteCoords(coords.map(([lng, lat]) => [lat, lng]));
        } else {
          setRouteCoords(fallback);
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setRouteCoords(fallback);
      });
    return () => controller.abort();
  }, [incLat, incLng, respLat, respLng]);

  if (problem && !data) {
    const isClosed = problem === EXPIRED_MESSAGE;
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f4f8f5] px-5 py-10 text-[#122033]">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl">
          <span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${isClosed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {isClosed ? <Check size={23} /> : <ShieldAlert size={23} />}
          </span>
          <h1 className="mt-4 text-xl font-extrabold">{isClosed ? "Tracking complete" : "Tracking unavailable"}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{problem}</p>
          {!isClosed && <button type="button" onClick={() => { setProblem(""); void loadStatus(); }} className="mt-5 rounded-xl bg-[#1f7a4d] px-5 py-2.5 text-sm font-bold text-white">Try again</button>}
          <Link to={PATHS.home} className="mx-auto mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            <ArrowLeft size={15} /> Back to GeoFix home
          </Link>
          <p className="mt-6 text-xs text-slate-400">GeoFix 167 · Barangay 167, Caloocan City</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return <main className="grid min-h-dvh place-items-center bg-[#f6f3ea] px-5"><PublicLoader label="Loading incident tracking…" /></main>;
  }

  const isStale = responderPosition && now - Date.parse(responderPosition.updated_at) > 60_000;
  const pending = !data.responder;
  const routePath = incident && responderPosition
    ? (routeCoords.length > 1 ? routeCoords : [[responderPosition.lat, responderPosition.lng], [incident.lat, incident.lng]])
    : [];

  return (
    <main className="min-h-dvh bg-[#f4f8f5] px-4 py-5 text-[#122033] sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">GeoFix 167 · Live incident updates</p>
            <h1 className="mt-1 text-xl font-extrabold">Responder tracking</h1><ReportCategories report={data} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={PATHS.home} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
              <ArrowLeft size={15} /> Back to GeoFix home
            </Link>
            <button type="button" onClick={shareLink} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100">
              {copied ? <Check size={16} /> : navigator.share ? <Share2 size={16} /> : <Copy size={16} />}{copied ? "Copied" : navigator.share ? "Share" : "Copy link"}
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current status</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-800">{data.status_label}</p>
            </div>
            {data.eta_minutes != null && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Approx. ETA</p>
              <p className="text-lg font-extrabold text-emerald-900">{data.eta_minutes} min</p>
            </div>}
          </div>

          {incident && <div className="mt-4 h-[300px] overflow-hidden rounded-xl border border-slate-200 sm:h-[390px]">
            <MapContainer center={[incident.lat, incident.lng]} zoom={15} scrollWheelZoom className="h-full w-full" zoomControl>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitTrackingLocations incident={incident} responder={responderPosition} />
              {routePath.length > 1 && <Polyline positions={routePath} pathOptions={{ color: "#16834a", weight: 5, opacity: 0.85 }} />}
              <CircleMarker center={[incident.lat, incident.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#dc2626", fillOpacity: 1 }} />
              {Array.isArray(data.responders) && data.responders.some((u) => u.location)
                ? data.responders
                    .filter((u) => u.location)
                    .map((u, idx) => (
                      <CircleMarker
                        key={`${u.role}-${idx}`}
                        center={[u.location.lat, u.location.lng]}
                        radius={9}
                        pathOptions={{
                          color: "#fff",
                          weight: 3,
                          fillColor: u.role === "fire" ? "#ea580c" : u.role === "police" ? "#2563eb" : "#16834a",
                          fillOpacity: 1,
                        }}
                      />
                    ))
                : responderPosition && <CircleMarker center={[responderPosition.lat, responderPosition.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#16834a", fillOpacity: 1 }} />}
            </MapContainer>
          </div>}

          {pending && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{WAITING_MESSAGE}</p>}
          {data.responder && <div className="mt-4 space-y-2 rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-xs font-semibold text-slate-500">Responding Unit(s)</p><p className="font-bold">{data.responder.first_name} <span className="font-normal text-slate-500">· {data.responder.unit_name}</span></p></div>
              <div className="text-right text-xs text-slate-500">
                <p><Clock3 className="mr-1 inline" size={13} />Last updated {timeAgo(responderPosition?.updated_at, now)}</p>
                {isStale && <p className="mt-1 font-semibold text-amber-700">Location may be out of date.</p>}
              </div>
            </div>
            {Array.isArray(data.responders) && data.responders.length > 1 && (
              <div className="flex flex-wrap gap-1.5 border-t border-slate-200/80 pt-2">
                {data.responders.map((u, idx) => (
                  <span key={`${u.role}-${idx}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: u.role === "fire" ? "#ea580c" : u.role === "police" ? "#2563eb" : "#16834a" }} />
                    {u.unit_name} ({u.status.replaceAll("_", " ")})
                  </span>
                ))}
              </div>
            )}
          </div>}
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-extrabold">Incident timeline</h2>
          <ol className="mt-4 space-y-0">
            {(data.timeline ?? []).map((event, index) => (
              <li key={event.label} className="relative flex gap-3 pb-4 last:pb-0">
                {index < data.timeline.length - 1 && <span aria-hidden="true" className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />}
                <span className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-[3px] ${event.at ? "border-emerald-600 bg-white" : "border-slate-200 bg-white"}`} />
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`block text-sm ${event.at ? "font-semibold text-slate-800" : "text-slate-400"}`}>{event.label}</span>
                    {event.label === "Forwarded to BDRRMO" && (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        BDRRMO will verify and assign a responder.
                      </span>
                    )}
                  </div>
                  <time className="shrink-0 text-right text-[11px] text-slate-500">{formatTimestamp(event.at)}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <footer className="px-2 py-5 text-center text-xs text-slate-500">Anyone with this link can see your responder&apos;s live location until the incident is resolved.</footer>
      </div>
    </main>
  );
}
