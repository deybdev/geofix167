import { memo, useCallback, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LandingHeader from "../features/landing/components/LandingHeader";
import LandingFooter from "../features/landing/components/LandingFooter";
import BarangayStatusBanner from "../features/landing/components/BarangayStatusBanner";
import { PATHS } from "../router/paths";

const SharedLandingHeader = memo(LandingHeader);
const SharedLandingFooter = memo(LandingFooter);
const SharedStatusBanner = memo(BarangayStatusBanner);

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(location.pathname);

  useLayoutEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const handleReportClick = useCallback(() => {
    if (pathnameRef.current === PATHS.home || pathnameRef.current === PATHS.publicMap) {
      window.dispatchEvent(new Event("geofix:open-report"));
      return;
    }
    navigate(PATHS.publicMap);
  }, [navigate]);

  return (
    <div className="public-app-shell">
      <SharedLandingHeader onReportClick={handleReportClick} />
      <SharedStatusBanner />
      <main className="public-app-main">
        <Outlet />
      </main>
      <SharedLandingFooter />
    </div>
  );
}
