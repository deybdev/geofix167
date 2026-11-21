import { useEffect, useMemo, useState } from "react";
import { Ambulance, Bell, Siren, TriangleAlert, Wrench } from "lucide-react";
import MapViewer from "../../../../../shared/components/MapViewer";
import { ModalSection, ModalShell } from "../../../../../shared/components/GovernanceUi";
import { CAPABILITY_OPTS, EXTERNAL_AGENCIES, FACILITY_PIN_CATEGORY, HOSPITALS, RESPONSE_FACILITIES, ROUTES, TANOD_BASE, TEAM_OPTIONS, URGENCY_OPTS } from "../../constants";
import { facilityInfo, isEmergency, pointAtFraction, routeBetween, shortUrgency } from "../../utils";

function DispatchModal({ report, onClose, onDispatch, onTransaction, logAudit }) {
  const [classification, setClassification] = useState(report.urgency);
  const [routedTo, setRoutedTo] = useState(isEmergency(report) ? ROUTES[0][0] : ROUTES[1][0]);
  const [team, setTeam] = useState(isEmergency(report) ? "BDRRMO Response" : report.team);
  const [requests, setRequests] = useState({});
  const [capability, setCapability] = useState(report.medical?.capability ?? "Trauma");
  const [hospitalKey, setHospitalKey] = useState(null);
  const emergency = isEmergency(report);
  const maintenance = routedTo === ROUTES[1][0];
  const agencies = useMemo(() => Object.entries(EXTERNAL_AGENCIES).filter(([key]) => key !== "hospital" || !maintenance), [maintenance]);
  const matchingHospitals = useMemo(() => HOSPITALS.filter((h) => h.capabilities.includes(capability)), [capability]);
  const chosen = HOSPITALS.find((h) => h.key === hospitalKey);
  const chosenInfo = chosen ? facilityInfo("hospital", { ...report, dispatchHospital: hospitalKey }) : null;

  useEffect(() => {
    if (!agencies.some(([key]) => requests[key] === "requested")) return;
    const timer = setTimeout(() => setRequests((current) => Object.fromEntries(
      agencies.map(([key, agency]) => [key, current[key] === "requested" ? { unit: agency.unit, eta: agency.eta } : current[key]]),
    )), 1600);
    return () => clearTimeout(timer);
  }, [requests, agencies]);

  function confirm() {
    const units = agencies
      .flatMap(([key, agency]) => {
        const state = requests[key];
        if (!state) return [];
        const info = facilityInfo(key, report);
        return [{ key, confirmed: agency.confirmed, station: info.name, via: info.via, km: info.km, unit: state.unit ?? "—", eta: state.eta ?? info.eta, status: state === "requested" ? "Requested" : "Confirmed" }];
      })
      .sort((a, b) => a.km - b.km)
      .map((unit, index) => ({ ...unit, nearest: index === 0 }));
    const external = units.map((unit) => unit.status === "Confirmed" ? `${unit.confirmed}: Confirmed • Unit: ${unit.unit} • ETA: ${unit.eta}` : `${unit.confirmed}: Requested`);
    const medical = emergency && report.medical
      ? chosen
        ? { ...report.medical, capability, hospital: chosen.name, route: `${report.location} → ${chosen.name} (${chosenInfo.via})` }
        : report.medical
      : report.medical;
    const changes = {
      urgency: classification,
      routedTo,
      team: maintenance ? team : "BDRRMO Response",
      emergencyVerified: !emergency ? undefined : (report.emergencyVerified ?? true),
      status: "In Progress",
      dispatchHospital: chosen ? hospitalKey : report.dispatchHospital,
      external: [...report.external ?? [], ...external],
      medical,
    };
    logAudit({ reportId: report.id, actor: "Admin", action: "Triage & dispatch", detail: `Classified “${classification}” → ${routedTo}${chosen ? ` • hospital routing to ${chosen.name} (capability: ${capability})` : ""}.` });
    onDispatch(report.id, changes);
    onClose();
    onTransaction({ ...report, ...changes }, units, maintenance);
  }

  return (
    <ModalShell title="Triage, Classification & Dispatch" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[980px]"
      footer={<footer className="gf-modal-foot"><button type="button" onClick={onClose} className="gf-btn gf-btn--cancel">Cancel</button><button type="button" onClick={confirm} className="gf-btn gf-btn--primary">Confirm Dispatch</button></footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Urgency Classification">
          <div className="grid grid-cols-3 gap-2">
            {URGENCY_OPTS.map((option) => (
              <button key={option} type="button" aria-pressed={classification === option} onClick={() => { setClassification(option); setRoutedTo(option === "Non-Emergency Infrastructure" ? ROUTES[1][0] : ROUTES[0][0]); }}
                className={`gf-option ${classification === option ? "gf-option--active" : ""}`}>
                {option === "Critical Emergency" ? <Siren size={13} /> : option === "Standard Emergency" ? <Bell size={13} /> : <Wrench size={13} />}
                <span>{shortUrgency(option)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] text-[#7184a0]">Critical & standard emergencies route to BDRRMO; non-emergency infrastructure stays with internal maintenance teams.</p>
        </ModalSection>

        <ModalSection title="Workflow Routing">
          <div className="grid grid-cols-2 gap-2">
            {ROUTES.map(([route, Icon]) => (
              <button key={route} type="button" aria-pressed={routedTo === route} onClick={() => setRoutedTo(route)}
                className={`gf-option ${routedTo === route ? "gf-option--active" : ""}`}>
                <Icon size={14} /> {route}
              </button>
            ))}
          </div>
        </ModalSection>

        {!maintenance && emergency && report.medical && (
          <ModalSection title="Hospital Capability Routing">
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Required treatment capability
              <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={capability} onChange={(event) => { setCapability(event.target.value); setHospitalKey(null); }}>
                {CAPABILITY_OPTS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <ul className="mt-2 grid gap-1.5">
              {matchingHospitals.map((hospital) => {
                const info = facilityInfo("hospital", { ...report, dispatchHospital: hospital.key });
                return (
                  <li key={hospital.key} className={`gf-option-card ${hospitalKey === hospital.key ? "gf-option-card--accent" : ""}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-[#263246]"><Ambulance size={13} style={{ color: "var(--gf-green)" }} />{hospital.name}</span>
                      <button type="button" className={`gf-btn gf-btn--tiny ${hospitalKey === hospital.key ? "gf-btn--tiny--solid" : "gf-btn--tiny--outline"}`} onClick={() => setHospitalKey(hospital.key)}>
                        {hospitalKey === hospital.key ? "Routed ✓" : "Route here"}
                      </button>
                    </div>
                    <p className="mt-1 text-[#60738f]">Capabilities: {hospital.capabilities.join(" • ")} | {info.km} km • ETA ~{info.eta} via {hospital.via}</p>
                  </li>
                );
              })}
              {!matchingHospitals.length && <li className="gf-note gf-note--warn"><TriangleAlert size={13} style={{ flexShrink: 0 }} />No nearby facility lists this capability — dispatch the closest one and request capability matching via the QR handover.</li>}
            </ul>
            <div className="mt-2 overflow-hidden rounded-lg border border-[#dfe7ea]">
              <div className="h-[240px]">
                <MapViewer compact
                  incidents={[
                    { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                    ...HOSPITALS.map((hospital) => ({ id: `facility-${hospital.key}`, title: hospital.name, category: "incident", status: "Ready", lat: hospital.lat, lng: hospital.lng })),
                  ]}
                  selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }}
                  routes={chosen ? [{ id: "hospital-route", points: routeBetween(chosen, report) }] : []}
                  trackers={chosen ? [{ id: "hospital-track", category: "incident", ...pointAtFraction(routeBetween(chosen, report), 0.5) }] : []}
                  dropOffs={chosen ? [{ id: "hospital-drop", title: chosen.name, lat: chosen.lat, lng: chosen.lng }] : []} />
              </div>
              <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">
                {chosen ? `Scene → ${chosen.name}: ${chosenInfo.km} km • ~${chosenInfo.eta} via ${chosenInfo.via}. Green arrow pin marks the receiving hospital.` : "Select a capability-filtered hospital to preview the route from the scene."}
              </div>
            </div>
          </ModalSection>
        )}

        {!maintenance && (
          <ModalSection title="Nearest Response Facilities">
            <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
              <div className="h-[240px]">
                <MapViewer compact incidents={[
                  { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                  ...Object.entries(RESPONSE_FACILITIES).map(([key, facility]) => ({ id: `facility-${key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[key], status: "Ready", lat: facility.lat, lng: facility.lng })),
                  { id: "facility-hall", title: TANOD_BASE.name, category: FACILITY_PIN_CATEGORY.hall, status: "Ready", lat: TANOD_BASE.lat, lng: TANOD_BASE.lng },
                ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} />
              </div>
              <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Pulsing pin = incident location. Station icons mark requestable units and the Tanod base.</div>
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {["police", "fire"].map((key) => {
                const info = facilityInfo(key, report);
                return (
                  <li key={key} className="flex items-center justify-between gap-2 rounded-md border border-[#e0e7eb] px-2.5 py-2 text-[9px]">
                    <span className="flex min-w-0 items-center gap-2 font-bold text-[#263246]">{info.name}</span>
                    <span className="shrink-0 font-medium text-[#60738f]">{info.km} km • ETA ~{info.eta} via {info.via}</span>
                  </li>
                );
              })}
            </ul>
          </ModalSection>
        )}

        <ModalSection title={maintenance ? "Assigned Maintenance Team" : "Parallel Multi-Agency Dispatch"}>
          {maintenance ? (
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Assigned Team
              <select className="gf-select" style={{ color: "#42506a", height: 36 }} value={team} onChange={(event) => setTeam(event.target.value)}>
                {TEAM_OPTIONS.slice(1).map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {["police", "fire", "hospital"].map((key) => {
                const agency = EXTERNAL_AGENCIES[key];
                const state = requests[key];
                return (
                  <div key={key} className="gf-option-card">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-[10px] font-bold text-[#263246]"><agency.icon size={13} style={{ color: "var(--gf-green)" }} /> {agency.label}</span>
                      <button type="button" disabled={Boolean(state)} onClick={() => setRequests((r) => ({ ...r, [key]: "requested" }))}
                        className={`gf-btn gf-btn--tiny ${state ? "gf-btn--tiny--outline" : "gf-btn--tiny--outline"}`} style={state ? { color: "#a0b0c0" } : undefined}>
                        {state ? "Requested ✓" : "Request"}
                      </button>
                    </div>
                    <p className="mt-2 text-[9px] text-[#60738f]" aria-live="polite">
                      {!state && "No external unit requested."}
                      {state === "requested" && <span style={{ color: "var(--gf-amber)" }}>{agency.confirmed}: Requested — awaiting confirmation…</span>}
                      {state && state !== "requested" && <span style={{ color: "var(--gf-green)" }}>{agency.confirmed}: Confirmed | Unit: {state.unit} | ETA: {state.eta}</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </ModalSection>
      </div>
    </ModalShell>
  );
}

export default DispatchModal;
