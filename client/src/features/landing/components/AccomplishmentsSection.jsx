import { CheckCircle2, ShieldCheck, QrCode, FileText, Clock, MapPin } from "lucide-react";
import { ACCOMPLISHMENTS, CAPSTONE_STATS } from "../data/landingData";

export default function AccomplishmentsSection() {
  return (
    <section id="accomplishments" className="py-16 sm:py-20 bg-white border-t border-slate-200/80">
      <div className="w-full px-4 sm:px-8 lg:px-10 xl:px-12">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wide">
            Public Transparency Log
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Accomplishments & Verified Resolutions
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Real results delivered by the Barangay 167 BDRRMO, Tanod Patrols, and Maintenance Units.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {CAPSTONE_STATS.map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 text-center transition-all hover:bg-emerald-50/40 hover:border-[#2E8B57]"
            >
              <p className="text-3xl sm:text-4xl font-black tracking-tight text-[#2E8B57]">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-800">
                {stat.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
                {stat.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Public Accomplishment Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Recent Public Resolution Log
              </h3>
              <p className="text-xs text-slate-500">
                All records archived with timestamped geo-coordinates and official sign-off
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              <ShieldCheck size={14} />
              <span>100% Cryptographic QR Verified</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Resolved Incident</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Response Time</th>
                  <th className="px-6 py-3.5">Verification Status</th>
                  <th className="px-6 py-3.5">Lead Personnel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {ACCOMPLISHMENTS.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-[#2E8B57] shrink-0" />
                      <span>{item.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1 text-slate-700">
                        <MapPin size={13} className="text-slate-400" />
                        {item.location}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {item.dateResolved}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                        <Clock size={11} />
                        {item.responseTime}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                        <QrCode size={12} className="text-emerald-600" />
                        {item.proofStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 font-semibold">
                      {item.officer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}

