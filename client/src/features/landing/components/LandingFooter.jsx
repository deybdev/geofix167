import { Phone, Mail, Globe, Shield, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { PATHS } from "../../../router/paths";

export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10 text-xs text-slate-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Row: Matching the 3 columns in Screenshot */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          
          {/* Left: Contact Info & Socials */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Phone size={14} className="text-[#2E8B57]" />
              <span>Contact: 668-338-3141</span>
            </div>

            <div className="hidden sm:block h-3.5 w-px bg-slate-300" />

            <div className="flex items-center gap-3">
              {/* Facebook */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-600 hover:text-[#2E8B57] transition font-medium"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2] text-white font-bold text-[10px]">
                  f
                </span>
                <span>GeoFix</span>
              </a>

              {/* Twitter / X */}
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-600 hover:text-[#2E8B57] transition font-medium"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white font-bold text-[9px]">
                  𝕏
                </span>
              </a>

              {/* LinkedIn */}
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-600 hover:text-[#2E8B57] transition font-medium"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-[#0A66C2] text-white font-bold text-[9px]">
                  in
                </span>
              </a>
            </div>
          </div>

          {/* Center: SDG 11 Sustainable Cities and Communities */}
          <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-amber-900 shadow-sm">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FD9D24] text-white font-black text-[10px]">
              11
            </span>
            <span className="font-extrabold tracking-tight">
              SDG 11: Sustainable Cities and Communities
            </span>
          </div>

          {/* Right: Developed by Researchers */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-slate-500 font-medium">
            <span>Developed by Researchers</span>
            <span className="hidden sm:inline">·</span>
            <span>Barangay 167 Capstone</span>
          </div>

        </div>

        {/* Sub-footer Links */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} GeoFix 167. All rights reserved. Barangay 167, Caloocan City, Philippines.</p>
          <div className="flex items-center gap-4">
            <Link to={PATHS.privacy} className="hover:text-slate-600 underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            <Link to={PATHS.terms} className="hover:text-slate-600 underline-offset-2 hover:underline">
              Terms of Service
            </Link>
            <Link to={PATHS.adminLogin} className="hover:text-[#2E8B57] font-semibold">
              Admin Portal
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}

