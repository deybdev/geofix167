import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LandingHeader from "../features/landing/components/LandingHeader";
import LandingFooter from "../features/landing/components/LandingFooter";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import { PATHS } from "../router/paths";

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const handleReportClick = () => {
    if (location.pathname === PATHS.home || location.pathname === PATHS.publicMap) {
      window.dispatchEvent(new Event("geofix:open-report"));
      return;
    }
    navigate(PATHS.publicMap);
  };

  return (
    <div className="public-app-shell">
      <LandingHeader onReportClick={handleReportClick} />
      <BarangayStatusBanner />
      <main className="public-app-main">
        <Outlet />
      </main>
      <LandingFooter />
    </div>
  );
}
