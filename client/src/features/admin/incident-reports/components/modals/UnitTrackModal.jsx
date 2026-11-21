import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import MapViewer from "../../../../../shared/components/MapViewer";
import { ModalSection, ModalShell } from "../../../../../shared/components/GovernanceUi";
import { FACILITY_PIN_CATEGORY, ROAD_CLOSURES, STAGE_PROGRESS, TRACK_STAGES } from "../../constants";
import { facilityFor, pointAtFraction, routePoints } from "../../utils";

function UnitTrackModal({ units, report, onClose }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= TRACK_STAGES.length - 1) return;
    const timer = setTimeout(() => setStage((current) => current + 1), 1400);
    return () => clearTimeout(timer);
  }, [stage]);

  const routes = useMemo(() => units.map((unit) => ({ id: `route-${unit.key}`, key: unit.key, points: routePoints(unit.key, report) })), [units, report]);
  const trackers = useMemo(() => routes.map((route) => ({
    id: `tracker-${route.key}`, category: route.key, ...pointAtFraction(route.points, STAGE_PROGRESS[stage]),
  })), [routes, stage]);

  const dropOffs = useMemo(() => {
    const seen = new Set();
    return units.map((unit) => {
      const point = report.accident && unit.key === "hospital" ? facilityFor("hospital", report) : { lat: report.lat, lng: report.lng };
      return { id: `dropoff-${unit.key}`, title: facilityFor("hospital", report).name, ...point };
    }).filter((drop) => {
      const key = `${drop.lat.toFixed(5)}|${drop.lng.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [units, report]);

  return (
    <ModalShell title="Track Unit Responses" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[1000px]" backdrop="z-[105]" panel="z-[110]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className={`text-[9px] font-bold ${stage === 2 ? "text-(--gf-green)" : "text-[#e69500]"}`} aria-live="polite">{stage === 2 ? "All units are on site." : `Live update: ${TRACK_STAGES[stage]}…`}</span>
        <button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Done</button>
      </footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Live Responder Routes">
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[300px]">
              <MapViewer compact incidents={[
                { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                ...routes.map((route) => { const facility = facilityFor(route.key, report); return { id: `facility-${route.key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[route.key], status: "Ready", lat: facility.lat, lng: facility.lng }; }),
              ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} routes={routes} trackers={trackers} dropOffs={dropOffs} />
            </div>
            <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Dashed lines are station → scene routes; moving agency icons are responding units en route; the green arrow pin marks the drop-off.</div>
          </div>
        </ModalSection>
        <ModalSection title="Unit Tracking & Road Status">
          <div className="grid gap-2 sm:grid-cols-2">
            {units.map((unit) => (
              <div key={unit.key} className={`gf-option-card ${stage === 2 ? "gf-option-card--accent" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] font-bold text-[#263246]">{unit.nearest && <span className="gf-badge gf-badge--fixed">Nearest</span>}{unit.confirmed} — {unit.station}</span>
                  <span className={`gf-badge ${stage === 2 ? "gf-badge--fixed" : "gf-badge--reported"}`}>{TRACK_STAGES[stage]}</span>
                </div>
                <p className="mt-1 text-[9px] text-[#60738f]">Unit: {unit.unit} | Distance: {unit.km} km | ETA: {unit.eta} | Route: {report.location} → {unit.station} via {unit.via}</p>
                <div className="gf-note gf-note--warn mt-2">
                  <TriangleAlert size={11} style={{ flexShrink: 0, color: "#b45309" }} />
                  <span>
                    <strong>Possible Road Closures:</strong>{" "}
                    {(ROAD_CLOSURES[unit.key] ?? []).map((closure) => `${closure.road} (${closure.section}) — ${closure.note}`).join(" • ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

export default UnitTrackModal;
