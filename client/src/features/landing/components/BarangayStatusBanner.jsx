import { CheckCircle2, Radio, PhoneCall } from "lucide-react";

export default function BarangayStatusBanner() {
  return (
    <div className="border-b border-emerald-100 bg-[#e8f5e9]/80 py-2.5 px-4 text-center transition-colors">
      <div className="flex w-full flex-wrap items-center justify-center gap-x-8 gap-y-1 text-xs px-2">
        <div className="flex items-center gap-2 font-semibold text-[#1e6b37]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#16a34a]"></span>
          </span>
          <CheckCircle2 size={15} className="text-[#16a34a]" />
          <span>Barangay 167 Online.</span>
        </div>

        <div className="hidden items-center gap-1.5 text-slate-600 sm:flex">
          <Radio size={13} className="text-emerald-700 animate-pulse" />
          <span>BDRRMO Emergency Dispatch active 24/7</span>
        </div>

        <div className="hidden items-center gap-1 font-medium text-slate-700 md:flex">
          <PhoneCall size={12} className="text-emerald-700" />
          <span>Emergency Hotline: <strong className="text-slate-900 font-bold">668-338-3141</strong></span>
        </div>
      </div>
    </div>
  );
}

