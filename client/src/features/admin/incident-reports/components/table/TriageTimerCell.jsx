import { Siren } from "lucide-react";
import { fmtClock } from "../../../../../shared/components/GovernanceUi";
import { REMINDER_MS, TAKEOVER_MS } from "../../constants";

function TriageTimerCell({ report, now }) {
  if (!report.sla?.start) {
    return <td className="px-2 py-3"><span className="text-[11px] text-[#7c8ba3]">No active timer</span></td>;
  }
  const remaining = Math.max(0, TAKEOVER_MS - (now - report.sla.start));
  if (remaining <= 0) {
    return (
      <td className="px-2 py-3">
        <span className="gf-badge gf-badge--alert gf-badge--timer"><Siren size={12} />BDRRMO takeover</span>
      </td>
    );
  }
  return (
    <td className="px-2 py-3">
      <div className={`gf-triage-timer ${remaining <= REMINDER_MS ? "gf-triage-timer--urgent" : ""}`}>
        <span className="gf-timer gf-timer--armed">{fmtClock(remaining)}</span>
        <span>until takeover</span>
      </div>
    </td>
  );
}

export default TriageTimerCell;
