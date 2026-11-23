import { Siren } from "lucide-react";
import { fmtClock } from "../../../../../shared/components/GovernanceUi";
import { REMINDER_MS, TAKEOVER_MS } from "../../constants";

function SlaBanner({ report, now }) {
  const elapsed = now - report.sla.start;
  const remaining = Math.max(0, TAKEOVER_MS - elapsed);
  const reminded = elapsed >= REMINDER_MS;
  const progress = Math.min(100, (elapsed / TAKEOVER_MS) * 100);
  return (
    <div className={`gf-sla-banner ${reminded ? "gf-sla-banner--urgent" : ""}`} role="alert" aria-live="polite">
      <div className="gf-sla-banner__icon" aria-hidden="true">
        <Siren size={19} />
      </div>
      <div className="gf-sla-banner__main">
        <div className="gf-sla-banner__heading">
          <strong>Emergency verification required</strong>
          <span>{report.id}</span>
        </div>
        <p>Verify this report before it automatically transfers dispatch control to BDRRMO.</p>
      </div>
      <div className="gf-sla-banner__timer">
        <span className="gf-sla-banner__label">Time remaining</span>
        <strong className="gf-timer gf-timer--armed">{fmtClock(remaining)}</strong>
      </div>
      <span className={`gf-sla-status ${reminded ? "gf-sla-status--urgent" : ""}`}>
        {reminded ? "Reminder issued" : "Reminder at 30 seconds"}
      </span>
      <div className="gf-sla-banner__progress" aria-label={`${Math.round(progress)} percent of verification time elapsed`}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default SlaBanner;
