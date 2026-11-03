import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import HomePage from "../pages/Home";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import TermsOfService from "../pages/TermsOfService";
import UnauthorizedPage from "../pages/Unauthorized";
import TestPage from "../pages/Test";
import AdminLogin from "../features/auth/AdminLogin";
import GuestRoute from "./GuestRoute";

export const publicRoutes = (
  <>
    <Route element={<GuestRoute />}>
      <Route path={PATHS.home} element={<HomePage />} />
    </Route>
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