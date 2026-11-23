import {
  BarChart3,
  BookOpen,
  Grid2X2,
  Megaphone,
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
    key: "maintenance-tasks",
    label: "Maintenance Tasks",
    icon: ShieldCheck,
    path: PATHS.adminMaintenanceTasks,
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
    label: "Residents & Registration",
    icon: Users,
    path: PATHS.adminResidents,
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
