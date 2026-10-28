
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function Unauthorized() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <ShieldAlert className="mx-auto mb-4 text-primary" size={48} />

        <p className="text-sm font-medium uppercase tracking-wider text-primary">
          Access Restricted
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-foreground">
          Access denied
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          You don't have permission to view this page. Please return to your
          dashboard or contact your administrator.
        </p>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <ArrowLeft size={16} />
          Return home
        </Link>
      </div>
    </main>
  );
}
