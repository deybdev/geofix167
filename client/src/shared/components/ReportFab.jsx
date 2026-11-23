import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
const KEY = "geofix:fab-teased";
export default function ReportFab({ onClick }) {
  const [teasing, setTeasing] = useState(() => { try { return sessionStorage.getItem(KEY) !== "1"; } catch { return true; } });
  useEffect(() => { if (!teasing) return undefined; try { sessionStorage.setItem(KEY, "1"); } catch { /* unavailable */ } const timer = setTimeout(() => setTeasing(false), 10000); return () => clearTimeout(timer); }, [teasing]);
  const stop = useCallback(() => setTeasing(false), []);
  return <div className={`landing-report-fab-wrap ${teasing ? "is-teasing" : ""}`}><span className="landing-report-fab-caption">Report incident</span><button type="button" className={`landing-report-fab ${teasing ? "is-teasing" : ""}`} aria-label="Report an incident" onPointerEnter={stop} onFocus={stop} onClick={() => { stop(); onClick(); }}><AlertTriangle size={22} /><span>Report incident now</span></button></div>;
}
