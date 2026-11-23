import { Lock } from "lucide-react";
import { ModalShell } from "../../../../../shared/components/GovernanceUi";

function AuditTrailModal({ log, filter, onFilter, onClose }) {
  const entries = log.filter((entry) => filter === "All reports" || entry.reportId === filter);
  return (
    <ModalShell title="Comprehensive Audit Trail" subtitle="Report status history and admin activity" onClose={onClose} width="max-w-[780px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="flex items-center gap-1 text-[9px] text-[#7184a0]"><Lock size={10} />Report history</span>
        <button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Close</button>
      </footer>}>
      <div className="gf-modal-body">
        <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]" style={{ maxWidth: 260 }}>
          Filter
          <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={filter} onChange={(event) => onFilter(event.target.value)}>
            <option>All reports</option>
            {[...new Set(log.map((entry) => entry.reportId))].map((id) => <option key={id}>{id}</option>)}
          </select>
        </label>
        <div className="gf-audit">
          {entries.map((entry) => (
            <article key={entry.key} className="gf-audit-item">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="gf-badge gf-badge--duplicate">{entry.reportId}</span>
                  <strong className="text-[#263246]">{entry.action}</strong>
                  <span className="gf-badge gf-badge--guest">{entry.system ? "system" : "user"}</span>
                </span>
                <span className="gf-audit-time">{entry.at}</span>
              </div>
              <p className="mt-1">{entry.detail}</p>
            </article>
          ))}
          {!entries.length && <p className="py-6 text-center text-[10px] text-[#60738f]">No entries for this report yet.</p>}
        </div>
      </div>
    </ModalShell>
  );
}

export default AuditTrailModal;
