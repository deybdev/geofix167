import { ServerCrash } from "lucide-react";
import ErrorPage from "./ErrorPage";

export default function ServerError() {
  return <ErrorPage code="500" title="Something went wrong" description="We couldn’t complete your request. Your information is safe—try again, or return home if the problem continues." icon={ServerCrash} retry />;
}
