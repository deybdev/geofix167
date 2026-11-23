import { isEmergency } from "../../utils";
import { ChevronDown, Flag, GitMerge, History, Printer, Radio, Siren } from "lucide-react";
import { useRef, useState } from "react";

function ActionCell({ report, primaryLabel, menuOpen, onToggleMenu, onCloseMenu, onOpenDrawer, onBackup, onFlag, onMerge, onAudit, onFieldOps, onPrintable }) {
  const triggerRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menu = [
    { key: "backup", label: "Request Responder", icon: Siren, run: onBackup, disabled: report.status === "Verified Fixed" },
    { key: "flag", label: "Flag False Report (Strike)", icon: Flag, run: onFlag },
    { key: "merge", label: "Merge with Duplicate", icon: GitMerge, run: onMerge, disabled: report.status === "Duplicate" },
    { key: "audit", label: "View Audit Trail", icon: History, run: onAudit },
    { key: "field", label: "Field Ops — Responder Assignment", icon: Radio, run: onFieldOps, disabled: report.status === "Verified Fixed" },
    ...(report.status === "Verified Fixed" && report.incidentId
      ? [{ key: "print", label: "View Printable Incident Report", icon: Printer, run: onPrintable }]
      : []),
  ].filter((item) => !isEmergency(report) || ["audit", "print"].includes(item.key));
  const openMenu = () => {
    if (!menuOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = 260;
      const estimatedHeight = 308;
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width));
      const top = rect.bottom + 8 + estimatedHeight > window.innerHeight
        ? Math.max(12, rect.top - estimatedHeight - 8)
        : rect.bottom + 8;
      setMenuPosition({ top, left });
    }
    onToggleMenu();
  };
  return (
    <td className="px-3 py-3">
      <div className="flex w-max whitespace-nowrap items-center gap-1.5">
        <button type="button" onClick={() => onOpenDrawer(report)}
          className="h-9 min-w-[68px] rounded-md bg-(--gf-green) px-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-(--gf-green-dark) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gf-green)">
          {primaryLabel}
        </button>
        <button ref={triggerRef} type="button" title="Available report actions" aria-expanded={menuOpen} onClick={openMenu}
          className="flex h-9 items-center gap-1.5 rounded-md border border-[#dfe7ea] bg-white px-2.5 text-[11px] font-bold text-[#60738f] shadow-sm transition hover:border-(--gf-green) hover:bg-(--gf-green-soft) hover:text-(--gf-green) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--gf-green)">
          Actions
          <ChevronDown size={13} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onCloseMenu} />
          <div
            role="menu"
            aria-label={`Actions for ${report.id}`}
            className="fixed z-[70] w-[260px] overflow-hidden rounded-xl border border-[#dfe7ea] bg-white p-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)]"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <p className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Report actions</p>
            {menu.map((item) => (
              <button key={item.key} type="button" role="menuitem" disabled={item.disabled} onClick={() => { onCloseMenu(); item.run(report); }}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-[12px] font-semibold text-[#263246] transition hover:bg-(--gf-green-soft) hover:text-(--gf-green) disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[#a0b0c6]">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${item.key === "flag" ? "bg-[#fdecea] text-[#dc2626]" : "bg-(--gf-green-soft) text-(--gf-green)"}`}>
                  <item.icon size={15} />
                </span>
                <span className="leading-snug">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </td>
  );
}

export default ActionCell;
