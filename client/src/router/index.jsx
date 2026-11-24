import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "../shared/components/ScrollToTop";

import { AuthProvider } from "../shared/context/AuthProvider";
import { LocationProvider } from "../shared/context/LocationProvider";
import NotFoundPage from "../pages/errors/NotFound";

import { publicRoutes } from "./PublicRoutes";
import { authRoutes } from "./AuthRoutes";
import { residentRoutes } from "./ResidentRoutes";
import { adminRoutes } from "./AdminRoutes";
import { bdrrmoRoutes } from "./BdrrmoRoutes";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <LocationProvider>
        <Routes>
          {publicRoutes}
          {authRoutes}
          {residentRoutes}
          {adminRoutes}
          {bdrrmoRoutes}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
