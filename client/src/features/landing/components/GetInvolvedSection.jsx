import { useNavigate } from "react-router-dom";
import { MapPin, Shield, Briefcase, ChevronRight } from "lucide-react";
import { PATHS } from "../../../router/paths";

export default function GetInvolvedSection({
  onQuickReportClick,
  onAccomplishmentClick,
}) {
  const navigate = useNavigate();

  return (
    <section className="py-10 bg-slate-50/70 border-y border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading matching screenshot */}
        <div className="text-center mb-7">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Get Involved
          </h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Take part in making Barangay 167 safer, cleaner, and faster to respond
          </p>
        </div>

        {/* 3 Prominent Action Cards matching screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          
          {/* Button 1: SUBMIT A GEOTAGGED REPORT (Citizen/Guest) */}
          <button
            type="button"
            onClick={onQuickReportClick}
            className="group relative flex items-center justify-center gap-3.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#d97706] p-4.5 text-white shadow-lg shadow-orange-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-orange-600/30 active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
              <MapPin size={22} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-extrabold tracking-wide uppercase leading-tight">
                Submit a Geotagged Report
              </p>
              <p className="text-xs font-semibold text-orange-100 mt-0.5">
                (Citizen / Guest)
              </p>
            </div>
          </button>

          {/* Button 2: BDRRMO & OFFICIALS DASHBOARD */}
          <button
            type="button"
            onClick={() => navigate(PATHS.adminLogin)}
            className="group relative flex items-center justify-center gap-3.5 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#0284c7] p-4.5 text-white shadow-lg shadow-blue-700/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-blue-700/30 active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
              <Shield size={22} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-extrabold tracking-wide uppercase leading-tight">
                BDRRMO & Officials Dashboard
              </p>
              <p className="text-xs font-semibold text-sky-100 mt-0.5">
                (Authorized Personnel Login)
              </p>
            </div>
          </button>

          {/* Button 3: VIEW PUBLIC ACCOMPLISHMENT LOG */}
          <button
            type="button"
            onClick={onAccomplishmentClick}
            className="group relative flex items-center justify-center gap-3.5 rounded-xl border-2 border-slate-300 bg-white p-4.5 text-slate-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2E8B57] hover:bg-emerald-50/30 hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-[#2E8B57] group-hover:text-white transition-colors">
              <Briefcase size={22} />
            </div>
            <div className="text-left">
              <p className="text-sm font-extrabold tracking-wide uppercase leading-tight">
                View Public Accomplishment Log
              </p>
              <p className="text-xs font-semibold text-slate-500 group-hover:text-[#2E8B57] mt-0.5">
                (Transparency Portal)
              </p>
            </div>
          </button>

        </div>

      </div>
    </section>
  );
}

