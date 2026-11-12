import { Navigate, Route } from "react-router-dom";
import { PATHS } from "./paths";

import HomePage from "../pages/Home";
import AboutPage from "../pages/AboutPage";
import LiveMapPage from "../pages/LiveMapPage";
import ServicesPage from "../pages/ServicesPage";
import AccomplishmentsPage from "../pages/AccomplishmentsPage";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import TermsOfService from "../pages/TermsOfService";
import UnauthorizedPage from "../pages/Unauthorized";
import TestPage from "../pages/Test";
import AdminLogin from "../features/auth/AdminLogin";
import GuestRoute from "./GuestRoute";

export const publicRoutes = (
  <>
    <Route path="/" element={<Navigate to={PATHS.home} replace />} />
    <Route element={<GuestRoute />}>
      <Route path={PATHS.home} element={<HomePage />} />
    </Route>
    <Route path={PATHS.about} element={<AboutPage />} />
    <Route path={PATHS.publicMap} element={<LiveMapPage />} />
    <Route path={PATHS.services} element={<ServicesPage />} />
    <Route path={PATHS.accomplishments} element={<AccomplishmentsPage />} />
    <Route path={PATHS.privacy} element={<PrivacyPolicy />} />
    <Route path={PATHS.terms} element={<TermsOfService />} />
    <Route element={<GuestRoute />}>
      <Route path={PATHS.adminLogin} element={<AdminLogin />} />
    </Route>
    <Route path={PATHS.unauthorized} element={<UnauthorizedPage />} />
    {import.meta.env.DEV && (
      <Route path={PATHS.test} element={<TestPage />} />
    )}
  </>
);
