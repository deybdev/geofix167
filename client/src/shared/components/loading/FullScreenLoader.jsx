import GeoFixLoader from "./GeoFixLoader";

export default function FullScreenLoader({ message = "Loading GeoFix 167…", detail = "Preparing your secure session." }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <GeoFixLoader message={message} detail={detail} />
    </main>
  );
}
