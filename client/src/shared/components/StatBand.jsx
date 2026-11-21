import { useEffect, useRef, useState } from "react";

function CountValue({ value }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const numeric = Number(String(value).replaceAll(",", "").match(/[\d.]+/)?.[0] ?? 0);
    const prefix = String(value).slice(0, String(value).search(/[\d]/));
    const suffix = String(value).replace(/^.*?[\d,.]+/, "");
    const decimals = String(numeric).includes(".") ? 1 : 0;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }
      const start = performance.now();
      const animate = (now) => {
        const progress = Math.min(1, (now - start) / 700);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = numeric * eased;
        const formatted = current.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        setDisplay(`${prefix}${formatted}${suffix}`);
        if (progress < 1) frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    }, { threshold: .45 });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <strong ref={ref}>{display}</strong>;
}

export default function StatBand({ stats }) {
  return <section className="landing-stat-band"><div className="site-container landing-stat-band__grid">{stats.map((stat) => <div key={stat.label}><CountValue value={stat.value}/><span>{stat.label}</span><small>{stat.desc}</small></div>)}</div></section>;
}
