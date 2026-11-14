
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPolicy({ embedded = false }) {
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-slate-700 sm:px-8">
      <article className="mx-auto max-w-3xl">
        {!embedded && <Link
          to="/register"
          className="inline-flex items-center gap-1.5 text-sm leading-none text-slate-800 hover:underline"
        >
          <ArrowLeft size={16} className="shrink-0" />
          <span>Back</span>
        </Link>}

        <header className="mt-8 border-b border-slate-200 pb-6">

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Privacy Policy
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Learn how GeoFix 167 collects, uses, and protects your
            personal information.
          </p>
        </header>

        <div className="prose prose-slate mt-8 max-w-none prose-headings:text-slate-900 prose-a:text-primary">
          <h2>Part II: Privacy Policy</h2>

          <p>
            This Privacy Policy explains how GeoFix 167 collects, uses,
            and protects your information in accordance with the project
            objectives detailed in “GeoFix 167 UPDATED.docx.pdf”.
          </p>

          <h3>1. Information We Collect</h3>

          <ul>
            <li>
              <strong>Location Data:</strong> To enable the core mapping
              and routing features, the system collects precise
              geographical coordinates (geotags) when you submit a report.
            </li>

            <li>
              <strong>Media and Content:</strong> We collect the photos,
              videos, and text descriptions you submit as evidence of an
              incident or infrastructure issue.
            </li>

            <li>
              <strong>Account Information:</strong> Basic contact details
              may be collected to provide you with real-time updates
              regarding the status of your submitted reports.
            </li>
          </ul>

          <h3>2. How We Use Your Information</h3>

          <p>
            Your data is used strictly for Barangay 167 administrative,
            emergency, and maintenance purposes, specifically to:
          </p>

          <ul>
            <li>
              Verify the exact location of community hazards or emergencies.
            </li>

            <li>
              Dispatch the appropriate Emergency Response Teams or Barangay
              Maintenance/Engineering personnel.
            </li>

            <li>
              Generate efficient response routes from the barangay hall
              or current responder location to the incident site (and to
              hospitals, if applicable).
            </li>

            <li>
              Provide you with progress updates and resolution verifications.
            </li>
          </ul>

          <h3>3. Data Sharing and Security</h3>

          <p>
            Your submitted reports, including media and location data,
            are shared directly with authorized Barangay 167 officials
            and the specific department assigned to handle your request.
            GeoFix 167 employs standard security measures to protect
            your data from unauthorized access. We do not sell or share
            your personal information with third parties outside of the
            necessary local government and emergency response networks.
          </p>
        </div>
      </article>
    </main>
  );
}
