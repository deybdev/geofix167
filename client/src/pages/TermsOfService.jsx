
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-slate-700 sm:px-8">
      <article className="mx-auto max-w-3xl">
        <Link
          to="/register"
          className="inline-flex items-center gap-1.5 text-sm leading-none text-slate-800 hover:underline"
        >
          <ArrowLeft size={16} className="shrink-0" />
          <span>Back</span>
        </Link>

        <header className="mt-8 border-b border-slate-200 pb-6">


          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Terms of Service
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Please review the terms and conditions for using the
            GeoFix 167 platform.
          </p>
        </header>

        <div className="prose prose-slate mt-8 max-w-none prose-headings:text-slate-900 prose-a:text-primary">
          <h2>Part I: Terms of Service</h2>

          <p>
            Welcome to GeoFix 167. By accessing or using the GeoFix 167
            application—an integrated geotagged incident reporting,
            infrastructure issue dispatch, monitoring, and emergency
            response route system—you agree to be bound by these
            Terms of Service.
          </p>

          <h3>1. Use of the System</h3>

          <p>
            GeoFix 167 is provided to the residents and officials of
            Barangay 167 to facilitate the reporting of emergency
            incidents (e.g., accidents, fires, health emergencies)
            and non-emergency infrastructure and maintenance issues
            (e.g., broken streetlights, clogged drainage, damaged roads).
          </p>

          <ul>
            <li>
              <strong>Accuracy of Reports:</strong> Users must provide
              accurate geotagged locations and truthful descriptions
              of incidents.
            </li>

            <li>
              <strong>Media Uploads:</strong> Users are encouraged to
              upload clear photos or videos as supporting evidence
              for their reports. Do not upload graphic, unlawful,
              or unrelated media.
            </li>

            <li>
              <strong>Emergency Alerts:</strong> Critical reports
              submitted through the system will automatically trigger
              a system alert for immediate response. Misuse of the
              critical urgency classification for non-emergencies is
              strictly prohibited and may result in penalties or
              account suspension.
            </li>
          </ul>

          <h3>2. Response and Resolution</h3>

          <p>
            While GeoFix 167 aims to expedite emergency and maintenance
            responses through efficient routing and department-level
            dispatching, the Barangay does not guarantee specific
            response times. Real-time updates and estimated times of
            arrival (ETA) are provided for informational purposes and
            may fluctuate due to traffic, weather, or concurrent
            emergencies.
          </p>

          <p>
            A submitted report will only be marked as “Resolved” or
            “Repaired” once the assigned department or maintenance
            worker uploads verified photo or video proof of the
            completed work, ensuring accountability.
          </p>

          <h3>3. User Accountability and Public Logs</h3>

          <p>
            To foster transparency, GeoFix 167 maintains a publicly
            accessible accomplishment log displaying resolved
            incidents and completed infrastructure repairs. By
            submitting a report, you acknowledge that the general
            nature and location of the resolved issue may be displayed
            publicly to demonstrate barangay initiatives.
          </p>
        </div>
      </article>
    </main>
  );
}
