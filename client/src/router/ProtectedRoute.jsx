import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "./paths";

export default function Protected({ allowedRoles }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to={PATHS.login} state={{ from: location }} replace />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to={PATHS.unauthorized} replace />;

  return <Outlet />;
}