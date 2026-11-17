import { useNavigate } from "react-router-dom";
import { MapPin, Shield, Briefcase } from "lucide-react";
import { PATHS } from "../../../router/paths";

export default function GetInvolvedSection({
  onQuickReportClick,
  onAccomplishmentClick,
}) {
  const navigate = useNavigate();

  return (
    <section className="landing-section landing-section--paper border-y">
      <div className="site-container">
        
        {/* Section Heading matching screenshot */}
        <div className="text-center mb-7">
          <h2 className="landing-display text-2xl sm:text-3xl">
            Get Involved
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Take part in making Barangay 167 safer, cleaner, and faster to respond
          </p>
        </div>

        {/* 3 Prominent Action Cards matching screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          
          {/* Button 1: SUBMIT A GEOTAGGED REPORT (Citizen/Guest) */}
          <button
            type="button"
            onClick={onQuickReportClick}
            className="landing-action-card group"
          >
            <div className="landing-action-icon landing-action-icon--urgent">
              <MapPin size={21} />
            </div>
            <div className="text-left">
              <p className="leading-tight">
                Submit a Geotagged Report
              </p>
              <p className="mt-1 text-xs">
                (Citizen / Guest)
              </p>
            </div>
          </button>

          {/* Button 2: BDRRMO & OFFICIALS DASHBOARD */}
          <button
            type="button"
            onClick={() => navigate(PATHS.adminLogin)}
            className="landing-action-card group"
          >
            <div className="landing-action-icon">
              <Shield size={21} />
            </div>
            <div className="text-left">
              <p className="leading-tight">
                BDRRMO & Officials Dashboard
              </p>
              <p className="mt-1 text-xs">
                (Authorized Personnel Login)
              </p>
            </div>
          </button>

          {/* Button 3: VIEW PUBLIC ACCOMPLISHMENT LOG */}
          <button
            type="button"
            onClick={onAccomplishmentClick}
            className="landing-action-card group"
          >
            <div className="landing-action-icon">
              <Briefcase size={22} />
            </div>
            <div className="text-left">
              <p className="leading-tight">
                View Public Accomplishment Log
              </p>
              <p className="mt-1 text-xs">
                (Transparency Portal)
              </p>
            </div>
          </button>

        </div>

      </div>
    </section>
  );
}

