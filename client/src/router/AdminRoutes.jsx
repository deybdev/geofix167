import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import AdminDashboard from "../features/admin/AdminDashboard";

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
    </Route>
  </Route>
);