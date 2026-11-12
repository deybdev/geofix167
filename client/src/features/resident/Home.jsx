import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ChevronRight,
  Megaphone,
  Calendar,
  Plus,
  UserRound,
  AlertCircle,
  Maximize2,
} from "lucide-react";
import MapViewer from "../../shared/components/MapViewer";
import { loadSampleIncidents } from "./sampleIncident";
import { useAuth } from "../../shared/hooks/useAuth";
import { PATHS } from "../../router/paths";
import {
  getReports,
  getReportStats,
  getAnnouncements,
} from "../../services/residentService";

const STATUS_META = {
  submitted:    { label: "Submitted",    dot: "bg-slate-400",  pill: "bg-slate-100 text-slate-700" },
  under_review: { label: "Under Review", dot: "bg-blue-500",   pill: "bg-blue-100 text-blue-700" },
  assigned:     { label: "Assigned",     dot: "bg-purple-500", pill: "bg-purple-100 text-purple-700" },
  in_progress:  { label: "In Progress",  dot: "bg-amber-500",  pill: "bg-amber-100 text-amber-700" },
  resolved:     { label: "Resolved",     dot: "bg-green-500",  pill: "bg-green-100 text-green-700" },
};

const CATEGORY_LABELS = {
  fire: "Fire", medical: "Medical", crime: "Crime or Threat",
  accident: "Road Accident", flood: "Flood or Storm",
  road: "Road Damage", streetlight: "Streetlight",
  drainage: "Drainage", garbage: "Garbage",
  utilities: "Water / Electricity", other: "Other",
};

const ANN_CATEGORY_COLORS = {
  "Clean & Green":    "bg-emerald-100 text-emerald-800",
  "BDRRMO Advisory":  "bg-amber-100 text-amber-800",
  "Health & Safety":  "bg-blue-100 text-blue-800",
  "General":          "bg-slate-100 text-slate-700",
};

