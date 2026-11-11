import { useMemo, useState } from "react";
import {
  CheckCircle2, Download, FileCheck, FileUp, Search, Video, XCircle,
} from "lucide-react";
import { toast } from "../../shared/components/ui/toast";

const URGENCY_STYLES = {
  Critical: "bg-[#fdecea] text-[#dc2626]",
  Emergency: "bg-[#fff1c6] text-[#e69500]",
  "Non-Emergency": "bg-[#dcefe5] text-[#2e8b57]",
};

const STATUS_STYLES = {
  Pending: "bg-[#fff1c6] text-[#e69500]",
  Approved: "bg-[#d9f7e4] text-[#2e8b57]",
  "Sent Back": "bg-[#fdecea] text-[#dc2626]",
};

const initialSubmissions = [
  { id: "GF-003", title: "Clogged Drainage Canal", category: "Sanitation", urgency: "Non-Emergency", team: "Barangay Sanitizers", submitted: "April 21, 2026", proof: [{ kind: "photo", file: "drainage-after.jpg" }, { kind: "video", file: "drainage-clip.mp4 • 0:24" }], status: "Pending", note: "Canal cleared and flushed; pending admin confirmation." },
  { id: "GF-005", title: "Cracked Sidewalk Path", category: "Road Damage", urgency: "Non-Emergency", team: "Barangay Public Works", submitted: "April 20, 2026", proof: [{ kind: "photo", file: "sidewalk-repaired.jpg" }], status: "Pending", note: "Cement patch cured 48 hours before submission." },
  { id: "GF-002", title: "Broken Streetlight Pole", category: "Electrical", urgency: "Non-Emergency", team: "Engineering Crew B", submitted: "April 19, 2026", proof: [{ kind: "photo", file: "streetlight-on.jpg" }], status: "Pending", note: "Pole re-anchored and wiring inspected at night." },
  { id: "GF-001", title: "Vehicular Accident on Rizal Street", category: "Incident / Emergency", urgency: "Critical", team: "BDRRMO Response", submitted: "April 18, 2026", proof: [{ kind: "video", file: "scene-response.mp4 • 1:12" }], status: "Approved", note: "Reviewed by Admin Moreno — response verified." },
  { id: "GF-004", title: "Exposed Power Lines", category: "Electrical", urgency: "Emergency", team: "Meralco Dispatch", submitted: "April 17, 2026", proof: [{ kind: "photo", file: "lines-secured.jpg" }], status: "Sent Back", note: "Proof lacks a ground-level shot; resubmission requested." },
];

const KIND_ICON = { photo: FileUp, video: Video };

export default function ResolutionVerification() {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");

  const filtered = useMemo(() => submissions.filter((submission) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || `${submission.id} ${submission.title} ${submission.team} ${submission.category}`.toLowerCase().includes(search);
    return matchesQuery && (status === "All Statuses" || submission.status === status);
  }), [query, status, submissions]);

  function decide(id, decision) {
    setSubmissions((current) => current.map((submission) => submission.id === id ? { ...submission, status: decision === "approve" ? "Approved" : "Sent Back" } : submission));
    const submission = submissions.find((item) => item.id === id);
    toast.add({
      title: decision === "approve" ? "Resolution approved" : "Sent back to team",
      description: decision === "approve" ? `${id} is marked as verified fixed.` : `${id} needs updated proof of repair.`,
      type: decision === "approve" ? "success" : "info",
    });
  }

  const pending = submissions.filter((submission) => submission.status === "Pending").length;

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[#e2e8eb] bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e7f4ed] text-[#2e8b57]"><FileCheck size={18} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-bold text-[#2e8b57]">Resolution Verification</h2>
            <p className="text-[9px] text-[#60738f]">Review the proof of response or repair submitted by responding teams before marking reports as verified fixed.</p>
          </div>
          <span className="rounded-md bg-[#fff1c6] px-2.5 py-1.5 text-[10px] font-bold text-[#e69500]">{pending} Pending</span>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
        <label className="flex h-7 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[#dfe5e8] px-2 text-slate-400">
          <Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search submissions..." className="w-full text-[9px] outline-none placeholder:text-slate-400" />
        </label>
        <button type="button" onClick={() => toast.add({ title: "Export ready", description: "Verification CSV export generated for the filtered list.", type: "success" })} className="flex items-center gap-1 rounded-md border border-[#d9e8df] px-2 py-1.5 text-[9px] font-semibold text-[#2e8b57]"><Download size={11} /> Export</button>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
        {["All Statuses", "Pending", "Approved", "Sent Back"].map((option) => (
          <button key={option} type="button" aria-pressed={status === option} onClick={() => setStatus(option)}
            className={`rounded-md px-3 py-1.5 text-[9px] font-bold ${status === option ? "bg-[#2e8b57] text-white" : "border border-[#dfe5e8] text-[#60738f] hover:bg-[#f3faf6]"}`}>
            {option}
          </button>
        ))}
      </section>

      <section className="grid gap-2">
        {filtered.map((submission) => (
          <article key={submission.id} className="rounded-lg border border-[#e2e8eb] bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#2e8b57]">{submission.id}</p>
                <h3 className="truncate text-[12px] font-semibold text-[#263246]">{submission.title}</h3>
                <p className="mt-0.5 text-[9px] text-[#60738f]">{submission.category} • {submission.team} • Submitted {submission.submitted}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded px-2 py-1 text-[8px] font-bold ${URGENCY_STYLES[submission.urgency]}`}>{submission.urgency}</span>
                <span className={`rounded px-2 py-1 text-[8px] font-bold ${STATUS_STYLES[submission.status]}`}>{submission.status}</span>
              </div>
            </div>

            <p className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-[#60738f]">
              {submission.proof.map((item) => {
                const Icon = KIND_ICON[item.kind];
                return <span key={item.file} className="flex items-center gap-1 rounded-md border border-[#d9e8df] bg-[#f3faf6] px-2 py-1 font-medium text-[#2e8b57]"><Icon size={11} />{item.file}</span>;
              })}
            </p>
            <p className="mt-2 rounded-md border border-[#edf0f2] bg-[#f8fafb] px-2.5 py-2 text-[9px] text-[#60738f]">Team note: {submission.note}</p>

            {submission.status === "Pending" && (
              <div className="mt-3 flex justify-end gap-2 border-t border-[#e7ecef] pt-3">
                <button type="button" onClick={() => decide(submission.id, "reject")} className="flex items-center gap-1 rounded-md border border-[#f3d4d0] px-3 py-2 text-[9px] font-bold text-[#dc2626] hover:bg-[#fdecea]"><XCircle size={12} /> Send Back</button>
                <button type="button" onClick={() => decide(submission.id, "approve")} className="flex items-center gap-1 rounded-md bg-[#2e8b57] px-3 py-2 text-[9px] font-bold text-white hover:bg-[#26764a]"><CheckCircle2 size={12} /> Approve</button>
              </div>
            )}
          </article>
        ))}
        {!filtered.length && <p className="rounded-lg border border-[#e2e8eb] bg-white py-8 text-center text-xs text-[#60738f]">No submissions match the current filters.</p>}
      </section>
    </div>
  );
}
