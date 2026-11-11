import { ArrowLeft, Check, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const cardClass = "rounded-[20px] border-2 border-slate-200 bg-white px-5 py-5";
const fieldClass = "rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-[18px]";

function Choice({ selected, children, onClick }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border-2 px-3 py-4 text-left text-[17px] ${selected ? "border-primary bg-[#e2f2eb] font-bold text-primary" : "border-slate-200"}`}><span className={`flex size-5 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary text-white" : "border-slate-500"}`}>{selected && <Check size={13} strokeWidth={4} />}</span>{children}</button>;
}

export default function IncidentNotLocated() {
  const [observed, setObserved] = useState("No");
  const [submitted, setSubmitted] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const evidenceUrl = evidence ? URL.createObjectURL(evidence) : "";
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 pb-5 pt-7">
        <div className="flex items-center gap-4"><Link to="/responder/scene-assessment" aria-label="Go back" className="text-primary"><ArrowLeft size={38} strokeWidth={1.8} /></Link><h1 className="text-[25px] font-bold text-primary">Incident Not Located</h1></div>
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">R</span>
      </header>
      <main className="space-y-4 px-5 py-5 pb-10">
        <span className="inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-[15px] font-bold text-[#a66a00]">Incident not observed</span>
        <section className={cardClass}><p className="text-[21px] font-bold text-primary">Report ID: GF-028</p><h2 className="mt-4 text-[26px] font-bold leading-tight">Vehicle collision on Rizal Street</h2><p className="mt-3 text-[18px]">Rizal Street at Mabini Street, Barangay 167</p><span className="mt-4 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-[16px] font-bold text-primary">Responding • On Scene</span><p className="mt-4 text-[16px] text-slate-500">R. Santos • Traffic/Road Response Team A</p></section>
        <div className="flex gap-3 rounded-xl bg-[#e2f2eb] px-4 py-4 text-[16px] leading-6 text-primary"><Info className="shrink-0" /><span><b>Not Located Does Not Mean False</b><br />Use this assessment when the reported incident cannot be located during inspection. Document the checks performed and findings.</span></div>
        <section className={cardClass}><h2 className="text-[19px] font-bold text-primary">Was the incident observed?</h2><div className="mt-3 grid grid-cols-2 gap-3"><Choice selected={observed === "Yes"} onClick={() => setObserved("Yes")}>Yes</Choice><Choice selected={observed === "No"} onClick={() => setObserved("No")}>No</Choice></div><div className="mt-3"><Choice selected={observed === "Unable"} onClick={() => setObserved("Unable")}>Unable to confirm</Choice></div></section>
        <section className={cardClass}><h2 className="text-[20px] font-bold text-primary">Checks performed</h2><div className="mt-3 space-y-3"><div className="rounded-lg border-2 border-primary bg-[#e2f2eb] px-3 py-3 font-bold text-primary">■ &nbsp; Confirmed reported pin at Rizal / Mabini</div><div className="rounded-lg border-2 border-primary bg-[#e2f2eb] px-3 py-3 font-bold text-primary">■ &nbsp; Checked nearby streets and landmarks</div></div><p className="mt-4 font-bold">Area covered</p><p className={`${fieldClass} mt-2`}>Rizal–Mabini junction to the bakery block; both roadside approaches, about 150 m.</p><p className="mt-4 font-bold">Time checked</p><p className={`${fieldClass} mt-2`}>November 3, 2026 • 2:02 PM–2:08 PM</p></section>
        <label className="block font-bold">Observations and findings<textarea className={`${fieldClass} mt-2 h-24 w-full`} defaultValue="No vehicles obstructing the junction during the check. No matching collision scene visible along the covered route." /></label>
        <label className="block font-bold">Reason and limits<textarea className={`${fieldClass} mt-2 h-28 w-full`} defaultValue="The reported scene may have moved or cleared before arrival, or the pin may be imprecise. Side streets beyond the bakery were not checked." /></label>
        <section className={cardClass}><h2 className="text-[20px] font-bold text-primary">Optional Evidence</h2><label className="mt-4 flex h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 text-[17px] font-bold text-primary">Add Photo / Video (Optional)<input type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} /></label>{evidence && <div className="mt-4 overflow-hidden rounded-xl border-2 border-slate-200">{evidence.type.startsWith("video/") ? <video src={evidenceUrl} controls className="max-h-64 w-full object-contain" /> : <img src={evidenceUrl} alt="Uploaded incident evidence" className="max-h-64 w-full object-contain" />}<p className="px-3 py-2 text-sm text-slate-500">{evidence.name}</p></div>}<p className="mt-3 text-[15px] text-slate-500">No attachment is required. Collect evidence only when safe.</p></section>
        <div className="rounded-xl bg-[#e2f2eb] px-4 py-4 text-[16px] leading-6 text-primary"><b>No Automatic False-Report Penalty</b><br />Submit for authorized admin follow-up. Findings do not establish a false report, restrict access, or close the case.</div>
        {!submitted ? <button type="button" onClick={() => setSubmitted(true)} className="h-16 w-full rounded-xl bg-primary text-[18px] font-bold text-white">Submit Findings for Admin Follow-Up</button> : <Link to="/responder/emergency-support" className="flex h-16 items-center justify-center rounded-xl bg-primary text-[18px] font-bold text-white">Continue to Emergency Support</Link>}
        {submitted && <p className="rounded-xl bg-[#e2f2eb] px-4 py-3 text-[16px] font-bold text-primary" role="status">Findings submitted for administrator follow-up.</p>}
        <p className="text-[15px] text-slate-500">Report Status: Responding</p>
      </main>
    </div>
  );
}
