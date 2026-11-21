import { Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, ModalShell, RowList } from "../../../../../shared/components/GovernanceUi";
import { STATUS_STYLES } from "../../constants";
import { shortUrgency } from "../../utils";

function SuccessModal({ report, onClose }) {
  return (
    <ModalShell title="Resolution Verified" subtitle={`${report.id} • ${report.closure?.reason ? "closed with documented no-proof reason" : "proof recorded"}`} onClose={onClose} width="max-w-[620px]" backdrop="z-[110]" panel="z-[120]"
      footer={<footer className="gf-modal-foot"><button type="button" onClick={onClose} className="gf-btn gf-btn--primary">Done</button></footer>}>
      <div className="px-6 py-7">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--gf-green-tint)", color: "var(--gf-green)" }}><span className="text-[28px] leading-none">✓</span></div>
          <h3 className="mt-4 text-[18px] font-bold text-[#3d3d3d]">{report.closure?.reason ? "Closed Without Proof — Reason Documented" : "Report Marked as Resolved"}</h3>
          <p className="mt-1 text-[11px] text-[#60738f]">
            {report.closure?.reason
              ? "The no-proof closure and its reason were written to the immutable audit trail."
              : "Proof of response/repair is recorded and the report details were updated."}
          </p>
        </div>
        <div className="mt-5">
          <RowList rows={[
            ["Report ID", report.id],
            ["Status", <Badge key="status" label={report.status} styles={STATUS_STYLES[report.status]} />],
            ["Category", report.category], ["Urgency", shortUrgency(report.urgency)],
            ["Location", `${report.location}, Barangay 167`], ["Assigned Team", report.team],
            ["Publishing", report.published ? `Published ${report.published.at}` : "Not yet published to the public dashboard"],
          ]} />
        </div>
        {report.incidentId && (
          <Link to={`/admin/incident-reports/${encodeURIComponent(report.incidentId)}/report`} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800">
            <Printer size={13} /> View printable incident report
          </Link>
        )}
      </div>
    </ModalShell>
  );
}

export default SuccessModal;
