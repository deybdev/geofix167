import { WifiOff } from "lucide-react";
import ErrorPage from "./ErrorPage";

export default function Offline() {
  return <ErrorPage eyebrow="Connection unavailable" title="You appear to be offline" description="Check your internet connection and try again. Any information entered on the previous page may still be available." icon={WifiOff} retry />;
}
