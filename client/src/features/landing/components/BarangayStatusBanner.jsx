import HotlineLink from "../../../shared/components/HotlineLink";
import { CheckCircle2, Radio, PhoneCall } from "lucide-react";

export default function BarangayStatusBanner() {
  return (
    <div className="landing-status border-b py-2 px-4 text-center">
      <div className="site-container flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs">
        <div className="flex items-center gap-2 font-semibold text-[#1e6b37]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2f7550]"></span>
          </span>
          <CheckCircle2 size={15} className="text-[#16a34a]" />
          <span>Barangay 167 Online.</span>
        </div>

        <div className="hidden items-center gap-1.5 text-slate-600 sm:flex">
          <Radio size={13} className="text-emerald-700" />
          <span>BDRRMO Emergency Dispatch active 24/7</span>
        </div>

        <div className="hidden items-center gap-1 font-medium text-slate-700 md:flex">
          <PhoneCall size={12} className="text-emerald-700" />
          <span>Emergency Hotline: <strong className="text-slate-900 font-bold"><HotlineLink /></strong></span>
        </div>
      </div>
    </div>
  );
}

