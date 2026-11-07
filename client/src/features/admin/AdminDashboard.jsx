import {
  ChevronRight,
} from "lucide-react";
import MapViewer from "../../shared/components/MapViewer";

const metrics = [
  ["TOTAL REPORTS", "24", "Sample infrastructure data", "bg-[#2e8b57]"],
  ["NEW REPORTS", "8", "New infrastructure reports", "bg-[#f59e0b]"],
  ["IN PROGRESS", "7", "Infrastructure tasks in progress", "bg-[#2e8b57]"],
  ["FOR VERIFICATION", "4", "Pending final armil check", "bg-[#2e8b57]"],
  ["FIXED", "5", "Infrastructure cases resolved", "bg-[#2e8b57]"],
];

const reports = [
  ["GF-001", "Pothole on Rizal Street", "Road Damage", "Rizal Street", "Marvin Navarrete", "April 22, 2026", "Reported", "reported"],
  ["GF-002", "Broken Streetlight Pole", "Electrical", "Quezon Avenue", "John Kyle Paroni", "April 21, 2026", "In Progress", "progress"],
  ["GF-003", "Clogged Drainage Canal", "Sanitation", "Magsaysay Boulevard", "Efren Cahilig", "April 20, 2026", "Verified Fixed", "fixed"],
  ["GF-006", "Accident (DEMO)", "Incident / Emergency", "Rizal Street", "Demo Guest", "Demo record", "Dispatch Pending", "reported"],
];

const urgentReports = [
  ["GF-001 - Infrastructure: Road Damage", "Pothole on Rizal Street", "bg-[#fff1c6]", "text-[#f59e0b]"],
  ["GF-002 - Infrastructure: Streetlight", "Broken Streetlight Pole", "bg-[#dcefe5]", "text-[#2e8b57]"],
  ["GF-003 - Infrastructure: Drainage", "Clogged Drainage Canal", "bg-[#d9f7e4]", "text-[#2e8b57]"],
  ["GF-006 - Accident (DEMO)", "Incident/Emergency: urgent, dispatch pending", "bg-[#fff1c6]", "text-[#f59e0b]"],
];

const mapIncidents = [
  { id: "GF-001", title: "Pothole on Rizal Street", status: "Reported", lat: 14.7299, lng: 121.0129 },
  { id: "GF-002", title: "Broken Streetlight Pole", status: "In Progress", lat: 14.7321, lng: 121.0192 },
  { id: "GF-003", title: "Clogged Drainage Canal", status: "Verified Fixed", lat: 14.7269, lng: 121.0174 },
  { id: "GF-006", title: "Accident (DEMO)", status: "Dispatch Pending", lat: 14.7342, lng: 121.0085 },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {metrics.map(([label, value, description, dot]) => <div key={label} className="rounded-lg border border-[#e2e8eb] bg-white p-4 shadow-[0_2px_8px_rgba(27,52,70,0.03)]"><div className="flex items-center justify-between text-[9px] font-bold text-slate-500">{label}<span className={`h-1.5 w-1.5 rounded-full ${dot}`} /></div><div className="mt-1 text-[23px] font-bold text-[#2e8b57]">{value}</div><div className="text-[9px] text-slate-400">{description}</div></div>)}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_270px]">
            <div className="rounded-lg border border-[#e2e8eb] bg-white p-3">
              <div className="mb-2 flex items-center justify-between"><h2 className="text-[12px] font-bold text-[#2e8b57]">Live Incident &amp; Infrastructure Cluster</h2><button className="flex items-center gap-1 rounded border border-[#d9e8df] px-2 py-1 text-[9px] font-semibold text-[#2e8b57]">Go to Map View <ChevronRight size={11} /></button></div>
              <MapViewer incidents={mapIncidents} compact />
            </div>
            <div className="rounded-lg border border-[#e2e8eb] bg-white p-3">
              <h2 className="mb-2 text-[12px] font-bold text-[#2e8b57]">Urgent Reports &amp; Dispatch</h2>
              <div className="space-y-2">{urgentReports.map(([title, detail, bg, color], index) => <div key={title} className={`flex gap-2 rounded-md p-2 ${bg}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-bold ${color}`}>{index + 1}</span><div className="min-w-0 text-[9px]"><strong className="block truncate text-[#2e8b57]">{title}</strong><span className="text-slate-500">{detail}</span></div></div>)}</div>
            </div>
          </section>

          <section className="rounded-lg border border-[#e2e8eb] bg-white p-3">
            <h2 className="mb-2 text-[12px] font-bold text-[#2e8b57]">Recent Incident &amp; Infrastructure Reports</h2>
            <div className="overflow-x-auto"><table className="w-full min-w-[700px] border-collapse text-left text-[9px]"><thead><tr className="rounded bg-[#f5f8fa] text-slate-500"><th className="rounded-l px-3 py-2">Report ID</th><th className="px-3 py-2">Incident Report</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Reporter</th><th className="px-3 py-2">Date Submitted</th><th className="rounded-r px-3 py-2">Status</th></tr></thead><tbody>{reports.map(([id, incident, category, location, reporter, date, status, type]) => <tr key={id} className="border-b border-[#e7ecef] last:border-0"><td className="px-3 py-3 font-bold text-[#2e8b57]">{id}</td><td className="px-3 py-3 font-medium">{incident}</td><td className="px-3 py-3 text-slate-500">{category}</td><td className="px-3 py-3 text-slate-500">{location}</td><td className="px-3 py-3">{reporter}</td><td className="px-3 py-3 text-slate-500">{date}</td><td className="px-3 py-3"><span className={`rounded px-2 py-1 text-[8px] font-semibold ${type === "fixed" ? "bg-[#d9f7e4] text-[#2e8b57]" : type === "progress" ? "bg-[#dcefe5] text-[#2e8b57]" : "bg-[#fff1c6] text-[#e69500]"}`}>{status}</span></td></tr>)}</tbody></table></div>
          </section>
    </div>
  );
}
