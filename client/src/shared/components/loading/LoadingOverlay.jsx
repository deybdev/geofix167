import { useEffect, useState } from "react";
import GeoFixLoader from "./GeoFixLoader";

function ActiveLoadingOverlay({ message }) {
  const [elapsed, setElapsed] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const detail = !online
    ? "Your connection was interrupted. We’ll continue when you’re back online."
    : elapsed >= 15000
      ? "Your connection is slow. Please keep this page open."
      : elapsed >= 5000
        ? "This is taking longer than usual. Please keep this page open."
        : "Please don’t close or refresh this page.";

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-white/90 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={message}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <GeoFixLoader message={message} detail={detail} />
      </div>
    </div>
  );
}

export default function LoadingOverlay({ open, message = "Processing…" }) {
  return open ? <ActiveLoadingOverlay message={message} /> : null;
}
