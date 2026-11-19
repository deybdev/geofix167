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
import ComingSoon from "../shared/components/ComingSoon";
import { getAdminNavigationItem } from "./adminNavigation";

function adminModule(key, Page) {
  const item = getAdminNavigationItem(key);
  return item?.comingSoon
    ? <ComingSoon title={item.label} description={item.comingSoonDescription} />
    : <Page />;
}

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
      <Route index element={adminModule("dashboard", AdminDashboard)} />
      <Route path="announcements" element={<Announcements />} />
      <Route path="incident-reports" element={<IncidentReports />} />
      <Route path="dispatch" element={<AdminDispatch />} />
      <Route path="maintenance-tasks" element={adminModule("maintenance-tasks", MaintenanceTasks)} />
      <Route path="resolution-verification" element={<ResolutionVerification />} />
      <Route path="accomplishment-log" element={adminModule("accomplishment-log", AccomplishmentLog)} />
      <Route path="residents" element={adminModule("residents", Residents)} />
      <Route path="registrations" element={adminModule("registrations", RegistrationReview)} />
      <Route path="reports-analytics" element={adminModule("reports-analytics", ReportsAnalytics)} />
      <Route path="settings" element={adminModule("settings", AdminSettings)} />
    </Route>
    {/* Full-page map opened from embedded maps (dashboard, reports, etc.) */}
    <Route path={PATHS.adminMapView} element={<MapPage backPath={PATHS.admin} />} />
  </Route>
);
