import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

const TEASER_KEY = "geofix:fab-teased";

export default function ReportFab({ onClick }) {
  const [teasing, setTeasing] = useState(() => {
    try { return sessionStorage.getItem(TEASER_KEY) !== "1"; }
    catch { return true; }
  });

  useEffect(() => {
    if (!teasing) return;
    try { sessionStorage.setItem(TEASER_KEY, "1"); } catch { /* storage can be unavailable */ }
    const timer = window.setTimeout(() => setTeasing(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [teasing]);

  const stopTeaser = useCallback(() => setTeasing(false), []);
  const handleClick = () => { stopTeaser(); onClick(); };

  return <div className={`landing-report-fab-wrap ${teasing ? "is-teasing" : ""}`}>
    <span className="landing-report-fab-caption" aria-hidden="true">Report incident</span>
    <button type="button" onClick={handleClick} onPointerEnter={stopTeaser} onFocus={stopTeaser} className={`landing-report-fab ${teasing ? "is-teasing" : ""}`} aria-label="Report an incident">
      <AlertTriangle size={22} aria-hidden="true" />
      <span>Report incident now</span>
    </button>
  </div>;
}
