import { useId, useMemo } from "react";
import { ChevronDown, X } from "lucide-react";

/* Governance UI shared by the admin incident/maintenance modules.
   All styling comes from the gf-* utilities in the main index.css. */

// eslint-disable-next-line react-refresh/only-export-components -- mixed util/component module, matches MapViewer.jsx pattern
export const stamp = (includeDate = false) => new Date().toLocaleString([], includeDate
  ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
  : { hour: "2-digit", minute: "2-digit" });

// eslint-disable-next-line react-refresh/only-export-components
export const fmtClock = (ms) => `${String(Math.floor(Math.max(0, ms) / 1000 / 60)).padStart(2, "0")}:${String(Math.floor(Math.max(0, ms) / 1000) % 60).padStart(2, "0")}`;

/* ---------------------- Deterministic pseudo-QR (handover) ---------------- */

// eslint-disable-next-line react-refresh/only-export-components -- seeded QR token derivation shared by incident/maintenance modules
export function hash32(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function qrMatrix(seed) {
  const size = 25;
  const next = hash32(seed);
  let state = next();
  const rand = () => {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    state ^= state >>> 13;
    state = Math.imul(state, 3266489917);
    state = (state ^ (state >>> 16)) >>> 0;
    return state / 2 ** 32;
  };
  const finder = (r, c) => (r >= 0 && r < 7 && c >= 0 && c < 7) || (r >= 0 && r < 7 && c >= size - 7) || (r >= size - 7 && c >= 0 && c < 7);
  const grid = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => {
    if (finder(r, c)) return false;
    return rand() < 0.47;
  }));
  const finderAt = (or_, oc) => {
    for (let r = 0; r < 7; r += 1) {
      for (let c = 0; c < 7; c += 1) {
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[or_ + r][oc + c] = edge || core;
      }
    }
  };
  finderAt(0, 0);
  finderAt(0, size - 7);
  finderAt(size - 7, 0);
  return grid;
}

export function QRMatrix({ seed, scale = 6 }) {
  const grid = useMemo(() => qrMatrix(seed), [seed]);
  const size = grid.length;
  return (
    <svg width={size * scale + 12} height={size * scale + 12} viewBox={`0 0 ${size * scale + 12} ${size * scale + 12}`} aria-label="Dynamic handover QR code">
      <rect width="100%" height="100%" fill="#fff" />
      <g fill="#263246">
        {grid.flatMap((row, r) => row.map((dark, c) => dark
          ? <rect key={`${r}-${c}`} x={c * scale + 6} y={r * scale + 6} width={scale} height={scale} />
          : null))}
      </g>
    </svg>
  );
}

export function SelectFilter({ value, options, onChange, ariaLabel }) {
  return (
    <label className="gf-select-wrap">
      <span className="sr-only">{ariaLabel ?? options[0]}</span>
      <select className="gf-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <ChevronDown size={12} className="gf-select-caret" />
    </label>
  );
}

export function Badge({ label, styles }) {
  return <span className={styles}>{label}</span>;
}

export function ModalShell({ title, subtitle, onClose, children, footer, width = "max-w-[430px]", backdrop = "z-[70]", panel = "z-[80]" }) {
  const titleId = useId();
  return (
    <>
      <button type="button" aria-label={`Close ${title} dialog`} onClick={onClose} className={`gf-backdrop ${backdrop}`} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className={`gf-modal ${panel} ${width}`}>
        <div className="gf-modal-head">
          <div><h2 id={titleId} className="gf-modal-title">{title}</h2><p className="gf-modal-sub">{subtitle}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="gf-modal-close"><X size={14} /></button>
        </div>
        {children}
        {footer}
      </section>
    </>
  );
}

export function ModalSection({ title, children }) {
  return (
    <section className="gf-section">
      <h4 className="gf-section-title">{title}</h4>
      {children}
    </section>
  );
}

export function DetailRow({ label, value }) {
  return (
    <div className="gf-row">
      <span className="gf-row-label">{label}</span>
      <strong className="gf-row-value">{value}</strong>
    </div>
  );
}

export function RowList({ rows }) {
  return <div className="gf-rows">{rows.map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</div>;
}
