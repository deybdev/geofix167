import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "./paths";

const ROLE_PATHS = {
  admin: PATHS.admin,
  tanod: PATHS.responder,
  resident: PATHS.resident,
  bdrrmo: PATHS.forbidden,
  police: PATHS.forbidden,
  fire: PATHS.forbidden,
};

export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return <Navigate to={ROLE_PATHS[user.role] ?? PATHS.home} replace />;
  }

  return <Outlet />;
}
