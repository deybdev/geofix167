import { MapPin } from "lucide-react";

export default function GeoFixLoader({ message = "Loading…", detail }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
      <div className="relative flex h-20 w-20 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-1 rounded-full border border-primary/15 motion-safe:animate-ping" />
        <span className="absolute inset-2 rounded-full border-2 border-primary/20 border-t-primary motion-safe:animate-spin" />
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 motion-safe:animate-pulse">
          <MapPin size={27} strokeWidth={2.25} />
        </span>
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">{message}</p>
      {detail && <p className="mt-1 max-w-xs text-sm leading-5 text-slate-500">{detail}</p>}
      <span className="sr-only">Please wait.</span>
    </div>
  );
}
