import { ShieldAlert } from "lucide-react";
import ErrorPage from "./ErrorPage";

export default function Forbidden() {
  return <ErrorPage code="403" title="Access restricted" description="You don’t have permission to view this page. Return to your dashboard or contact an administrator if you believe this is a mistake." icon={ShieldAlert} />;
}
