
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "../shared/context/AuthProvider";
import ProtectedRoute from "../shared/components/ProtectedRoute";

import LoginForm from "../features/auth/LoginForm";
import HomePage from "../pages/Home";
import NotFoundPage from "../pages/NotFound";
import UnauthorizedPage from "../pages/Unauthorized";

import ResidentLayout from "../layouts/ResidentLayout";
import AdminLayout from "../layouts/AdminLayout";
import ResponderLayout from "../layouts/ResponderLayout";

import ResidentDashboard from "../features/resident/ResidentDashboard";
import AdminDashboard from "../features/admin/AdminDashboard";
import ResponderDashboard from "../features/responder/ResponderDashboard";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginForm />} />
          <Route
            path="/unauthorized"
            element={<UnauthorizedPage />}
          />

          {/* Any authenticated user */}
          <Route element={<ProtectedRoute />}>
            <Route path="/resident" element={<ResidentLayout />}>
              <Route
                index
                element={<ResidentDashboard />}
              />
            </Route>
          </Route>

          {/* Admin only */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["admin"]} />
            }
          >
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
            </Route>
          </Route>

          {/* Responder only */}
          <Route
            element={
              <ProtectedRoute allowedRoles={["responder"]} />
            }
          >
            <Route
              path="/responder"
              element={<ResponderLayout />}
            >
              <Route
                index
                element={<ResponderDashboard />}
              />
            </Route>
          </Route>

          {/* Unknown URLs */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
