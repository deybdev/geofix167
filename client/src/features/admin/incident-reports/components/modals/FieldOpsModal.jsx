import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Lock, QrCode, ScanLine, UserCheck } from "lucide-react";
import MapViewer from "../../../../../shared/components/MapViewer";
import { ModalSection, ModalShell, QRMatrix, hash32, stamp } from "../../../../../shared/components/GovernanceUi";
import { toast } from "../../../../../shared/components/ui/toast";
import { FACILITY_PIN_CATEGORY, FIELD_STAGES, STAGE_TARGETS, TANODS, TANOD_BASE, VEHICLES } from "../../constants";
import { facilityFor, pointAtFraction, routeBetween } from "../../utils";
import StageTrack from "../StageTrack";

function FieldOpsModal({ report, onClose, onAssign, onAccepted, onStage, onHandover, logAudit }) {
  const [tanod, setTanod] = useState(report.responders?.tanod ?? null);
  const [vehicle, setVehicle] = useState(report.responders?.vehicle ?? null);
  const [sent, setSent] = useState(Boolean(report.responders));
  const [showQr, setShowQr] = useState(false);
  const stageIndex = FIELD_STAGES.indexOf(report.fieldStage ?? (sent ? "Assigned" : null));
  const activeStage = stageIndex >= 0 ? FIELD_STAGES[stageIndex] : null;
  const scanRef = useRef(null);
  const qrToken = useMemo(() => `HV-${report.id.replace("GF-", "")}-${String(9700 + Math.floor((hash32(`${report.id}:${report.handover?.at ?? "pending"}`)() % 300)))}`, [report.id, report.handover?.at]);
  const roster = useMemo(() => report.responders ?? {}, [report.responders]);
  const tracking = Boolean(sent) && activeStage !== "Completed" && !report.gpsEnded;

  useEffect(() => {
    if (!sent || roster.accepted) return;
    const timer = setTimeout(() => onAccepted(report.id, stamp(true)), 1800);
    return () => clearTimeout(timer);
  }, [sent, roster.accepted, onAccepted, report.id]);

  /* Simulated position drifting along the Tanod route: barangay hall → scene. */
  const [fraction, setFraction] = useState(0);
  useEffect(() => {
    if (!tracking) return;
    const target = STAGE_TARGETS[activeStage ?? "Assigned"];
    const ticker = setInterval(() => setFraction((current) => (current >= target ? target : Math.min(target, current + 0.02))), 320);
    return () => clearInterval(ticker);
  }, [tracking, activeStage]);

  const route = useMemo(() => routeBetween(TANOD_BASE, report), [report]);
  const position = useMemo(() => pointAtFraction(route, tracking ? fraction : 1), [route, fraction, tracking]);

  function assign() {
    if (!tanod || !vehicle) return;
    setSent(true);
    onAssign(report.id, { tanod, vehicle });
  }

  function advance(stage) {
    onStage(report.id, stage);
  }

  function scanQr() {
    setShowQr(true);
    const hospital = report.medical?.transport ? (facilityFor("hospital", report)) : null;
    const scanner = hospital ? `${hospital.name} — ER Desk` : "Receiving agency desk";
    logAudit({ reportId: report.id, actor: scanner, action: "QR handover scanned", detail: `${scanner} scanned the dynamic handover code ${qrToken} and formally acknowledged receipt.` });
    toast.add({ type: "success", title: "Handover acknowledged", description: `${scanner} scanned ${qrToken}. Receipt recorded in the audit trail.` });
    onHandover(report.id, { scannedBy: scanner, at: stamp(true), token: qrToken });
    clearTimeout(scanRef.current);
  }

  function generateQr() {
    logAudit({ reportId: report.id, actor: "Field Tanod", action: "Dynamic QR generated", detail: `On-scene handover code ${qrToken} generated at the incident.` });
    setShowQr(true);
  }

  const mapIncidents = [
    { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
    { id: "facility-hall", title: TANOD_BASE.name, category: FACILITY_PIN_CATEGORY.hall, status: "Ready", lat: TANOD_BASE.lat, lng: TANOD_BASE.lng },
  ];
  if (report.medical?.transport) {
    const hospital = facilityFor("hospital", report);
    mapIncidents.push({ id: "facility-hospital", title: hospital.name, category: FACILITY_PIN_CATEGORY.hospital, status: "Ready", lat: hospital.lat, lng: hospital.lng });
  }

  return (
    <ModalShell title="Field Operations & Live Tracking" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[1020px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Tanod GPS is privacy-scoped: shared only while the response is active and cut off automatically when the field stage reaches <strong>Completed</strong>.</span>
        <button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Done</button>
      </footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Responder Assignment">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Available Tanod
              <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={tanod ?? ""} disabled={sent} onChange={(event) => setTanod(event.target.value)}>
                <option value="">— select —</option>
                {TANODS.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.status}) — {t.beat}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Vehicle
              <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={vehicle ?? ""} disabled={sent} onChange={(event) => setVehicle(event.target.value)}>
                <option value="">— select —</option>
                {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.type} ({v.id} • {v.status})</option>)}
              </select>
            </label>
            <div className="grid items-end">
              {sent
                ? <div className="gf-note gf-note--soft" style={{ padding: "0.5rem 0.75rem" }}>
                  <UserCheck size={13} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
                  <span>{roster.accepted ? <>Tanod accepted the assignment<br />{roster.accepted}</> : "Assignment sent — awaiting acceptance…"}</span>
                </div>
                : <button type="button" disabled={!tanod || !vehicle} className="gf-btn gf-btn--primary" onClick={assign}>Send Assignment & Track</button>}
            </div>
          </div>
        </ModalSection>

        <ModalSection title="Status Progression (En Route → On Scene → Handover → Completed)">
          <StageTrack stage={activeStage} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FIELD_STAGES.slice(1).map((stage) => {
              const next = stageIndex >= 0 ? FIELD_STAGES[stageIndex + 1] : null;
              const handoverGate = stage === "Handover" && report.medical?.transport !== false && !report.handover && stageIndex === FIELD_STAGES.indexOf("On Scene");
              const disabled = stage !== next || (stage === "Handover" && handoverGate && !showQr)
                || (stage === "Handover" && report.medical?.transport && !report.handover && report.fieldStage === "On Scene");
              return (
                <button key={stage} type="button" onClick={() => advance(stage)} disabled={disabled || !sent}
                  className={`gf-btn gf-btn--tiny ${stage === next ? "gf-btn--tiny--solid" : "gf-btn--tiny--outline"}`}>
                  {stage}{handoverGate && stage === "Handover" ? " (QR needed)" : ""}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[9px] text-[#7184a0]">If this is a patient transport, the Handover step stays locked until the hospital (or receiving agency) scans the dynamic QR code below.</p>
        </ModalSection>

        {report.handover && (
          <div className="gf-note gf-note--soft">
            <QrCode size={14} style={{ flexShrink: 0, color: "var(--gf-green)" }} />
            <span><strong>Handover acknowledged:</strong> {report.handover.scannedBy} • {report.handover.at} • code {report.handover.token}</span>
          </div>
        )}

        {sent && (stageIndex >= FIELD_STAGES.indexOf("On Scene") || showQr) && !report.gpsEnded && (
          <ModalSection title="QR-Based Handover">
            <div className="flex flex-wrap items-start gap-4">
              {showQr && (
                <div className="gf-qr">
                  <QRMatrix seed={qrToken} />
                </div>
              )}
              <div className="min-w-[220px] flex-1">
                {!showQr
                  ? <><p className="text-[10px] font-bold text-[#263246]">Generate the dynamic handover code</p>
                    <p className="mt-1 text-[9px] text-[#60738f]">On-scene Tanod generates the code; the hospital or external agency scans it to formally acknowledge receipt of the patient/case.</p>
                    <button type="button" className="gf-btn gf-btn--primary mt-2" onClick={generateQr}><QrCode size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Generate handover QR</button></>
                  : <>
                    <p className="text-[10px] font-bold text-[#263246]">Code {qrToken}</p>
                    <p className="mt-1 text-[9px] text-[#60738f]">Single-response validity • rotates per incident. Hospital/agency FOH desk: “Scan code {qrToken}”.</p>
                    <div className="mt-2 flex gap-1.5">
                      {!report.handover && <button type="button" className="gf-btn gf-btn--primary" onClick={scanQr}><ScanLine size={11} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Simulate hospital scan</button>}
                      {report.handover && <span className="gf-badge gf-badge--fixed"><CheckCircle2 size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />Scanned & acknowledged</span>}
                    </div>
                  </>}
              </div>
            </div>
          </ModalSection>
        )}

        <ModalSection title="Privacy-Scoped Live Tracking">
          {tracking && activeStage && activeStage !== "On Scene" && activeStage !== "Handover" ? null : null}
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="relative h-[300px]">
              <MapViewer compact incidents={mapIncidents} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }}
                routes={sent ? [{ id: "tanod-route", points: route }] : []}
                trackers={tracking ? [{ id: "tanod-live", category: "infrastructure", ...position }] : []} />
              {!sent && <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/70 text-[10px] font-bold text-[#60738f]">Assign a responder to begin privacy-scoped tracking</div>}
              {(report.gpsEnded || report.fieldStage === "Completed" || activeStage === "Completed") && (
                <div className="absolute inset-x-0 bottom-0 z-[500] flex items-center justify-center gap-2 bg-(--gf-green-soft) px-3 py-2 text-[9px] font-bold text-(--gf-green)">
                  <Lock size={11} />Live GPS sharing automatically turned off — duty completed.
                </div>
              )}
            </div>
            <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Dashed line = Tanod route from the barangay hall; the amber icon is the live responder position. Location feed stops the moment the duty completes.</div>
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

export default FieldOpsModal;
