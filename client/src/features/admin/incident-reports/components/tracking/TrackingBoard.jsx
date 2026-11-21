import { useEffect, useMemo, useState } from "react";
import { MapPinned, QrCode, Radio, Siren, TriangleAlert } from "lucide-react";
import MapViewer from "../../../../../shared/components/MapViewer";
import { Badge, RowList } from "../../../../../shared/components/GovernanceUi";
import {
  FACILITY_PIN_CATEGORY, ROAD_CLOSURES, STAGE_TARGETS, STATUS_STYLES, TANODS, TANOD_BASE, VEHICLES,
} from "../../constants";
import { EMPTY_QUEUE_MESSAGES } from "../../queues";
import { facilityFor, pointAtFraction, routeBetween, routePoints } from "../../utils";
import StageTrack from "../StageTrack";

const hasCoords = (report) => Number.isFinite(report.lat) && Number.isFinite(report.lng);

function agencyKeyFromLabel(unit) {
  if (/police/i.test(unit)) return "police";
  if (/fire/i.test(unit)) return "fire";
  if (/hospital/i.test(unit)) return "hospital";
  return null;
}

const agencyKeysFor = (report) => [...new Set((report.external ?? []).map(agencyKeyFromLabel).filter(Boolean))];

function ResponderCard({ report, focused, onFocus }) {
  const tanod = TANODS.find((t) => t.id === report.responders?.tanod);
  const vehicle = VEHICLES.find((v) => v.id === report.responders?.vehicle);
  const waiting = report.external?.filter((unit) => (/: requested/i).test(unit)).length ?? 0;
  return (
    <button type="button" onClick={onFocus} aria-pressed={focused} className={`gf-option-card w-full text-left ${focused ? "gf-option-card--accent" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-[#263246]">
          <Radio size={12} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
          <span className="truncate">{report.id} — {report.title}</span>
        </span>
        <Badge label={report.fieldStage ?? "Assigned"} styles="gf-badge gf-badge--progress" />
      </div>
      <span className="mt-1 block text-[9px] text-[#60738f]">
        {tanod?.name ?? report.responders?.tanod} • {vehicle?.type ?? report.responders?.vehicle}
        {report.external?.length ? ` • ${report.external.length} external unit${report.external.length > 1 ? "s" : ""}${waiting ? ` (${waiting} awaiting confirmation)` : ""}` : ""}
        {!hasCoords(report) ? " • no GPS pin saved" : ""}
      </span>
    </button>
  );
}

function FocusedDetail({ report, onOpenFieldOps }) {
  const tanod = TANODS.find((t) => t.id === report.responders?.tanod);
  const vehicle = VEHICLES.find((v) => v.id === report.responders?.vehicle);
  const closures = agencyKeysFor(report).flatMap((key) => (ROAD_CLOSURES[key] ?? []).map((closure) => ({ key, ...closure })));
  return (
    <div className="gf-option-card gf-option-card--accent">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-[#263246]">{report.id} — {report.title}</span>
        <Badge label={report.status} styles={STATUS_STYLES[report.status]} />
      </div>
      <div className="mt-2">
        <RowList rows={[
          ["Assigned Tanod", `${tanod?.name ?? report.responders?.tanod} (${report.responders?.tanod})`],
          ["Vehicle", vehicle?.type ?? report.responders?.vehicle],
          ["Acceptance", report.responders?.accepted ? `Accepted • ${report.responders.accepted}` : "Awaiting acceptance"],
          ["Scene", report.location],
          ["Field Stage", report.fieldStage ?? "Assigned"],
          ["Privacy-scoped GPS", report.gpsEnded ? "Off — duty completed" : "On during response only"],
        ]} />
      </div>
      <div className="mt-2">
        <StageTrack stage={report.fieldStage ?? "Assigned"} />
      </div>
      {report.handover && (
        <div className="gf-note gf-note--soft mt-2">
          <QrCode size={13} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
          <span>Handover acknowledged by <strong>{report.handover.scannedBy}</strong> • {report.handover.at}</span>
        </div>
      )}
      {report.external?.length > 0 && (
        <div className="mt-2 grid gap-1">
          {report.external.map((unit) => {
            const awaiting = (/: requested/i).test(unit);
            return (
              <p key={unit} className="rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-2 py-1.5 text-[9px] font-medium text-[#60738f]" style={awaiting ? { borderColor: "#f0d9a8", background: "#fdf6e7" } : undefined}>
                <Siren size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4, color: awaiting ? "var(--gf-amber)" : "var(--gf-green)" }} />{unit}
              </p>
            );
          })}
        </div>
      )}
      {closures.length > 0 && (
        <div className="gf-note gf-note--warn mt-2">
          <TriangleAlert size={11} style={{ flexShrink: 0, color: "#b45309" }} />
          <span><strong>Possible Road Closures:</strong> {closures.map((closure) => `${closure.road} (${closure.section}) — ${closure.note}`).join(" • ")}</span>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" className="gf-btn gf-btn--primary" onClick={() => onOpenFieldOps(report.id)}>
          <Radio size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Open Field Ops & Controls
        </button>
      </div>
    </div>
  );
}

export default function TrackingBoard({ reports, onOpenFieldOps }) {
  const [focusedId, setFocusedId] = useState(null);
  const focused = reports.find((report) => report.id === focusedId) ?? reports[0] ?? null;

  /* Live responder dots ease along their routes toward each duty's current
     field-stage target; the dots advance as stages progress in Field Ops. */
  const targets = useMemo(() => Object.fromEntries(reports.map((report) => [report.id, STAGE_TARGETS[report.fieldStage ?? "Assigned"] ?? 0])), [reports]);
  const [fractions, setFractions] = useState({});
  useEffect(() => {
    const ticker = setInterval(() => {
      setFractions((current) => {
        let moved = false;
        const next = { ...current };
        for (const [id, target] of Object.entries(targets)) {
          const value = next[id] ?? 0;
          if (value < target) {
            next[id] = Math.min(target, value + 0.02);
            moved = true;
          }
        }
        return moved ? next : current;
      });
    }, 320);
    return () => clearInterval(ticker);
  }, [targets]);

  const mapIncidents = useMemo(() => {
    const pins = [];
    const seen = new Set();
    const push = (pin) => {
      if (!pin || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng) || seen.has(pin.id)) return;
      seen.add(pin.id);
      pins.push(pin);
    };
    reports.forEach((report) => {
      push({ id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng });
      report.external?.forEach((unit) => {
        const key = agencyKeyFromLabel(unit);
        if (!key) return;
        const facility = facilityFor(key, report);
        push({ id: `facility-${key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[key], status: "Ready", lat: facility.lat, lng: facility.lng });
      });
      if (report.medical?.transport) {
        const hospital = facilityFor("hospital", report);
        push({ id: "facility-hospital", title: hospital.name, category: FACILITY_PIN_CATEGORY.hospital, status: "Ready", lat: hospital.lat, lng: hospital.lng });
      }
      push({ id: "facility-hall", title: TANOD_BASE.name, category: FACILITY_PIN_CATEGORY.hall, status: "Ready", lat: TANOD_BASE.lat, lng: TANOD_BASE.lng });
    });
    return pins;
  }, [reports]);

  const routes = useMemo(() => reports.flatMap((report) => {
    if (!hasCoords(report)) return [];
    const paths = [{ id: `route-${report.id}-tanod`, points: routeBetween(TANOD_BASE, report) }];
    agencyKeysFor(report).forEach((key) => paths.push({ id: `route-${report.id}-${key}`, points: routePoints(key, report) }));
    return paths;
  }), [reports]);

  const trackers = useMemo(() => reports.flatMap((report) => {
    if (!hasCoords(report)) return [];
    const fraction = fractions[report.id] ?? 0;
    const dots = [{ id: `tracker-${report.id}-tanod`, category: "infrastructure", ...pointAtFraction(routeBetween(TANOD_BASE, report), fraction) }];
    agencyKeysFor(report).forEach((key) => dots.push({ id: `tracker-${report.id}-${key}`, category: key, ...pointAtFraction(routePoints(key, report), Math.min(1, fraction + 0.12)) }));
    return dots;
  }), [reports, fractions]);

  /* Green drop-off arrows only for patient transports — one per hospital. */
  const dropOffs = useMemo(() => {
    const seen = new Set();
    return reports.flatMap((report) => {
      if (!hasCoords(report) || !report.medical?.transport) return [];
      const hospital = facilityFor("hospital", report);
      const key = `${hospital.lat.toFixed(5)}|${hospital.lng.toFixed(5)}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id: `drop-${report.id}`, title: hospital.name, lat: hospital.lat, lng: hospital.lng }];
    });
  }, [reports]);

  return (
    <section className="rounded-lg border border-[#e2e8eb] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[12px] font-bold text-(--gf-green)">Monitor Dispatch & Tracking ({reports.length} ongoing)</h2>
        <span className="gf-badge gf-badge--guest">Live responder positions — privacy-scoped GPS</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
        <div className="relative h-[420px] sm:h-[460px]">
          <MapViewer compact mapHeight="h-full"
            incidents={mapIncidents}
            selectedIncident={focused && hasCoords(focused) ? { id: focused.id, lat: focused.lat, lng: focused.lng } : null}
            routes={routes} trackers={trackers} dropOffs={dropOffs} />
          {!reports.length && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 px-8 text-center text-[10px] font-bold text-[#60738f]">
              {EMPTY_QUEUE_MESSAGES["dispatch-tracking"]}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[9px] font-medium text-[#60738f]">
          <span>Amber badge = Tanod position • agency badges = police/fire/hospital units en route • dashed lines = station/base → scene routes • green arrow = patient drop-off.</span>
          <span>GPS sharing stops automatically the moment a duty reaches Completed.</span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-[9px] font-bold uppercase text-[#7184a0]">Ongoing responders ({reports.length})</p>
          {reports.length ? (
            <div className="grid gap-2">
              {reports.map((report) => (
                <ResponderCard key={report.id} report={report} focused={focused?.id === report.id} onFocus={() => setFocusedId(report.id)} />
              ))}
            </div>
          ) : (
            <div className="gf-note gf-note--soft">
              <Radio size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
              <span>Assign a Tanod + vehicle via <strong>Field Ops — Responder Assignment</strong> on any active emergency and it will be tracked here live.</span>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-[9px] font-bold uppercase text-[#7184a0]">Focused assignment details</p>
          {focused
            ? <FocusedDetail report={focused} onOpenFieldOps={onOpenFieldOps} />
            : <div className="gf-note gf-note--soft"><MapPinned size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} /><span>Nothing to monitor yet.</span></div>}
        </div>
      </div>
    </section>
  );
}
