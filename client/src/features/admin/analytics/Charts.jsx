import { useEffect, useRef, useState } from "react";

// Reusable chart primitives — pure SVG, no external charting library.

// Measures the container box so charts render at real pixel size and fill
// their card edge-to-edge instead of letterboxing a fixed 400px viewBox.
function useContainerSize(fallbackHeight) {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: fallbackHeight });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height: height > 0 ? height : prev.height };
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

// ── Line Chart ───────────────────────────────────────────────────────────────
export function LineChart({ data, color = "#2e8b57", height = 120 }) {
  const [ref, { width, height: boxH }] = useContainerSize(height);
  if (!data.length || !width) return <div ref={ref} className="min-h-0 flex-1" />;
  const W = width, H = boxH || height;
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const pad = { t: 12, r: 8, b: 28, l: 28 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;

  const pts = data.map((d, i) => ({
    x: pad.l + (i / (data.length - 1)) * iW,
    y: pad.t + (1 - (d.value - min) / range) * iH,
    ...d,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(pad.t + iH).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t + iH).toFixed(1)} Z`;

  return (
    <div ref={ref} className="min-h-0 flex-1">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
        <defs>
          <linearGradient id={`lg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.t + t * iH;
          const val = Math.round(max - t * range);
          return (
            <g key={t}>
              <line x1={pad.l} y1={y} x2={pad.l + iW} y2={y} stroke="#e2e8eb" strokeWidth="1" />
              <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#7184a0">{val}</text>
            </g>
          );
        })}
        {/* Area fill */}
        <path d={areaPath} fill={`url(#lg-${color.replace("#", "")})`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots + x-labels */}
        {pts.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="3" fill={color} stroke="#fff" strokeWidth="1.5" />
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize="8" fill="#7184a0">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Donut Chart ──────────────────────────────────────────────────────────────
export function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const r = 46, cx = size / 2, cy = size / 2, stroke = 18;
  let cumAngle = -Math.PI / 2;

  const arcs = data.map((d) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { ...d, d: `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)}`, pct: Math.round((d.value / total) * 100) };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {arcs.map((arc) => (
        <path key={arc.label} d={arc.d} fill="none" stroke={arc.color} strokeWidth={stroke} strokeLinecap="butt">
          <title>{arc.label}: {arc.value} ({arc.pct}%)</title>
        </path>
      ))}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="16" fontWeight="700" fill="#263246">{total}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#7184a0">total</text>
    </svg>
  );
}

// ── Bar Chart (vertical) ─────────────────────────────────────────────────────
export function BarChart({ data, height = 140 }) {
  const [ref, { width, height: boxH }] = useContainerSize(height);
  if (!data.length || !width) return <div ref={ref} className="min-h-0 flex-1" />;
  const W = width, H = boxH || height;
  const max = Math.max(...data.map((d) => d.value));
  const pad = { t: 8, r: 8, b: 28, l: 28 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const bw = Math.min(36, (iW / data.length) * 0.55);
  const gap = iW / data.length;

  return (
    <div ref={ref} className="min-h-0 flex-1">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + t * iH;
          return <line key={t} x1={pad.l} y1={y} x2={pad.l + iW} y2={y} stroke="#e2e8eb" strokeWidth="1" />;
        })}
        {data.map((d, i) => {
          const bh = (d.value / max) * iH;
          const x = pad.l + i * gap + gap / 2 - bw / 2;
          const y = pad.t + iH - bh;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={bw} height={bh} rx="3" fill={d.color || "#2e8b57"} opacity="0.9">
                <title>{d.label}: {d.value}</title>
              </rect>
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="7.5" fill="#7184a0">{d.label}</text>
              <text x={x + bw / 2} y={y - 3} textAnchor="middle" fontSize="8" fontWeight="600" fill="#263246">{d.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Horizontal Bar Chart ─────────────────────────────────────────────────────
export function HBarChart({ data, color = "#2e8b57" }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="grid gap-2">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="flex items-center justify-between text-[9px] font-medium text-[#60738f] mb-0.5">
            <span className="truncate pr-2">{d.label}</span>
            <span className="font-bold text-[#263246] shrink-0">{d.value}</span>
          </div>
          <div className="h-[7px] rounded-full bg-[#f0f3f5] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, background: d.color || color, opacity: 1 - i * 0.08 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Grouped Bar (maintenance monthly) ─────────────────────────────────────
export function GroupedBarChart({ data, height = 140 }) {
  const [ref, { width, height: boxH }] = useContainerSize(height);
  if (!data.length || !width) return <div ref={ref} className="min-h-0 flex-1" />;
  const W = width, H = boxH || height;
  const max = Math.max(...data.flatMap((d) => [d.reported, d.resolved]));
  const pad = { t: 8, r: 8, b: 28, l: 28 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;
  const groupW = iW / data.length;
  const bw = Math.min(18, groupW * 0.3);

  return (
    <div ref={ref} className="min-h-0 flex-1">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad.l} y1={pad.t + t * iH} x2={pad.l + iW} y2={pad.t + t * iH} stroke="#e2e8eb" strokeWidth="1" />
        ))}
        {data.map((d, i) => {
          const cx = pad.l + i * groupW + groupW / 2;
          const rh = (d.reported / max) * iH;
          const rsh = (d.resolved / max) * iH;
          return (
            <g key={d.label}>
              <rect x={cx - bw - 1} y={pad.t + iH - rh} width={bw} height={rh} rx="2" fill="#7184a0" opacity="0.7">
                <title>Reported: {d.reported}</title>
              </rect>
              <rect x={cx + 1} y={pad.t + iH - rsh} width={bw} height={rsh} rx="2" fill="#2e8b57" opacity="0.85">
                <title>Resolved: {d.resolved}</title>
              </rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="8" fill="#7184a0">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Stacked Bar (maintenance by category) ───────────────────────────────────
export function StackedHBar({ data }) {
  return (
    <div className="grid gap-2.5">
      {data.map((d) => {
        const total = d.resolved + d.unresolved;
        const resPct = (d.resolved / total) * 100;
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between text-[9px] font-medium text-[#60738f] mb-0.5">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                {d.label}
              </span>
              <span className="text-[#263246] font-bold">{d.resolved}/{total}</span>
            </div>
            <div className="h-[7px] rounded-full bg-[#f0f3f5] overflow-hidden flex">
              <div className="h-full rounded-l-full" style={{ width: `${resPct}%`, background: d.color }} />
              <div className="h-full flex-1 bg-[#e2e8eb]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
