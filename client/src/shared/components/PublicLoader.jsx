export default function PublicLoader({ label = "Loading…", compact = false }) {
  return <div className={`public-loader ${compact ? "is-compact" : ""}`} role="status" aria-live="polite">
    <span className="public-loader__spinner" aria-hidden="true" />
    <span>{label}</span>
  </div>;
}
