
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider } from "../shared/context/AuthProvider";
import ProtectedRoute from "../shared/components/ProtectedRoute";

import Login from "../features/auth/Login";
import Register from "../features/auth/Register";
import VerificationCode from "../features/auth/VerifyCode";
import ChangeMobile from "../features/auth/ChangeMobile";
import ForgotPassword from "../features/auth/ForgotPassword";
import PasswordResetOtp from "../features/auth/PasswordResetOtp";
import AdminLogin from "../features/auth/AdminLogin";
import HomePage from "../pages/Home";
import NotFoundPage from "../pages/NotFound";
import UnauthorizedPage from "../pages/Unauthorized";
import TestPage from "../pages/Test";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import TermsOfService from "../pages/TermsOfService";

import ResidentLayout from "../layouts/ResidentLayout";
import AdminLayout from "../layouts/AdminLayout";
import ResponderLayout from "../layouts/ResponderLayout";
import AuthLayout from "../layouts/AuthLayout";

import ResidentDashboard from "../features/resident/Home";
import AdminDashboard from "../features/admin/AdminDashboard";
import IncidentReports from "../features/admin/IncidentReports";
import MaintenanceTasks from "../features/admin/MaintenanceTasks";
import ResolutionVerification from "../features/admin/ResolutionVerification";
import AccomplishmentLog from "../features/admin/AccomplishmentLog";
import Residents from "../features/admin/Residents";
import ReportsAnalytics from "../features/admin/ReportsAnalytics";
import AdminSettings from "../features/admin/Settings";
import ResponderDashboard from "../features/responder/ResponderDashboard";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<HomePage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/test" element={<TestPage />} />
          <Route
            path="/unauthorized"
            element={<UnauthorizedPage />}
          />

          {/* Auth pages (shared AuthLayout) */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/change-mobile" element={<ChangeMobile />} />
            <Route path="/verify" element={<VerificationCode />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<PasswordResetOtp />} />
          </Route>

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
              <ProtectedRoute allowedRoles={["admin"]} loginPath="/admin/login" />
            }
          >
            <Route path="/admin" element={<AdminLayout />}>
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
