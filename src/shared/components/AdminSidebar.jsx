import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardList,
  Grid2X2,
  Map,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: Grid2X2, active: true },
  { label: "Incident Reports", icon: ClipboardList },
  { label: "Map View", icon: Map },
  { label: "Dispatch & Tasks", icon: ShieldCheck },
  { label: "Resolution Verification", icon: CheckSquare },
  { label: "Accomplishment Log", icon: BookOpen },
  { label: "Users & Roles", icon: Users },
  { label: "Reports & Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

export default function AdminSidebar({ open = false, onClose }) {
  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-20 bg-slate-950/20 md:hidden"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[178px] border-r border-[#e4e9ec] bg-white px-3 py-4 transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-7 flex items-center gap-2 px-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-[4px] border-[#2e8b57] text-[8px] font-bold text-[#2e8b57]">
            G
          </div>
          <div className="text-[11px] font-bold leading-tight text-[#2e8b57]">
            GeoFix <span className="block text-[8px]">Barangay 167</span>
          </div>
          <button
            className="ml-auto text-slate-400 md:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={17} />
          </button>
        </div>
        <nav className="space-y-1">
          {navigation.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-[10px] font-medium ${
                active
                  ? "bg-[#2e8b57] text-white"
                  : "text-[#263246] hover:bg-[#edf6f1]"
              }`}
            >
              <Icon size={14} strokeWidth={1.8} /> {label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-3 right-3 flex items-center gap-2 rounded-md border border-[#e5eaed] bg-[#f8fafb] p-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2e8b57] text-[9px] font-bold text-white">
            BA
          </div>
          <div className="min-w-0 text-[9px]">
            <strong className="block truncate">Barangay Administrator</strong>
            <span className="text-[8px] text-slate-400">
              Authorized Account
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
