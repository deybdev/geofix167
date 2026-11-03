import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import ResidentLayout from "../layouts/ResidentLayout";
import ResidentDashboard from "../features/resident/Home";
import ResidentMap from "../features/resident/Map";
import ResidentReport from "../features/resident/Report";
import PhotoCapture from "../features/resident/PhotoCapture";

export const residentRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["resident"]} />}>
    <Route path={PATHS.resident} element={<ResidentLayout />}>
      <Route index element={<ResidentDashboard />} />
      <Route path="map" element={<ResidentMap />} />
      <Route path="report" element={<ResidentReport />} />
      <Route path="photo-capture" element={<PhotoCapture />} />
    </Route>
  </Route>
);