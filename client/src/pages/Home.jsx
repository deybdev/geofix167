import { Link } from "react-router-dom";
import { MapPin, ArrowRight, Bell, Wrench, Route } from "lucide-react";

const FEATURES = [
  { icon: MapPin,  title: "Geotagged Reports",   desc: "Pin incidents directly on the Barangay 167 map with photo evidence." },
  { icon: Bell,    title: "Instant Alerts",       desc: "Critical reports auto-notify the nearest response team in real time." },
  { icon: Route,   title: "Emergency Routing",    desc: "Fastest route to the scene, extending to the nearest hospital if needed." },
  { icon: Wrench,  title: "Infrastructure Fixes", desc: "Track potholes, broken lights, and clogged drains from report to resolution." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">

      {/* Nav */}
      <nav className="fixed inset-x-0 top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/80 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2 font-bold text-[#2E8B57]">
          <MapPin size={20} /> GeoFix 167
        </div>
        <Link
          to="/login"
          className="rounded-lg bg-[#2E8B57] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 pt-16 text-center">
        <span className="mb-4 rounded-full border border-[#2E8B57]/30 bg-[#2E8B57]/10 px-3 py-1 text-xs font-medium text-[#2E8B57]">
          Barangay 167 · Caloocan · Community Safety Platform
        </span>

        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          Report. Dispatch.{" "}
          <span className="text-[#2E8B57]">Resolve.</span>
        </h1>

        <p className="mt-5 max-w-lg text-lg text-gray-500">
          GeoFix 167 connects residents with emergency responders and maintenance
          teams through one geotagged platform — from incident report to resolution.
        </p>

        <Link
          to="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#2E8B57] px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#2E8B57]/30 hover:opacity-90"
        >
          Get started <ArrowRight size={16} />
        </Link>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-10 text-center text-2xl font-bold">What GeoFix 167 does</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <Icon size={22} className="mb-3 text-[#2E8B57]" />
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} GeoFix 167 · Barangay 167, Caloocan City
      </footer>
    </div>
  );
}
