import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
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
    children: [
      {
        key: "barangay-accomplishments",
        label: "Barangay Accomplishments",
        icon: Award,
        path: PATHS.adminAccomplishmentLog,
      },
      {
        key: "bdrrmo-completed-tasks",
        label: "BDRRMO Completed Tasks",
        icon: ClipboardCheck,
        path: PATHS.adminBdrrmoAccomplishments,
      },
    ],
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
