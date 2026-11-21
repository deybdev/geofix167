import {
  BarChart3,
  BookOpen,
  CheckSquare,
  ClipboardList,
  Grid2X2,
  Megaphone,
  Radio,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PATHS } from "./paths";

export const ADMIN_NAVIGATION = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: Grid2X2,
    path: PATHS.admin,
    section: "MAIN MENU",
  },
  {
    key: "incident-reports",
    label: "Incident Reports",
    icon: ClipboardList,
    path: PATHS.adminIncidentReports,
  },
  { key: "dispatch", label: "Dispatch Responders", icon: Radio, path: PATHS.adminDispatch },
  {
    key: "maintenance-tasks",
    label: "Maintenance Tasks",
    icon: ShieldCheck,
    path: PATHS.adminMaintenanceTasks,
  },
  {
    key: "resolution-verification",
    label: "Resolution & Verification",
    icon: CheckSquare,
    path: PATHS.adminResolutionVerification,
  },
  {
    key: "announcements",
    label: "Announcements & Broadcasts",
    icon: Megaphone,
    path: PATHS.adminAnnouncements,
  },
  {
    key: "accomplishment-log",
    label: "Accomplishment Log",
    icon: BookOpen,
    path: PATHS.adminAccomplishmentLog,
  },
  {
    key: "residents",
    label: "Residents & Access",
    icon: Users,
    path: PATHS.adminResidents,
  },
  {
    key: "registrations",
    label: "Registrations",
    icon: ShieldCheck,
    path: PATHS.adminRegistrations,
  },
  {
    key: "reports-analytics",
    label: "Reports & Analytics",
    icon: BarChart3,
    path: PATHS.adminReportsAnalytics,
  },
  {
    key: "settings",
    label: "Settings & Configuration",
    icon: Settings,
    path: PATHS.adminSettings,
    section: "UTILITIES",
  },
];
