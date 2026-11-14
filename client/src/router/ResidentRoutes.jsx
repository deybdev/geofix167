import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import ResidentLayout from "../layouts/ResidentLayout";
import ResidentDashboard from "../features/resident/Home";
import ResidentMap from "../features/resident/Map";
import ResidentReport from "../features/resident/Report";
import ReportDetails from "../features/resident/ReportDetails";
import PhotoCapture from "../features/resident/PhotoCapture";
import MyReports from "../features/resident/MyReports";
import Alerts from "../features/resident/Alerts";
import Profile from "../features/resident/Profile";
import Emergency from "../features/resident/Emergency";

export const residentRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["resident"]} />}>
    <Route path={PATHS.resident} element={<ResidentLayout />}>
      <Route index element={<ResidentDashboard />} />
      <Route path="map" element={<ResidentMap />} />
      <Route path="report" element={<ResidentReport />} />
      <Route path="report/details" element={<ReportDetails />} />
      <Route path="report/details/:id" element={<ReportDetails />} />
      <Route path="photo-capture" element={<PhotoCapture />} />
      <Route path="my-reports" element={<MyReports />} />
      <Route path="alerts" element={<Alerts />} />
      <Route path="profile" element={<Profile />} />
      <Route path="emergency" element={<Emergency />} />
    </Route>
  </Route>
);
