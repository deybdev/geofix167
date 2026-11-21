import { ChevronDown, ChevronUp, Radio, ShieldAlert, Siren } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fmtClock } from "../../../../shared/components/GovernanceUi";
import { TAKEOVER_MS } from "../constants";

export default function FloatingEmergencyStack({ reports, now, onVerify }) {
  const [expanded, setExpanded] = useState(false);
  const [escalated, setEscalated] = useState({});

  useEffect(() => {
    const takeovers = reports.filter((report) => report.status === "BDRRMO Takeover");
    if (!takeovers.length) return;
    takeovers.forEach((report) => {
      setEscalated((current) => {
        if (current[report.id]) return current;
        const timeout = window.setTimeout(() => {
          setEscalated((latest) => {
            const next = { ...latest };
            delete next[report.id];
            return next;
          });
        }, 5000);
        return { ...current, [report.id]: { report, timeout } };
      });
    });
  }, [reports]);

  useEffect(() => () => {
    Object.values(escalated).forEach((entry) => entry.timeout && window.clearTimeout(entry.timeout));
  }, []);

  const activeCards = useMemo(() => reports
    .filter((report) => report.sla?.start && report.status === "Reported" && !report.sla.acknowledged)
    .map((report) => {
      const elapsed = now - report.sla.start;
      return {
        report,
        remaining: Math.max(0, TAKEOVER_MS - elapsed),
        elapsed,
        escalated: false,
      };
    })
    .sort((a, b) => a.remaining - b.remaining), [reports, now]);

  const escalatedCards = Object.values(escalated).map((entry) => ({
    report: entry.report,
    remaining: 0,
    elapsed: TAKEOVER_MS,
    escalated: true,
  }));
  const cards = [...escalatedCards, ...activeCards].sort((a, b) => Number(a.escalated) - Number(b.escalated) || a.remaining - b.remaining);
  const visibleCards = expanded ? cards : cards.slice(0, 2);
  const hiddenCount = Math.max(0, cards.length - visibleCards.length);

  if (!cards.length) return null;

  return (
    <aside aria-label="Emergency alerts" className="fixed bottom-4 right-4 z-50 w-[340px] space-y-3">
      {visibleCards.map(({ report, remaining, elapsed, escalated: isEscalated }) => (
        <article key={report.id} className={`relative overflow-hidden rounded-xl border bg-white shadow-[0_14px_38px_rgba(15,23,42,0.18)] ${isEscalated ? "border-[#dc2626]" : remaining <= 30000 ? "border-[#efc2bd]" : "border-[#dfe7ea]"}`} role="alert" aria-live="assertive">
          <div className="flex items-start gap-3 p-3.5">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isEscalated ? "bg-[#fdecea] text-[#dc2626]" : "bg-[#fff1c6] text-[#9a6500]"}`}>
              {isEscalated ? <ShieldAlert size={20} /> : <Siren size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-extrabold ${isEscalated ? "bg-[#fdecea] text-[#dc2626]" : "bg-[#fff1c6] text-[#9a6500]"}`}>{report.id}</span>
                {!isEscalated && <strong className="font-mono text-[20px] font-extrabold tabular-nums text-[#dc2626]">{fmtClock(remaining)}</strong>}
              </div>
              {isEscalated ? (
                <div className="mt-2">
                  <p className="text-[14px] font-extrabold text-[#dc2626]">Escalated to BDRRMO</p>
                  <p className="mt-0.5 truncate text-[11px] text-[#7a3040]">{report.category}</p>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="truncate text-[12px] font-bold text-[#263246]">{report.category || "Emergency report"}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#60738f]">{report.title}</p>
                </div>
              )}
            </div>
          </div>
          {!isEscalated && (
            <div className="px-3.5 pb-3.5">
              <button type="button" onClick={() => onVerify(report)} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-(--gf-green) text-[12px] font-bold text-white transition hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gf-green)">
                <Radio size={14} />Verify
              </button>
            </div>
          )}
          {!isEscalated && (
            <div className="h-[3px] w-full bg-[#fee2e2]" aria-hidden="true">
              <div className="h-full bg-[#dc2626] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (elapsed / TAKEOVER_MS) * 100)}%` }} />
            </div>
          )}
        </article>
      ))}
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#e2e8eb] bg-white text-[12px] font-bold text-[#60738f] shadow-md transition hover:border-(--gf-green) hover:text-(--gf-green)">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Show fewer alerts" : `+${hiddenCount} more pending verification`}
        </button>
      )}
    </aside>
  );
}
