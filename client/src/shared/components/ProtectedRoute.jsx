import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PATHS } from "../../router/paths";

export default function ProtectedRoute({ allowedRoles, loginPath = "/login" }) {
  const { user, role, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to={loginPath} replace />;

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to={PATHS.forbidden} replace />;
  }

  return <Outlet />;
}
