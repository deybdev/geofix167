import { Ban, Clock, ShieldCheck } from "lucide-react";
import { ModalShell } from "../../../../../shared/components/GovernanceUi";
import { STRIKE_STEPS } from "../../constants";

function StrikeModal({ report, strikes, onClose, onStrike }) {
  const count = strikes[report.reporter]?.count ?? 0;
  const next = count < STRIKE_STEPS.length ? STRIKE_STEPS[count] : null;
  return (
    <ModalShell title="False Report Discipline (Progressive Strikes)" subtitle={`${report.id} • reporter ${report.reporter}`} onClose={onClose} width="max-w-[520px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Strikes apply to the reporter, never to the incident itself.</span>
        <button type="button" disabled={!next} onClick={() => onStrike(report.id)} className="gf-btn gf-btn--primary">{next ? `Record strike ${count + 1}` : "Max reached"}</button>
      </footer>}>
      <div className="gf-modal-body">
        <p className="text-[9px] text-[#60738f]">Progressive schedule for this reporter:</p>
        <ol className="mt-1 grid gap-1.5">
          {STRIKE_STEPS.map((step, index) => (
            <li key={step} className={`gf-option-card ${index < count ? "gf-option-card--accent" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[10px] font-bold text-[#263246]">
                  {index === 0 ? <ShieldCheck size={13} style={{ color: "var(--gf-green)" }} /> : index === 1 ? <Clock size={13} style={{ color: "var(--gf-amber)" }} /> : <Ban size={13} style={{ color: "var(--gf-red)" }} />}
                  {step}
                </span>
                <span className={`gf-badge ${index < count ? "gf-badge--fixed" : "gf-badge--duplicate"}`}>{index < count ? "Served" : "Next"}</span>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[9px] text-[#7184a0]">Current: {count === 0 ? "no strikes" : `${count} strike${count > 1 ? "s" : ""} on record`}{strikes[report.reporter]?.until ? ` • restricted until ${strikes[report.reporter].until}` : ""}.</p>
      </div>
    </ModalShell>
  );
}

export default StrikeModal;
