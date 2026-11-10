import { Route } from "react-router-dom";
import { PATHS } from "./paths";

import ProtectedRoute from "../shared/components/ProtectedRoute";
import ResponderLayout from "../layouts/ResponderLayout";
import NewDispatchNotif from "../features/responder/NewDispatchNotif";
import ResponderAssignment from "../features/responder/ResponderAssignment";
import AssignmentOffer from "../features/responder/AssignmentOffer";
import Acceptance from "../features/responder/Acceptance";
import ConfirmationAcceptance from "../features/responder/ConfirmationAcceptance";
import EmergencyRouting from "../features/responder/EmergencyRouting";
import SceneAssessment from "../features/responder/SceneAssessment";
import IncidentNotLocated from "../features/responder/IncidentNotLocated";
import EmergencySupport from "../features/responder/EmergencySupport";
import NonEmergencySupport from "../features/responder/NonEmergencySupport";

export const responderRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["responder"]} />}>
    <Route path={PATHS.responder} element={<ResponderLayout />}>
      <Route index element={<NewDispatchNotif />} />
      <Route path="assignment-offer" element={<AssignmentOffer />} />
      <Route path="acceptance" element={<Acceptance />} />
      <Route path="confirmation" element={<ConfirmationAcceptance />} />
      <Route path="new-dispatch" element={<NewDispatchNotif />} />
      <Route path="assignment" element={<ResponderAssignment />} />
      <Route path="dashboard" element={<NewDispatchNotif />} />
      <Route path="route" element={<EmergencyRouting />} />
      <Route path="scene-assessment" element={<SceneAssessment />} />
      <Route path="incident-not-located" element={<IncidentNotLocated />} />
      <Route path="emergency-support" element={<EmergencySupport />} />
      <Route path="non-emergency-support" element={<NonEmergencySupport />} />
    </Route>
  </Route>
);