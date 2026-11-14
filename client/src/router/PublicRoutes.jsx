import { Navigate, Route } from "react-router-dom";
import { PATHS } from "./paths";

import HomePage from "../pages/Home";
import AboutPage from "../pages/AboutPage";
import LiveMapPage from "../pages/LiveMapPage";
import ServicesPage from "../pages/ServicesPage";
import AccomplishmentsPage from "../pages/AccomplishmentsPage";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import TermsOfService from "../pages/TermsOfService";
import UnauthorizedPage from "../pages/errors/Unauthorized";
import ForbiddenPage from "../pages/errors/Forbidden";
import ServerErrorPage from "../pages/errors/ServerError";
import OfflinePage from "../pages/errors/Offline";
import TestPage from "../pages/Test";
import AdminLogin from "../features/auth/AdminLogin";
import GuestRoute from "./GuestRoute";
import MainLayout from "../layouts/MainLayout";

export const publicRoutes = (
  <>
    <Route path="/" element={<Navigate to={PATHS.home} replace />} />
    <Route element={<MainLayout />}>
      <Route element={<GuestRoute />}>
        <Route path={PATHS.home} element={<HomePage />} />
      </Route>
      <Route path={PATHS.about} element={<AboutPage />} />
      <Route path={PATHS.publicMap} element={<LiveMapPage />} />
      <Route path={PATHS.services} element={<ServicesPage />} />
      <Route path={PATHS.accomplishments} element={<AccomplishmentsPage />} />
      <Route path={PATHS.privacy} element={<PrivacyPolicy />} />
      <Route path={PATHS.terms} element={<TermsOfService />} />
    </Route>
    <Route element={<GuestRoute />}>
      <Route path={PATHS.adminLogin} element={<AdminLogin />} />
    </Route>
    <Route path={PATHS.unauthorized} element={<UnauthorizedPage />} />
    <Route path={PATHS.forbidden} element={<ForbiddenPage />} />
    <Route path={PATHS.serverError} element={<ServerErrorPage />} />
    <Route path={PATHS.offline} element={<OfflinePage />} />
    {import.meta.env.DEV && (
      <Route path={PATHS.test} element={<TestPage />} />
    )}
  </>
);
