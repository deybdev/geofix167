import { NavLink, Outlet } from "react-router-dom";
import { PATHS } from "../../../router/paths";

export default function AccomplishmentsLayout() {
  return <div className="space-y-4">
    <nav aria-label="Accomplishment pages" className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {[[PATHS.adminAccomplishmentLog, "Barangay Accomplishments"], [PATHS.adminBdrrmoAccomplishments, "BDRRMO Completed Tasks"]].map(([path, label]) =>
        <NavLink key={path} to={path} end className={({ isActive }) => `rounded-lg px-4 py-3 text-sm font-semibold focus-visible:outline-2 ${isActive ? "bg-(--gf-green) text-white" : "text-slate-600 hover:bg-(--gf-green-soft)"}`}>{label}</NavLink>
      )}
    </nav>
    <Outlet />
  </div>;
}
