import { LogOut, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/hooks/useAuth";

export default function ResponderProfile() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 pb-5 pt-7 sm:px-7 sm:pt-9">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Responder dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary sm:text-3xl">Profile</h1>
      </header>
      <main className="space-y-4 px-4 py-5 sm:px-7 sm:py-6">
        <section className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
            R
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900">Responder</h2>
            <p className="text-sm text-slate-500">Traffic/Road Response Team A</p>
          </div>
          <UserRound className="ml-auto shrink-0 text-primary" size={24} />
        </section>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 font-bold text-primary"
        >
          <LogOut size={20} />
          Sign out
        </button>
      </main>
    </div>
  );
}
