import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, RefreshCw } from "lucide-react";
import Logo from "../../shared/components/Logo";
import { Button, buttonVariants } from "../../shared/components/ui/button";
import { useState } from "react";
import { useAuth } from "../../shared/hooks/useAuth";
import { getRoleHome } from "../../router/roleAccess";

export default function ErrorPage({ code, eyebrow, title, description, icon: Icon, retry = false, homePath = "/home", accessRecovery = false }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dashboardPath = getRoleHome(user?.role);
  const destination = accessRecovery ? (user ? dashboardPath : "/login") : homePath;
  const switchAccount = async () => {
    setBusy(true);
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10" aria-labelledby="error-title">
        <Logo showCard={false} className="[&>img]:h-10 [&>h1]:mt-2 [&>h1]:text-xl [&>p]:text-[11px]" />
        <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" size={32} strokeWidth={1.8} />
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">{code ? `Error ${code}` : eyebrow}</p>
        <h1 id="error-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          {retry && <Button type="button" onClick={() => window.location.reload()} className="h-11 gap-2"><RefreshCw size={17} />Try again</Button>}
          {!accessRecovery && <Button type="button" variant={retry ? "outline" : "default"} onClick={() => navigate(-1)} className="h-11 gap-2"><ArrowLeft size={17} />Go back</Button>}
          {destination && <Link to={destination} replace={accessRecovery} className={buttonVariants({ variant: "outline", className: "h-11 gap-2" })}><Home size={17} />{accessRecovery ? (user ? "Return to dashboard" : "Sign in") : "Return home"}</Link>}
          {accessRecovery && user && <Button type="button" disabled={busy} onClick={switchAccount} className="h-11">{busy ? "Signing out…" : "Switch account"}</Button>}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>
    </main>
  );
}
