import {
  ArrowLeft,
  CheckCircle2,
  Info,
  MapPinned,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useGeoLocation } from "../../shared/context/LocationProvider";
import MapViewer from "../../shared/components/MapViewer";
import { fetchRoadRoute } from "../../shared/utils/dispatch";
import { setResponderMeta } from "./responderMeta";

const cardClass = "rounded-[20px] border-2 border-slate-200 bg-white px-5 py-5";
const accidentSearchUrl =
  "https://www.google.com/maps/search/?api=1&query=accidents+near+Barangay+167%2C+Caloocan";
const routeIncident = {
  id: "GF-006",
  title: "Accident on Rizal Street",
  category: "incident",
  status: "ongoing",
  lat: 14.733586,
  lng: 121.013336,
};

export default function EmergencyRouting() {
  const { position, detect } = useGeoLocation();
  const [incidentStatus, setIncidentStatus] = useState("Pending verification");
  const [roadRoute, setRoadRoute] = useState(null);
  const [routeError, setRouteError] = useState(false);

  useEffect(() => {
    if (!position) {
      return undefined;
    }

    const controller = new AbortController();

    fetchRoadRoute(position, routeIncident, controller.signal)
      .then((route) => setRoadRoute({ ...route, origin: position }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error("Emergency route error:", error);
        setRouteError(true);
      });

    return () => controller.abort();
  }, [position]);

  const routeMatchesPosition =
    roadRoute?.origin?.lat === position?.lat &&
    roadRoute?.origin?.lng === position?.lng;
  const activeRoute = routeMatchesPosition ? roadRoute : null;

  useEffect(() => {
    setResponderMeta(
      "Emergency Route & Incident Tracking",
      "Track the active responder location, confirm the incident, and review the safest route to the scene.",
    );
    detect();
  }, [detect]);

  return (
    <div className="assignment-dashboard min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
        <div className="flex items-center gap-4">
          <Link to="/responder/route" aria-label="Go back" className="text-primary"><ArrowLeft size={38} strokeWidth={1.8} /></Link>
          <h1 className="text-[25px] font-bold text-primary">Emergency Routing</h1>
        </div>
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">R</span>
      </header>
      <main className="space-y-4 px-4 py-5 pb-8 sm:space-y-5 sm:px-7 sm:py-6">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Accident on Rizal Street</h2>
        <p className="text-base leading-6 text-slate-500">Department: Traffic/Road Response<br />GF-006 • Traffic/Road Response Team A</p>
        <section className="overflow-hidden rounded-[22px] border-2 border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <MapPinned className="text-primary" size={28} />
              <div>
                <h2 className="text-[20px] font-bold text-primary">Incident Map</h2>
                <p className="text-[15px] text-slate-500">Barangay 167, Caloocan</p>
              </div>
            </div>
          </div>
          <div className="relative h-[280px] bg-slate-100 sm:h-[330px]">
            <MapViewer compact showBackButton={false} expandPath={null}
              incidents={[routeIncident]} selectedIncident={routeIncident}
              trackers={position ? [{ id: "responder-location", ...position, color: "#0f766e" }] : []}
              routes={position ? [{ id: "responder-route", points: [
                ...(activeRoute?.points ?? [
                  { lat: position.lat, lng: position.lng },
                  { lat: routeIncident.lat, lng: routeIncident.lng },
                ]),
              ], color: "#0f766e", dashed: !activeRoute }] : []}
              highlightBoundary mapHeight="h-[280px] sm:h-[330px]" hideMapLabel />
          </div>
          <div className="flex items-start gap-3 border-t border-slate-200 px-5 py-4 text-[15px] leading-5 text-slate-500">
            <Info size={20} className="mt-0.5 shrink-0 text-primary" />
            <p>Confirm road conditions and incident details before dispatch.</p>
          </div>
          <a
            href={accidentSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="mx-5 mb-5 flex h-12 items-center justify-center rounded-xl border-2 border-primary text-base font-bold text-primary"
          >
            Open Incident Map
          </a>
        </section>
        <section className={`${cardClass} responder-verify-card`}>
          <div className="flex items-start gap-3">
            {incidentStatus === "Verified" ? <CheckCircle2 className="shrink-0 text-primary" size={22} /> : <ShieldCheck className="shrink-0 text-primary" size={22} />}
            <div>
              <h2 className="text-lg font-bold text-primary">Verify Incident</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">Confirm the incident when the team reaches the reported location.</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-[#e2f2eb] px-3 py-2 text-sm leading-5 text-primary">
            <b>{incidentStatus}</b>
            <br />
            Report GF-006 • Rizal Street, Barangay 167
          </div>
          {incidentStatus === "Verified" ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-bold text-primary"><CheckCircle2 size={18} /> Location confirmed by responder</p>
          ) : (
            <button type="button" onClick={() => setIncidentStatus("Verified")} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-white">
              <CheckCircle2 size={18} /> Confirm Incident Location
            </button>
          )}
        </section>
        <section className={cardClass}>
          <h2 className="text-[20px] font-bold text-primary sm:text-[22px]">Best Available Route</h2>
          <p className="mt-2 text-[30px] font-bold leading-tight text-primary sm:text-[32px]">
            {activeRoute ? `${Math.max(1, Math.round(activeRoute.durationMin))} min` : "8 min"}
            <span className="text-[17px] text-slate-800">
              {" "}• {activeRoute ? activeRoute.distanceKm.toFixed(1) : "2.1"} km
            </span>
          </p>
          <p className="mt-2 text-[16px] leading-6">From: Traffic/Road Response Team A<br />To: Confirmed GF-006 location</p>
          {routeError && (
            <p className="mt-2 text-sm text-amber-700">
              Live road routing is unavailable. Showing a direct route for guidance.
            </p>
          )}
        </section>
        <div className="flex gap-3 rounded-xl bg-[#fff1c8] px-4 py-3 text-[15px] leading-5 text-[#a66a00]"><TriangleAlert className="shrink-0" size={20} />Flooding reported on the direct approach. Avoid the marked segment; use the alternate approach to Rizal Street.</div>
        <div className="flex gap-3 rounded-xl bg-[#e2f2eb] px-4 py-3 text-[15px] leading-5 text-primary"><Info className="shrink-0" size={20} />Advisory route. Check road conditions before proceeding. Travel time may change.</div>
        <Link to="/responder/scene-assessment" className="flex h-14 w-full items-center justify-center rounded-xl bg-primary text-[16px] font-bold text-white">Update Response</Link>
      </main>
    </div>
  );
}
