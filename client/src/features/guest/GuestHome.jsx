import { useNavigate, Link } from "react-router-dom";
import { Map, Siren } from "lucide-react";

import { Button } from "../../shared/components/ui/button";
import { PATHS } from "../../router/paths";

export default function GuestHome() {
  const navigate = useNavigate();

  return (
    <div className="mt-7 flex flex-col">
      <div className="flex flex-col items-center gap-1.5">
        <h2 className="text-[22px] font-bold leading-7 text-primary">
          You&apos;re browsing as a guest
        </h2>

        <p className="max-w-[320px] text-center text-[13px] leading-5 text-slate-500">
          Report an emergency using your GPS location and a photo or video
          from your camera — no account needed. Sign up to unlock tracking and
          infrastructure reports.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-5">
        <Button
          type="button"
          onClick={() => navigate(PATHS.guestReport)}
          className="h-12 w-full rounded-lg bg-red-600 text-sm font-semibold text-white shadow-lg shadow-red-600/25 transition-colors hover:bg-red-700 focus-visible:ring-red-600/20 sm:h-11"
        >
          <Siren size={18} />
          Report an Emergency
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(PATHS.guestMap)}
          className="h-12 w-full rounded-lg border-slate-200 text-sm font-semibold text-primary transition-colors hover:bg-slate-50 sm:h-11"
        >
          <Map size={18} />
          Explore the Map
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(PATHS.login)}
          className="h-10 w-full rounded-lg text-sm font-semibold text-slate-500 hover:text-primary"
        >
          Log In
        </Button>
      </div>

      <p className="mt-2 text-center text-[13px] leading-5 text-slate-500">
        New here?{" "}
        <Link
          to={PATHS.register}
          className="font-semibold text-primary hover:underline"
        >
          Create Account
        </Link>
      </p>
    </div>
  );
}
