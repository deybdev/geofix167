import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../shared/hooks/useAuth";

const ROLES = [
  { key: "admin", label: "Admin", path: "/admin" },
  { key: "responder", label: "Responder", path: "/responder" },
  { key: "resident", label: "Resident", path: "/resident" },
];

export default function LoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  function handleRoleSelect(role) {
    signIn(role.key);
    navigate(role.path, { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Link
        to="/"
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="mb-2 text-center">
          <h1 className="text-2xl font-semibold text-primary">Select Role</h1>
          <p className="mt-1 text-sm text-muted-foreground">Continue as one of the following</p>
        </div>
        {ROLES.map((role) => (
          <button
            key={role.key}
            onClick={() => handleRoleSelect(role)}
            className="w-full rounded-md border border-input bg-background px-4 py-3 text-left font-medium text-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {role.label}
          </button>
        ))}
      </div>
    </main>
  );
}
