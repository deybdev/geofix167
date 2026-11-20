import { useEffect, useRef, useState } from "react";

function AnimatedStat({ value }) {
  const match = String(value).match(/^([\d,.]+)(.*)$/);
  const rawNumber = match?.[1] || "";
  const target = match ? Number(rawNumber.replaceAll(",", "")) : null;
  const decimals = rawNumber.includes(".") ? rawNumber.split(".")[1].length : 0;
  const useGrouping = rawNumber.includes(",");
  const suffix = match?.[2] || "";
  const [shown, setShown] = useState(target == null ? value : 0);
  const ref = useRef(null);
  useEffect(() => {
    if (target == null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame; let start;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const tick = (time) => { start ??= time; const p = Math.min(1, (time - start) / 700); const current = target * (1 - Math.pow(1 - p, 3)); setShown(decimals ? Number(current.toFixed(decimals)) : Math.round(current)); if (p < 1) frame = requestAnimationFrame(tick); };
      frame = requestAnimationFrame(tick); observer.disconnect();
    }, { threshold: .4 });
    observer.observe(ref.current); return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [decimals, target]);
  const formatted = typeof shown === "number" ? shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping }) : shown;
  return <span ref={ref}>{target == null ? value : `${formatted}${suffix}`}</span>;
}

export default function StatBand({ stats, label = "Barangay service snapshot" }) {
  return <section className="landing-stat-band" aria-label={label}><div className="site-container grid grid-cols-2 lg:grid-cols-4">{stats.map((stat) => <div key={stat.label} className="landing-stat-band__item"><strong><AnimatedStat value={stat.value} /></strong><span>{stat.label}</span><small>{stat.desc}</small></div>)}</div></section>;
}
