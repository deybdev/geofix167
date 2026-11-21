import { LogIn } from "lucide-react";
import ErrorPage from "./ErrorPage";

export default function Unauthorized() {
  return <ErrorPage code="401" title="Please sign in again" description="Your session may have expired. Return to your dashboard or switch accounts to continue securely to GeoFix." icon={LogIn} accessRecovery />;
}
