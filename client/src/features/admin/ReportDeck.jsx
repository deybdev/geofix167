import { ArrowLeft, BarChart3, CheckCircle2, Clock, Printer, ShieldAlert, TrendingUp, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { PATHS } from "../../router/paths";
import { BY_CATEGORY, BY_STATUS, EMERGENCY_METRICS, KPI_DATA, TOP_ISSUES } from "./analytics/mockData";

const kpi = KPI_DATA.month;
const topCategory = [...BY_CATEGORY].sort((a, b) => b.value - a.value)[0];
const topIssue = [...TOP_ISSUES].sort((a, b) => b.value - a.value)[0];
const resolved = BY_STATUS.find((item) => item.label === "Resolved")?.value ?? kpi.resolvedReports;

function Slide({ eyebrow, title, description, children, dark = false }) {
  return <section className={`admin-report-slide ${dark ? "is-dark" : ""}`}>
    <div className="admin-report-slide__brand">GEOFIX 167 · ADMIN OPERATIONS</div>
    <div className="admin-report-slide__content">
      <p className="admin-report-slide__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description && <p className="admin-report-slide__description">{description}</p>}
      {children}
    </div>
    <div className="admin-report-slide__footer">Barangay 167 · Caloocan City · Operational report</div>
  </section>;
}

function Metric({ label, value, icon: Icon, note }) {
  return <article className="admin-deck-metric"><Icon size={24} /><strong>{value}</strong><span>{label}</span>{note && <small>{note}</small>}</article>;
}

export default function ReportDeck() {
  return <div className="admin-report-deck">
    <div className="admin-report-deck__controls print:hidden">
      <Link to={PATHS.adminReportsAnalytics} className="gf-btn gf-btn--chip"><ArrowLeft size={14} />Back to analytics</Link>
      <button type="button" onClick={() => window.print()} className="gf-btn gf-btn--primary"><Printer size={14} />Print / Save as PDF</button>
    </div>

    <Slide dark eyebrow="Monthly operations briefing" title="Barangay 167 administrative performance report" description="A decision-ready summary of incident demand, operational response, maintenance workload, and verified community outcomes.">
      <div className="admin-deck-cover-meta"><span>This Month</span><span>Generated {new Intl.DateTimeFormat("en-PH", { dateStyle: "long" }).format(new Date())}</span></div>
    </Slide>

    <Slide eyebrow="01 · Executive summary" title="Operations remain productive, with a visible pending-action queue." description={`${kpi.totalReports} reports were recorded this month. ${kpi.resolvedReports} reached a resolved state, while ${kpi.pendingReports} still require triage, dispatch, assignment, or verification.`}>
      <div className="admin-deck-metrics"><Metric label="Total reports" value={kpi.totalReports} icon={BarChart3} /><Metric label="Pending action" value={kpi.pendingReports} icon={Clock} /><Metric label="Resolution rate" value={`${kpi.resolutionRate}%`} icon={TrendingUp} /><Metric label="Active emergencies" value={kpi.activeEmergencies} icon={ShieldAlert} /></div>
    </Slide>

    <Slide eyebrow="02 · Response performance" title="Response speed is measurable and ready for administrative review." description={`Average response time is ${kpi.avgResponseTime} minutes. Emergency operations average ${EMERGENCY_METRICS.avgDispatchTime} minutes to dispatch and ${EMERGENCY_METRICS.avgArrivalTime} minutes to arrival.`}>
      <div className="admin-deck-callout"><Clock size={30} /><div><strong>{kpi.avgResponseTime} min</strong><span>Average response time across the reporting period</span></div></div>
      <div className="admin-deck-bars"><div><span>Dispatch</span><i style={{ width: `${EMERGENCY_METRICS.avgDispatchTime * 8}%` }} /><b>{EMERGENCY_METRICS.avgDispatchTime} min</b></div><div><span>Arrival</span><i style={{ width: `${EMERGENCY_METRICS.avgArrivalTime * 8}%` }} /><b>{EMERGENCY_METRICS.avgArrivalTime} min</b></div><div><span>Resolution</span><i style={{ width: `${Math.min(100, EMERGENCY_METRICS.avgResolutionTime * 2)}%` }} /><b>{EMERGENCY_METRICS.avgResolutionTime} min</b></div></div>
    </Slide>

    <Slide eyebrow="03 · Demand profile" title={`${topCategory.label} is the leading report category.`} description={`${topCategory.value} records fall under ${topCategory.label}. Concentrating inspection and response resources in the highest-volume categories can reduce repeat reports and pending workload.`}>
      <div className="admin-deck-ranking">{BY_CATEGORY.slice(0, 6).map((item, index) => <div key={item.label}><span>{index + 1}</span><strong>{item.label}</strong><i style={{ width: `${(item.value / topCategory.value) * 100}%` }} /><b>{item.value}</b></div>)}</div>
    </Slide>

    <Slide eyebrow="04 · Maintenance" title={`${topIssue.label} is the most frequently reported infrastructure issue.`} description={`${topIssue.value} reports identify ${topIssue.label.toLowerCase()} as a recurring concern. Maintenance planning should prioritize repeat-location analysis, crew availability, and verification turnaround.`}>
      <div className="admin-deck-callout"><Wrench size={30} /><div><strong>{topIssue.value} reports</strong><span>{topIssue.label}</span></div></div>
    </Slide>

    <Slide eyebrow="05 · Verified outcomes" title={`${resolved} reports are recorded as resolved.`} description={`The current ${kpi.resolutionRate}% resolution rate reflects closed and verified work. Pending verification should remain visible so operational completion is not mistaken for evidence-approved closure.`}>
      <div className="admin-deck-outcome"><CheckCircle2 size={54} /><strong>{kpi.resolutionRate}%</strong><span>Resolution rate</span></div>
    </Slide>

    <Slide dark eyebrow="06 · Recommended actions" title="Focus the next operating cycle on queue reduction and evidence-backed closure.">
      <ol className="admin-deck-actions"><li><span>01</span><div><strong>Reduce pending action</strong><p>Review the triage queue daily and assign ownership before SLA escalation.</p></div></li><li><span>02</span><div><strong>Prioritize recurring infrastructure issues</strong><p>Use category and location trends to schedule preventive maintenance.</p></div></li><li><span>03</span><div><strong>Protect verified outcomes</strong><p>Require evidence review and audit-ready closure records before publication.</p></div></li></ol>
    </Slide>
  </div>;
}
