import { MapPinOff } from "lucide-react";
import ErrorPage from "./ErrorPage";

export default function NotFound() {
  return <ErrorPage code="404" title="Page not found" description="The page may have moved, or the address may be incorrect. You can go back or return to the GeoFix home page." icon={MapPinOff} />;
}
