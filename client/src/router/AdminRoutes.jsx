import AccomplishmentsLayout from "../features/admin/accomplishments/AccomplishmentsLayout";
import BdrrmoCompletedTasks from "../features/admin/accomplishments/BdrrmoCompletedTasks";
import { Navigate, Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import MapPage from "../shared/components/MapPage";
import AdminDashboard from "../features/admin/AdminDashboard";
import Announcements from "../features/admin/Announcements";
import MaintenanceTasks from "../features/admin/MaintenanceTasks";
import ResolutionVerification from "../features/admin/ResolutionVerification";
import AccomplishmentLog from "../features/admin/AccomplishmentLog";
import Residents from "../features/admin/Residents";
import ReportsAnalytics from "../features/admin/ReportsAnalytics";
import AdminSettings from "../features/admin/Settings";
import AdminDispatch from "../features/admin/AdminDispatch";
import RegistrationReview from "../features/admin/RegistrationReview";
import IncidentReportPrint from "../features/admin/IncidentReportPrint";

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
      <Route path="incident-reports" element={<Navigate to={PATHS.adminMaintenanceTasks} replace />} />
      <Route path="incident-reports/:id/report" element={<IncidentReportPrint />} />
      <Route path="dispatch" element={<AdminDispatch />} />
      <Route path="maintenance-tasks" element={<MaintenanceTasks />} />
      <Route path="resolution-verification" element={<ResolutionVerification />} />
      <Route path="accomplishment-log" element={<Navigate to={PATHS.adminAccomplishmentLog} replace />} />
      <Route path="accomplishments" element={<AccomplishmentsLayout />}>
        <Route index element={<AccomplishmentLog />} />
        <Route path="bdrrmo" element={<BdrrmoCompletedTasks />} />
      </Route>
      <Route path="residents" element={<Residents />} />
      <Route path="registrations" element={<RegistrationReview />} />
      <Route path="reports-analytics" element={<ReportsAnalytics />} />
      <Route path="settings" element={<AdminSettings />} />
    </Route>
    {/* Full-page map opened from embedded maps (dashboard, reports, etc.) */}
    <Route path={PATHS.adminMapView} element={<MapPage backPath={PATHS.admin} />} />
  </Route>
);
