import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../shared/hooks/useAuth";

const ResponderLayout = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-medium">GeoFix 167 — Responder</span>
        <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:text-foreground">
          Sign out
        </button>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default ResponderLayout;
