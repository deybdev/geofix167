import { memo, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import LandingHeader from "../features/landing/components/LandingHeader";
import LandingFooter from "../features/landing/components/LandingFooter";
import QuickReportModal from "../features/landing/components/QuickReportModal";
import ScrollProgress from "../shared/components/ScrollProgress";
import ReportFab from "../shared/components/ReportFab";
import { PATHS } from "../router/paths";

const SharedLandingHeader = memo(LandingHeader);
const SharedLandingFooter = memo(LandingFooter);

export default function MainLayout() {
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const [isQuickReportOpen, setIsQuickReportOpen] = useState(false);

  useLayoutEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const handleReportClick = useCallback(() => {
    if (pathnameRef.current === PATHS.home || pathnameRef.current === PATHS.publicMap) {
      window.dispatchEvent(new Event("geofix:open-report"));
      return;
    }
    setIsQuickReportOpen(true);
  }, []);

  const closeQuickReport = useCallback(() => setIsQuickReportOpen(false), []);

  return (
    <div className="public-app-shell">
      <SharedLandingHeader onReportClick={handleReportClick} />
      <ScrollProgress />
      <main className="public-app-main">
        <Outlet />
      </main>
      <SharedLandingFooter />
      <ReportFab onClick={handleReportClick} />
      <QuickReportModal isOpen={isQuickReportOpen} onClose={closeQuickReport} defaultCoordinates={null} />
    </div>
  );
}
