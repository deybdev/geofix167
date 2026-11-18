import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";
import { PATHS } from "./paths";
import { getRoleHome } from "./roleAccess";


export default function GuestRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (user) {
    return <Navigate to={getRoleHome(user.role) ?? PATHS.forbidden} replace />;
  }

  return <Outlet />;
}