function StatCard({ label, value, status, loading, onClick }) {
  const isPrimary = !status;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-2xl p-4 text-left transition active:scale-95 ${
        isPrimary
          ? "bg-primary text-white shadow-lg shadow-primary/25"
          : "bg-white border border-slate-100 shadow-sm"
      }`}
    >
      <span className={`text-2xl font-extrabold ${isPrimary ? "text-white" : "text-slate-900"}`}>
        {loading ? <span className="inline-block h-7 w-8 animate-pulse rounded bg-slate-200" /> : value}
      </span>
      <span className={`mt-1 text-xs font-medium ${isPrimary ? "text-white/80" : "text-slate-500"}`}>
        {label}
      </span>
    </button>
  );
}

function ReportCard({ report }) {
  const st = STATUS_META[report.status] ?? STATUS_META.submitted;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      {report.photo_url ? (
        <img
          src={report.photo_url}
          alt="Incident"
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <FileText size={22} className="text-slate-400" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
            #{report.public_id.slice(-8).toUpperCase()}
          </span>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">
          {CATEGORY_LABELS[report.category] ?? report.category}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{report.description}</p>
        <p className="mt-1 text-[10px] text-slate-400">
          {report.address || "—"} ·{" "}
          {new Date(report.created_at).toLocaleDateString("en-PH", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}

function AnnouncementCard({ ann }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = ANN_CATEGORY_COLORS[ann.category] ?? ANN_CATEGORY_COLORS.General;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-slate-200 hover:bg-white">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${colorClass}`}>
          {ann.category}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
          <Calendar size={11} />
          {new Date(ann.published_at).toLocaleDateString("en-PH", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </span>
      </div>
      <h4 className="text-sm font-bold text-slate-900 leading-snug">{ann.title}</h4>
      <p className={`mt-1 text-xs leading-relaxed text-slate-600 ${expanded ? "" : "line-clamp-3"}`}>
        {ann.content}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[11px] font-semibold text-primary"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const firstName = user?.full_name?.split(" ")[0] ?? "Resident";

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [annLoading, setAnnLoading] = useState(true);
  const [error, setError] = useState(null);
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    loadSampleIncidents().then(setIncidents).catch(() => {});

    getReportStats()
      .then(({ data }) => setStats(data.stats))
      .catch(() => setError("Could not load report statistics."))
      .finally(() => setStatsLoading(false));

    getReports({ limit: 3 })
      .then(({ data }) => setRecentReports(data.reports))
      .catch(() => {})
      .finally(() => setReportsLoading(false));

    getAnnouncements()
      .then(({ data }) => setAnnouncements(data.announcements))
      .catch(() => {})
      .finally(() => setAnnLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* 1. Welcome Section */}
      <section className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Welcome back,</p>
          <h1 className="text-2xl font-extrabold text-slate-900">{firstName} 👋</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Barangay 167, Caloocan City
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(PATHS.profile)}
          className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-label="View profile"
        >
          <UserRound size={22} />
        </button>
      </section>

      {/* 2. Map Preview */}
      <section className="relative h-52 overflow-hidden rounded-2xl ring-1 ring-slate-200 shadow-sm">
        <MapViewer variant="picker" incidents={incidents} />
        <button
          type="button"
          aria-label="Open full map"
          onClick={() => navigate(PATHS.map)}
          className="absolute right-3 top-3 z-[500] flex size-9 items-center justify-center rounded-xl bg-white/95 shadow-lg ring-1 ring-black/5 text-slate-700 transition hover:text-primary"
        >
          <Maximize2 size={16} />
        </button>
      </section>

      {/* 3. My Report Overview */}
      <section>
        <h2 className="mb-3 text-base font-bold text-slate-900">My Report Overview</h2>
        {error && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertCircle size={14} />
            {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard
            label="Total Reports"
            value={stats?.total ?? 0}
            loading={statsLoading}
            onClick={() => navigate(PATHS.myReports)}
          />
          <StatCard
            label="Submitted"
            value={stats?.submitted ?? 0}
            status="submitted"
            loading={statsLoading}
            onClick={() => navigate(PATHS.myReports, { state: { status: "submitted" } })}
          />
          <StatCard
            label="In Progress"
            value={stats?.in_progress ?? 0}
            status="in_progress"
            loading={statsLoading}
            onClick={() => navigate(PATHS.myReports, { state: { status: "in_progress" } })}
          />
          <StatCard
            label="Resolved"
            value={stats?.resolved ?? 0}
            status="resolved"
            loading={statsLoading}
            onClick={() => navigate(PATHS.myReports, { state: { status: "resolved" } })}
          />
        </div>
      </section>

      {/* 4. Recent Reports */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Recent Reports</h2>
          <button
            type="button"
            onClick={() => navigate(PATHS.myReports)}
            className="flex items-center gap-0.5 text-xs font-semibold text-primary"
          >
            View All <ChevronRight size={14} />
          </button>
        </div>

        {reportsLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!reportsLoading && recentReports.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
              <FileText size={24} className="text-slate-400" />
            </span>
            <p className="text-sm font-semibold text-slate-700">No reports yet</p>
            <p className="text-xs text-slate-500">Submit your first report to get started.</p>
            <button
              type="button"
              onClick={() => navigate(PATHS.report)}
              className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus size={13} />
              Submit a Report
            </button>
          </div>
        )}

        {!reportsLoading && recentReports.length > 0 && (
          <div className="space-y-3">
            {recentReports.map((report) => (
              <ReportCard key={report.public_id} report={report} />
            ))}
          </div>
        )}
      </section>

      {/* 5. Barangay Announcements */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-primary">
              <Megaphone size={15} />
            </span>
            <h2 className="text-base font-bold text-slate-900">Announcements</h2>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Live Feed
          </span>
        </div>

        {annLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {!annLoading && announcements.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No announcements at this time.
          </p>
        )}

        {!annLoading && announcements.length > 0 && (
          <div className="space-y-3">
            {announcements.map((ann) => (
              <AnnouncementCard key={ann.public_id} ann={ann} />
            ))}
          </div>
        )}

        <p className="mt-3 text-center text-[11px] text-slate-400">
          Barangay Hall Hotline: 668-338-3141
        </p>
      </section>
    </div>
  );
}
