import { LoaderCircle } from "lucide-react";

export default function AuthLoading({ label = "Processing…", className = "" }) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center justify-center gap-2 ${className}`}>
      <LoaderCircle aria-hidden="true" size={17} className="animate-spin motion-reduce:animate-none" />
      <span>{label}</span>
    </span>
  );
}
