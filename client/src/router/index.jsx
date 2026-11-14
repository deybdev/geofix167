import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "../shared/context/AuthProvider";
import { LocationProvider } from "../shared/context/LocationProvider";
import NotFoundPage from "../pages/errors/NotFound";

import { publicRoutes } from "./PublicRoutes";
import { authRoutes } from "./AuthRoutes";
import { residentRoutes } from "./ResidentRoutes";
import { responderRoutes } from "./ResponderRoutes";
import { adminRoutes } from "./AdminRoutes";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LocationProvider>
        <Routes>
          {publicRoutes}
          {authRoutes}
          {residentRoutes}
          {responderRoutes}
          {adminRoutes}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </LocationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
