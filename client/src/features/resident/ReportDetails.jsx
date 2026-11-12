import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, FileText, MapPin } from "lucide-react";

import { Button } from "../../shared/components/ui/button";
import { PATHS } from "../../router/paths";
import RequestTracking from "./RequestTracking";
import InfraTimeline, {
  REPAIR_PHOTO_URL,
  STAGE_OFFSET_MIN,
  statusToStage,
} from "./components/InfraTimeline";

const CATEGORY_LABELS = {
  fire: "Fire",
  medical: "Medical",
  crime: "Crime or Threat",
  accident: "Road Accident",
  flood: "Flood or Storm",
  road: "Road Damage",
  streetlight: "Streetlight",
  drainage: "Drainage",
  garbage: "Garbage",
  utilities: "Water / Electricity",
  other: "Other",
};

/* Demo timestamps for the stages a stored report already completed */
function demoStageTimes(createdAt, stage) {
  const base = new Date(createdAt).getTime();
  return STAGE_OFFSET_MIN.map(
    (mins, i) =>
      i <= stage && Number.isFinite(base)
        ? new Date(base + mins * 60000).toISOString()
        : null,
  );
}

export default function ReportDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const report = location.state?.report;

  // Missing report (e.g. page opened directly) — send the user back
  if (!report) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-slate-100">
          <FileText size={26} className="text-slate-400" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-900">
          Report not found
        </h1>
        <Button
          type="button"
          onClick={() => navigate(PATHS.myReports)}
          className="mt-6 h-11 rounded-lg px-6 text-sm font-semibold"
        >
          Back to My Reports
        </Button>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[report.category] ?? report.category;

  // Emergencies get the live responder-dispatch experience: map with the
  // station-to-pin route, responder info, and the response timeline
  if (report.report_type === "emergency") {
    return (
      <RequestTracking
        position={{ lat: report.latitude, lng: report.longitude }}
        address={report.address}
        category={report.category}
        categoryLabel={categoryLabel}
      />
    );
  }

  // Infrastructure: the maintenance workflow timeline
  const stage = statusToStage(report.status);
  const resolved = stage >= 4;

  return (
    <section className="mx-auto max-w-md px-4 py-5 text-sm text-slate-700">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(PATHS.myReports)}
          aria-label="Back to my reports"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-slate-900">
          Infrastructure Workflow
        </h1>
      </div>

      {/* Status card */}
      <div className="mt-4 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <MapPin size={13} className="text-emerald-600" />
          </span>
          <p className="text-sm font-bold text-slate-900">{categoryLabel}</p>
          <span
            className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${
              resolved
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {report.status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-4 text-slate-500">
          {report.description}
        </p>
        <p className="mt-1.5 text-xs leading-4 text-slate-500">
          {report.address || "Pinned location"}
        </p>
        <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Report #{report.public_id}
        </p>
      </div>

      {/* Workflow timeline (with photo evidence on its stages) */}
      <p className="mb-3 mt-6 text-xs font-bold uppercase tracking-wide text-slate-400">
        Workflow progress
      </p>
      <InfraTimeline
        category={report.category}
        categoryLabel={categoryLabel}
        reportId={report.public_id}
        currentStage={stage}
        stageTimes={demoStageTimes(report.created_at, stage)}
        photos={{
          Submitted: report.photo_url ? [report.photo_url] : null,
          "In Progress": stage >= 3 ? [REPAIR_PHOTO_URL] : null,
        }}
        createdAt={report.created_at}
      />

      <Button
        type="button"
        onClick={() => navigate(PATHS.myReports)}
        variant={resolved ? "default" : "outline"}
        className="mt-2 h-11 w-full rounded-xl text-sm font-semibold"
      >
        {resolved ? "Done" : "Back to My Reports"}
      </Button>
    </section>
  );
}
