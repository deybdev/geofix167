import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import AdminDashboard from "../features/admin/AdminDashboard";
import IncidentReports from "../features/admin/IncidentReports";
import MaintenanceTasks from "../features/admin/MaintenanceTasks";
import ResolutionVerification from "../features/admin/ResolutionVerification";
import AccomplishmentLog from "../features/admin/AccomplishmentLog";
import Residents from "../features/admin/Residents";
import ReportsAnalytics from "../features/admin/ReportsAnalytics";
import AdminSettings from "../features/admin/Settings";

export const adminRoutes = (
  <Route
    element={
      <ProtectedRoute
        allowedRoles={["admin"]}
        loginPath={PATHS.adminLogin}
      />
    }
  >
    <Route path={PATHS.admin} element={<AdminLayout />}>
      <Route index element={<AdminDashboard />} />
      <Route path="incident-reports" element={<IncidentReports />} />
      <Route path="maintenance-tasks" element={<MaintenanceTasks />} />
      <Route path="resolution-verification" element={<ResolutionVerification />} />
      <Route path="accomplishment-log" element={<AccomplishmentLog />} />
      <Route path="residents" element={<Residents />} />
      <Route path="reports-analytics" element={<ReportsAnalytics />} />
      <Route path="settings" element={<AdminSettings />} />
    </Route>
  </Route>
);