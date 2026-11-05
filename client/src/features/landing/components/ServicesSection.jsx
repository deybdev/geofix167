import {
  MapPin,
  Flame,
  Wrench,
  ShieldCheck,
  Smartphone,
  Eye,
  CheckCircle,
} from "lucide-react";

export default function ServicesSection() {
  const services = [
    {
      icon: MapPin,
      badge: "Geotagging",
      badgeColor: "bg-emerald-100 text-emerald-800",
      title: "Geotagged Incident Reporting",
      desc: "Pin issues directly on the digital map of Barangay 167 with GPS coordinates and photographic evidence.",
    },
    {
      icon: Flame,
      badge: "Emergency",
      badgeColor: "bg-red-100 text-red-800",
      title: "Sudden Emergency Dispatch",
      desc: "Instant routing and prioritization for fires, sudden medical emergencies, road accidents, and public security incidents.",
    },
    {
      icon: Wrench,
      badge: "Public Works",
      badgeColor: "bg-amber-100 text-amber-800",
      title: "Infrastructure Maintenance",
      desc: "Systematic logging and dispatch for clogged drainage, unlit streetlights, roadway potholes, and electrical cable hazards.",
    },
    {
      icon: ShieldCheck,
      badge: "Transparency",
      badgeColor: "bg-blue-100 text-blue-800",
      title: "Verified Accomplishment Proof",
      desc: "Barangay officers and maintenance crews upload post-resolution evidence with QR verification and time-stamped proof.",
    },
  ];

  return (
    <section id="services" className="py-16 sm:py-20 bg-slate-50 border-t border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
            Barangay 167 Core Capabilities
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Engineered for Response, Safety, & Transparency
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            A comprehensive unified platform connecting citizens, barangay leadership, and emergency personnel.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((svc, i) => {
            const Icon = svc.icon;
            return (
              <div
                key={i}
                className="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-[#2E8B57] hover:shadow-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-[#2E8B57] group-hover:bg-[#2E8B57] group-hover:text-white transition-colors">
                    <Icon size={24} />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${svc.badgeColor}`}>
                    {svc.badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-[#2E8B57] transition-colors">
                  {svc.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {svc.desc}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

