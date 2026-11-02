import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import ResponderLayout from "../layouts/ResponderLayout";
import ResponderDashboard from "../features/responder/ResponderDashboard";

export const responderRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["responder"]} />}>
    <Route path={PATHS.responder} element={<ResponderLayout />}>
      <Route index element={<ResponderDashboard />} />
    </Route>
  </Route>
);