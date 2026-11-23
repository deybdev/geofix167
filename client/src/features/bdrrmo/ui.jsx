import { useState } from "react";

export function Chip({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold leading-none ${className}`}
    >
      {children}
    </span>
  );
}

export function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#f1f4f6] py-1.5 last:border-b-0">
      <span className="shrink-0 text-[9px] font-semibold text-[#7184a0]">{label}</span>
      <span className="text-right text-[10px] font-semibold text-[#263246]">{children}</span>
    </div>
  );
}

export function DrawerSection({ title, icon: Icon, children, last = false, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`pb-4 ${last ? "" : "border-b border-[#edf0f2]"}`}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mb-2 flex w-full items-center justify-between gap-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#60738f] hover:text-(--gf-green)"
        >
          <span className="flex items-center gap-1.5">
            {Icon && <Icon size={11} className="text-(--gf-green)" />}
            {title}
          </span>
          <span className="text-[9px] font-semibold text-[#7c8ba3]">
            {open ? "▲ Hide" : "▼ Show"}
          </span>
        </button>
      ) : (
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#60738f]">
          {Icon && <Icon size={11} className="text-(--gf-green)" />}
          {title}
        </h3>
      )}
      {(!collapsible || open) && children}
    </section>
  );
}
