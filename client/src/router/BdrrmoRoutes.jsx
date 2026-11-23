import { Route } from "react-router-dom";
import { PATHS } from "./paths";
import ProtectedRoute from "../shared/components/ProtectedRoute";
import BdrrmoLayout from "../layouts/BdrrmoLayout";
import BdrrmoDashboard from "../features/bdrrmo/BdrrmoDashboard";
import BdrrmoIncidents from "../features/bdrrmo/BdrrmoIncidents";
import BdrrmoDispatch from "../features/bdrrmo/BdrrmoDispatch";
import BdrrmoHandover from "../features/bdrrmo/BdrrmoHandover";
import BdrrmoReports from "../features/bdrrmo/BdrrmoReports";
import BdrrmoSettings from "../features/bdrrmo/BdrrmoSettings";

export const bdrrmoRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["bdrrmo"]} />}>
    <Route path={PATHS.bdrrmo} element={<BdrrmoLayout />}>
      <Route index element={<BdrrmoDashboard />} />
      <Route path="incidents" element={<BdrrmoIncidents />} />
      <Route path="dispatch-responders" element={<BdrrmoDispatch />} />
      <Route path="handover-completion" element={<BdrrmoHandover />} />
      <Route path="reports-analytics" element={<BdrrmoReports />} />
      <Route path="settings" element={<BdrrmoSettings />} />
    </Route>
  </Route>
);
