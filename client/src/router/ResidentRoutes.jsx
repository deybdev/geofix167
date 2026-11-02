import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import ResidentLayout from "../layouts/ResidentLayout";
import ResidentDashboard from "../features/resident/ResidentDashboard";

export const residentRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["resident"]} />}>
    <Route path={PATHS.resident} element={<ResidentLayout />}>
      <Route index element={<ResidentDashboard />} />
    </Route>
  </Route>
);