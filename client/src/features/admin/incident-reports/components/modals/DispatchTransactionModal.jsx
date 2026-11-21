import { Radio } from "lucide-react";
import MapViewer from "../../../../../shared/components/MapViewer";
import { ModalSection, ModalShell, RowList } from "../../../../../shared/components/GovernanceUi";
import { FACILITY_PIN_CATEGORY, TANOD_BASE } from "../../constants";
import { facilityFor } from "../../utils";

function DispatchTransactionModal({ data, onClose, onTrack, onFieldOps }) {
  const { report, units, maintenance, transactionId, time } = data;
  return (
    <ModalShell title="Dispatch Transaction" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[820px]" backdrop="z-[90]" panel="z-[100]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Routing “{report.urgency}” → {report.routedTo}{maintenance ? " • maintenance" : " • external units requested in parallel under the same Incident ID"}.</span>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="gf-btn gf-btn--cancel">Done</button>
          <button type="button" disabled={maintenance} onClick={onTrack} className={`gf-btn gf-btn--primary ${maintenance ? "gf-btn--primary" : ""}`}>Track Unit Responses</button>
          {!maintenance && <button type="button" onClick={onFieldOps} className="gf-btn gf-btn--primary"><Radio size={10} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} />Responder Assignment</button>}
        </div>
      </footer>}>
      <div className="gf-modal-body">
        <ModalSection title="Transaction Summary">
          <RowList rows={[["Transaction ID", transactionId], ["Logged At", time], ["Routed Workflow", report.routedTo], ["Classification", report.urgency], ["Assigned Team", report.team], ["Status", report.status]]} />
        </ModalSection>
        {units.length > 0 && (
          <ModalSection title="Parallel External Dispatch">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {units.map((unit) => (
                <li key={unit.key} className="rounded-md border border-[#e0e7eb] px-2.5 py-2 text-[9px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 font-bold text-[#263246]">{unit.nearest && <span className="gf-badge gf-badge--fixed">Nearest</span>}{unit.confirmed} → {unit.station}</span>
                    <span className={`gf-badge ${unit.status === "Confirmed" ? "gf-badge--fixed" : "gf-badge--reported"}`}>{unit.status}</span>
                  </div>
                  <p className="mt-1 text-[#60738f]">Unit: {unit.unit} | {unit.km} km | ETA: {unit.eta} | Route: {report.location} → {unit.station} ({unit.via})</p>
                </li>
              ))}
            </ul>
          </ModalSection>
        )}
        <ModalSection title="Where Responses Are Heading">
          <div className="overflow-hidden rounded-lg border border-[#dfe7ea]">
            <div className="h-[280px]">
              <MapViewer compact incidents={[
                { id: report.id, title: report.title, category: report.category, status: report.status, lat: report.lat, lng: report.lng },
                ...units.map((unit) => { const facility = facilityFor(unit.key, report); return { id: `facility-${unit.key}`, title: facility.name, category: FACILITY_PIN_CATEGORY[unit.key], status: "Ready", lat: facility.lat, lng: facility.lng }; }),
                { id: "facility-hall", title: TANOD_BASE.name, category: FACILITY_PIN_CATEGORY.hall, status: "Ready", lat: TANOD_BASE.lat, lng: TANOD_BASE.lng },
              ]} selectedIncident={{ id: report.id, lat: report.lat, lng: report.lng }} />
            </div>
            <div className="px-3 py-2 text-[9px] font-medium text-[#60738f]">Pulsing pin = incident location{units.length ? ". Icons mark the dispatched units." : "."} Green icon = Tanod base for responder assignment.</div>
          </div>
        </ModalSection>
      </div>
    </ModalShell>
  );
}

export default DispatchTransactionModal;
