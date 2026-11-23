import { Route } from "react-router-dom";
import { PATHS } from "./paths";
import ProtectedRoute from "../shared/components/ProtectedRoute";
import BdrrmoLayout from "../layouts/BdrrmoLayout";
import BdrrmoDashboard from "../features/bdrrmo/BdrrmoDashboard";
import BdrrmoWorkspace from "../features/bdrrmo/BdrrmoWorkspace";

export const bdrrmoRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["bdrrmo"]} />}>
    <Route path={PATHS.bdrrmo} element={<BdrrmoLayout />}>
      <Route index element={<BdrrmoDashboard />} />
      <Route path="incidents" element={<BdrrmoWorkspace view="incidents" />} />
      <Route path="dispatch-responders" element={<BdrrmoWorkspace view="dispatch" />} />
      <Route path="handover-completion" element={<BdrrmoWorkspace view="handover" />} />
      <Route path="reports-analytics" element={<BdrrmoWorkspace view="analytics" />} />
      <Route path="settings" element={<BdrrmoWorkspace view="settings" />} />
    </Route>
  </Route>
);
