import { Component } from "react";
import { ServerCrash, RefreshCw, Home } from "lucide-react";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error, details) {
    console.error("Unhandled GeoFix interface error", error, details);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" role="alert">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ServerCrash aria-hidden="true" size={32} /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-primary">GeoFix recovery</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">The page encountered an unexpected problem. Reload it to continue, or return home.</p>
          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" onClick={() => window.location.reload()} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white"><RefreshCw size={17} />Reload page</button>
            <a href="/home" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-primary"><Home size={17} />Return home</a>
          </div>
        </section>
      </main>
    );
  }
}
