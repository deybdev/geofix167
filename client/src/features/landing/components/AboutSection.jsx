import { MapPin, Target, Sparkles, Compass, CheckCircle } from "lucide-react";
import logoImg from "../../../assets/images/logo.png";

export default function AboutSection() {
  const highlights = [
    {
      title: "Real-time Geotagged Accuracy",
      desc: "Sub-meter incident pinning within official Barangay 167 boundaries prevents false alarms and navigation delays.",
    },
    {
      title: "Direct BDRRMO Dispatch Integration",
      desc: "Emergency alerts instantly route to barangay tanods, medical responders, and municipal maintenance crews.",
    },
    {
      title: "Verified QR & Photographic Proof",
      desc: "Every resolved incident ticket requires time-stamped photo verification and barangay official endorsement.",
    },
    {
      title: "Citizen-First Accessibility",
      desc: "Both registered residents and walk-in citizens can report hazards and view active community safety status.",
    },
  ];

  return (
    <section id="about" className="py-16 sm:py-20 bg-white">
      <div className="w-full px-4 sm:px-8 lg:px-10 xl:px-12">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Story & Mission */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#2E8B57] mb-4">
              <Compass size={14} />
              <span>About Barangay 167 Capstone Project</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Smarter, Safer, & Faster Incident Response for{" "}
              <span className="text-[#2E8B57]">Barangay 167</span>
            </h2>

            <p className="mt-4 text-base text-slate-600 leading-relaxed">
              <strong>GeoFix 167</strong> is an academic capstone research system engineered specifically for Barangay 167 (Caloocan City). Spanning a land area of 2.87 sq. kilometers, dense residential neighborhoods along Molave, Sampaguita, Prosera, and Llano roads face recurrent challenges in reporting sudden emergencies and chronic infrastructure defects.
            </p>

            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              By replacing delayed telephone chains and manual logs with interactive geospatial mapping, live status synchronization, and proof-of-resolution verification, GeoFix 167 empowers barangay officials and residents to collaborate transparently.
            </p>

            {/* Feature Checklist */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2E8B57] text-white">
                    <CheckCircle size={13} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                    <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Visual Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-8 shadow-xl">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-1 ring-slate-900/5">
                  <img src={logoImg} alt="GeoFix 167" className="h-20 w-20 object-contain" />
                </div>

                <h3 className="mt-5 text-2xl font-black tracking-tight text-[#2E8B57]">
                  GeoFix 167
                </h3>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">
                  Barangay 167, Caloocan City
                </p>

                <div className="my-5 h-px w-24 bg-slate-200" />

                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center justify-between rounded-lg bg-white p-3 text-xs font-semibold shadow-sm border border-slate-100">
                    <span className="text-slate-500">Jurisdiction:</span>
                    <span className="text-slate-900 font-bold">Caloocan District 3</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white p-3 text-xs font-semibold shadow-sm border border-slate-100">
                    <span className="text-slate-500">Service Area:</span>
                    <span className="text-slate-900 font-bold">2.87 sq. km (Barangay 167)</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white p-3 text-xs font-semibold shadow-sm border border-slate-100">
                    <span className="text-slate-500">Lead Responders:</span>
                    <span className="text-emerald-700 font-bold">BDRRMO & Barangay Tanod</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white p-3 text-xs font-semibold shadow-sm border border-slate-100">
                    <span className="text-slate-500">Target SDG:</span>
                    <span className="text-slate-900 font-bold">SDG 11: Sustainable Communities</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

