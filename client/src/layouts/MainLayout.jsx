import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LandingHeader from "../features/landing/components/LandingHeader";
import LandingFooter from "../features/landing/components/LandingFooter";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import { PATHS } from "../router/paths";

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [headerReportRequest, setHeaderReportRequest] = useState(0);
  const handleReportClick = () => {
    if (location.pathname === PATHS.home || location.pathname === PATHS.publicMap) {
      setHeaderReportRequest((request) => request + 1);
      return;
    }
    navigate(PATHS.publicMap);
  };

  return (
    <div className="public-app-shell">
      <LandingHeader onReportClick={handleReportClick} />
      <BarangayStatusBanner />
      <main className="public-app-main">
        <Outlet context={{ headerReportRequest }} />
      </main>
      <LandingFooter />
    </div>
  );
}
