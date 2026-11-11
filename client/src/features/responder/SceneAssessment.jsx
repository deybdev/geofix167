import { ArrowLeft, Check, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const cardClass = "rounded-[20px] border-2 border-slate-200 bg-white px-5 py-5";
const fieldClass = "rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-[18px]";

function Choice({ selected, children, onClick }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border-2 px-3 py-4 text-left text-[17px] ${selected ? "border-primary bg-[#e2f2eb] font-bold text-primary" : "border-slate-200"}`}>
    <span className={`flex size-5 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary text-white" : "border-slate-500"}`}>{selected && <Check size={13} strokeWidth={4} />}</span>{children}
  </button>;
}

export default function SceneAssessment() {
  const [observed, setObserved] = useState("Yes");
  const [evidence, setEvidence] = useState(null);
  const [showSupportOptions, setShowSupportOptions] = useState(false);
  const evidenceUrl = evidence ? URL.createObjectURL(evidence) : "";
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 pb-5 pt-7">
        <div className="flex items-center gap-4">
          <Link to="/responder/route" aria-label="Go back" className="text-primary"><ArrowLeft size={38} strokeWidth={1.8} /></Link>
          <h1 className="text-[25px] font-bold text-primary">Scene Assessment</h1>
        </div>
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">R</span>
      </header>
      <main className="space-y-4 px-5 py-5 pb-10">
        <section className={cardClass}><p className="text-[21px] font-bold text-primary">Report ID: GF-028</p><h2 className="mt-4 text-[26px] font-bold leading-tight">Vehicle collision on Rizal Street</h2><p className="mt-3 text-[18px]">Rizal Street at Mabini Street, Barangay 167</p><span className="mt-4 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-[16px] font-bold text-primary">Responding • On Scene</span><p className="mt-4 text-[16px] text-slate-500">R. Santos • Traffic/Road Response Team A</p></section>
        <div className="flex gap-3 rounded-xl bg-[#e2f2eb] px-4 py-4 text-[17px] leading-6 text-primary"><Info className="shrink-0" /><span><b>Scene safety first</b><br />Record only safe observations. Do not collect evidence if unsafe.</span></div>
        <section><h2 className="text-[18px] font-bold">Was the incident observed?</h2><div className="mt-3 grid grid-cols-2 gap-3"><Choice selected={observed === "Yes"} onClick={() => setObserved("Yes")}>Yes</Choice><Choice selected={observed === "No"} onClick={() => setObserved("No")}>No</Choice></div><div className="mt-3"><Choice selected={observed === "Unable"} onClick={() => setObserved("Unable")}>Unable to confirm</Choice></div><p className="mt-3 text-[16px] leading-5 text-slate-500">Record factual observations. If the incident cannot be located, document the checks performed and any uncertainty.</p></section>
        <label className="block text-[18px] font-bold">Findings<textarea className={`${fieldClass} mt-2 h-28 w-full`} defaultValue="Two vehicles obstruct one lane near the junction. People gathered at the roadside. No medical assessment recorded." /></label>
        <label className="block text-[18px] font-bold">Safety observations<textarea className={`${fieldClass} mt-2 h-24 w-full`} defaultValue="Moving traffic and vehicle debris near the lane edge. Limited roadside visibility." /></label>
        <section><h2 className="text-[18px] font-bold">People affected</h2><div className="mt-3 grid grid-cols-2 gap-3"><Choice selected>Estimated: 4</Choice><Choice>Unknown</Choice></div></section>
        <section className={cardClass}><h2 className="text-[20px] font-bold text-primary">Photo / Video Evidence</h2><label className="mt-4 flex h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 text-[17px] font-bold text-primary">Add Photo / Video (Optional)<input type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} /></label>{evidence && <div className="mt-4 overflow-hidden rounded-xl border-2 border-slate-200">{evidence.type.startsWith("video/") ? <video src={evidenceUrl} controls className="max-h-64 w-full object-contain" /> : <img src={evidenceUrl} alt="Uploaded incident evidence" className="max-h-64 w-full object-contain" />}<p className="px-3 py-2 text-sm text-slate-500">{evidence.name}</p></div>}<p className="mt-3 text-[15px] text-slate-500">Collect evidence only if safe. Avoid identifiable faces and private information.</p></section>
        <div className="rounded-xl bg-[#e2f2eb] px-4 py-4 text-[17px] leading-6 text-primary"><b>Assessment Only</b><br />Saving does not resolve the report or dispatch support. Closure requires administrator review.</div>
        <Link to={observed === "Yes" ? "/responder/route" : "/responder/incident-not-located"} className="flex h-16 items-center justify-center rounded-xl bg-primary text-[19px] font-bold text-white">{observed === "Yes" ? "Save Assessment" : "Proceed to Incident Not Located"}</Link>
        <button type="button" onClick={() => setShowSupportOptions((current) => !current)} className="h-14 w-full rounded-xl border-2 border-slate-200 text-[17px] font-bold text-primary">Request Additional Support</button>
        {showSupportOptions && (
          <section className={`${cardClass} space-y-3`} aria-label="Additional support options">
            <h2 className="text-[20px] font-bold text-primary">Choose Support Type</h2>
            <p className="text-[15px] leading-5 text-slate-500">Select the process that matches the urgency of the situation.</p>
            <Link to="/responder/emergency-support" className="flex h-14 items-center justify-center rounded-xl bg-primary text-[17px] font-bold text-white">
              Emergency Support
            </Link>
            <Link to="/responder/non-emergency-support" className="flex h-14 items-center justify-center rounded-xl border-2 border-primary text-[17px] font-bold text-primary">
              Non-Emergency Support
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
