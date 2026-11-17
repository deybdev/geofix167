import {
  MapPin,
  Flame,
  Wrench,
  ShieldCheck,
} from "lucide-react";

export default function ServicesSection() {
  const services = [
    {
      icon: MapPin,
      badge: "Geotagging",
      badgeColor: "bg-[#e5efe6] text-[#174b37]",
      title: "Geotagged Incident Reporting",
      desc: "Pin issues directly on the digital map of Barangay 167 with GPS coordinates and photographic evidence.",
    },
    {
      icon: Flame,
      badge: "Emergency",
      badgeColor: "bg-[#f9e8e5] text-[#9f241b]",
      title: "Sudden Emergency Dispatch",
      desc: "Instant routing and prioritization for fires, sudden medical emergencies, road accidents, and public security incidents.",
    },
    {
      icon: Wrench,
      badge: "Public Works",
      badgeColor: "bg-[#e5efe6] text-[#174b37]",
      title: "Infrastructure Maintenance",
      desc: "Systematic logging and dispatch for clogged drainage, unlit streetlights, roadway potholes, and electrical cable hazards.",
    },
    {
      icon: ShieldCheck,
      badge: "Transparency",
      badgeColor: "bg-[#e5efe6] text-[#174b37]",
      title: "Verified Accomplishment Proof",
      desc: "Barangay officers and maintenance crews upload post-resolution evidence with QR verification and time-stamped proof.",
    },
  ];

  return (
    <section id="services" className="landing-section landing-section--tint border-t">
      <div className="site-container">
        
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="rounded-md bg-[#e5efe6] px-3 py-1 text-xs font-semibold text-[#174b37] uppercase tracking-wide">
            Barangay 167 Core Capabilities
          </span>
          <h2 className="landing-display mt-3 text-3xl sm:text-4xl">
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
                className="landing-card group relative p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e5efe6] text-[#174b37] transition-colors group-hover:bg-[#174b37] group-hover:text-white">
                    <Icon size={24} />
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${svc.badgeColor}`}>
                    {svc.badge}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-[#1b2821] group-hover:text-[#174b37] transition-colors">
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

