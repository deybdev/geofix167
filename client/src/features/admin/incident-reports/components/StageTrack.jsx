import { FIELD_STAGES } from "../constants";

/* Shared stage-chip row used by the incident drawer, Field Ops modal, and the
   dispatch & tracking board. An unknown/undefined stage renders every chip as
   locked, which preserves the pre-assignment state in Field Ops. */
export default function StageTrack({ stage, className = "" }) {
  const currentIndex = FIELD_STAGES.indexOf(stage);
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {FIELD_STAGES.map((label, index) => {
        const done = currentIndex >= 0 && index < currentIndex;
        const active = label === stage;
        return (
          <span key={label} className={`gf-stage ${active ? "text-[#e69500]" : done ? "text-(--gf-green)" : "text-[#a0b0c0]"}`}>
            <span className={`gf-stage-dot ${done ? "gf-stage-dot--done" : active ? "gf-stage-dot--active" : "gf-stage-dot--locked"}`}>{done ? "✓" : ""}</span>
            {label}
          </span>
        );
      })}
    </div>
  );
}
