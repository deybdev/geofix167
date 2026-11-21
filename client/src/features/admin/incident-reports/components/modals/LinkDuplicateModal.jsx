import { useState } from "react";
import { GitMerge } from "lucide-react";
import { ModalShell } from "../../../../../shared/components/GovernanceUi";
import { shortUrgency } from "../../utils";

function LinkDuplicateModal({ report, reports, onClose, onLink }) {
  const [masterId, setMasterId] = useState("");
  const candidates = reports.filter((r) => r.id !== report.id && r.status !== "Duplicate");
  return (
    <ModalShell title="Link Duplicate Reports" subtitle={`${report.id} • ${report.category} • ${report.title}`} onClose={onClose} width="max-w-[560px]" backdrop="z-[95]" panel="z-[105]"
      footer={<footer className="gf-modal-foot" style={{ justifyContent: "space-between" }}>
        <span className="text-[9px] text-[#7184a0]">Duplicates keep their records but follow a single master incident.</span>
        <button type="button" disabled={!masterId} onClick={() => onLink(report.id, masterId)} className="gf-btn gf-btn--primary">Link to master</button>
      </footer>}>
      <div className="gf-modal-body">
        <label className="grid gap-1 text-[10px] font-medium text-[#4c4c4c]">Master incident
          <select className="gf-select" style={{ color: "#42506a", height: 32 }} value={masterId} onChange={(event) => setMasterId(event.target.value)}>
            <option value="">— select master —</option>
            {candidates.map((r) => <option key={r.id} value={r.id}>{r.id} — {r.title} ({shortUrgency(r.urgency)})</option>)}
          </select>
        </label>
        {report.duplicateOf && <div className="gf-note gf-note--soft"><GitMerge size={14} style={{ flexShrink: 0 }} /><span>Currently linked to <strong>{report.duplicateOf}</strong>.</span></div>}
      </div>
    </ModalShell>
  );
}

export default LinkDuplicateModal;
