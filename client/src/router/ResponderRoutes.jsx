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
import ResponderUpdates from "../features/responder/ResponderUpdates";
import ResponderProfile from "../features/responder/ResponderProfile";
import MarkUnavailable from "../features/responder/MarkUnavailable";
import UnavailabilitySubmitted from "../features/responder/UnavailabilitySubmitted";
import ReassignmentPending from "../features/responder/ReassignmentPending";
import ReassignmentConfirmed from "../features/responder/ReassignmentConfirmed";

export const responderRoutes = (
  <Route element={<ProtectedRoute allowedRoles={["responder"]} />}>
    <Route path={PATHS.responder} element={<ResponderLayout />}>
      <Route index element={<NewDispatchNotif />} />
      <Route path="assignment-offer" element={<AssignmentOffer />} />
      <Route path="mark-unavailable" element={<MarkUnavailable />} />
      <Route path="unavailability-submitted" element={<UnavailabilitySubmitted />} />
      <Route path="reassignment-pending" element={<ReassignmentPending />} />
      <Route path="reassignment-confirmed" element={<ReassignmentConfirmed />} />
      <Route path="acceptance" element={<Acceptance />} />
      <Route path="confirmation" element={<ConfirmationAcceptance />} />
      <Route path="new-dispatch" element={<NewDispatchNotif />} />
      <Route path="assignment" element={<ResponderAssignment />} />
      <Route path="dashboard" element={<NewDispatchNotif />} />
      <Route path="route" element={<EmergencyRouting />} />
      <Route path="updates" element={<ResponderUpdates />} />
      <Route path="profile" element={<ResponderProfile />} />
      <Route path="scene-assessment" element={<SceneAssessment />} />
      <Route path="incident-not-located" element={<IncidentNotLocated />} />
      <Route path="emergency-support" element={<EmergencySupport />} />
      <Route path="non-emergency-support" element={<NonEmergencySupport />} />
    </Route>
  </Route>
);