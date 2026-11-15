import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import MapPage from "../shared/components/MapPage";
import AdminDashboard from "../features/admin/AdminDashboard";
import Announcements from "../features/admin/Announcements";
import IncidentReports from "../features/admin/IncidentReports";
import MaintenanceTasks from "../features/admin/MaintenanceTasks";
import ResolutionVerification from "../features/admin/ResolutionVerification";
import AccomplishmentLog from "../features/admin/AccomplishmentLog";
import Residents from "../features/admin/Residents";
import ReportsAnalytics from "../features/admin/ReportsAnalytics";
import AdminSettings from "../features/admin/Settings";
import AdminDispatch from "../features/admin/AdminDispatch";
import RegistrationReview from "../features/admin/RegistrationReview";

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
      <Route path="announcements" element={<Announcements />} />
      <Route path="incident-reports" element={<IncidentReports />} />
      <Route path="dispatch" element={<AdminDispatch />} />
      <Route path="maintenance-tasks" element={<MaintenanceTasks />} />
      <Route path="resolution-verification" element={<ResolutionVerification />} />
      <Route path="accomplishment-log" element={<AccomplishmentLog />} />
      <Route path="residents" element={<Residents />} />
      <Route path="registrations" element={<RegistrationReview />} />
      <Route path="reports-analytics" element={<ReportsAnalytics />} />
      <Route path="settings" element={<AdminSettings />} />
    </Route>
    {/* Full-page map opened from embedded maps (dashboard, reports, etc.) */}
    <Route path={PATHS.adminMapView} element={<MapPage backPath={PATHS.admin} />} />
  </Route>
);
