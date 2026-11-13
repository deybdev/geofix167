import { ArrowLeft, Check, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import EvidencePreview from "./EvidencePreview";

const cardClass = "rounded-[20px] border-2 border-slate-200 bg-white px-5 py-5";
const fieldClass = "rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-[18px]";

function Choice({ selected, children, onClick }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-xl border-2 px-3 py-3 text-left text-base ${selected ? "border-primary bg-[#e2f2eb] font-bold text-primary" : "border-slate-200"}`}>
    <span className={`flex size-5 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary text-white" : "border-slate-500"}`}>{selected && <Check size={13} strokeWidth={4} />}</span>{children}
  </button>;
}

export default function SceneAssessment() {
  const [observed, setObserved] = useState("Yes");
  const [evidence, setEvidence] = useState(null);
  const [showSupportOptions, setShowSupportOptions] = useState(false);
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
        <div className="flex gap-2 rounded-xl bg-[#e2f2eb] px-3 py-3 text-sm leading-5 text-primary"><Info className="size-5 shrink-0" /><span><b>Scene safety first</b><br />Record only safe observations. Do not collect evidence if unsafe.</span></div>
        <section><h2 className="text-[18px] font-bold">Was the incident observed?</h2><div className="mt-3 grid grid-cols-2 gap-3"><Choice selected={observed === "Yes"} onClick={() => setObserved("Yes")}>Yes</Choice><Choice selected={observed === "No"} onClick={() => setObserved("No")}>No</Choice></div><div className="mt-3"><Choice selected={observed === "Unable"} onClick={() => setObserved("Unable")}>Unable to confirm</Choice></div><p className="mt-3 text-[16px] leading-5 text-slate-500">Record factual observations. If the incident cannot be located, document the checks performed and any uncertainty.</p></section>
        <label className="block text-base font-bold">Findings<textarea className={`${fieldClass} mt-2 h-24 w-full px-3 py-3 text-base`} defaultValue="Two vehicles obstruct one lane near the junction. People gathered at the roadside. No medical assessment recorded." /></label>
        <label className="block text-base font-bold">Safety observations<textarea className={`${fieldClass} mt-2 h-20 w-full px-3 py-3 text-base`} defaultValue="Moving traffic and vehicle debris near the lane edge. Limited roadside visibility." /></label>
        <section><h2 className="text-base font-bold">People affected</h2><div className="mt-2 grid grid-cols-2 gap-2"><Choice selected>Estimated: 4</Choice><Choice>Unknown</Choice></div></section>
        <section className={cardClass}><h2 className="text-lg font-bold text-primary">Photo or video evidence</h2><label className="mt-3 flex h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 text-base font-bold text-primary">Add photo or video (optional)<input type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} /></label>{evidence && <div className="mt-3"><EvidencePreview file={evidence} alt="Uploaded incident evidence" /></div>}<p className="mt-2 text-xs leading-5 text-slate-500">Collect evidence only if safe. Avoid identifiable faces and private information.</p></section>
        <div className="rounded-xl bg-[#e2f2eb] px-3 py-3 text-sm leading-5 text-primary"><b>Assessment only</b><br />Saving does not resolve the report or dispatch support. Closure requires administrator review.</div>
        <Link to={observed === "Yes" ? "/responder/route" : "/responder/incident-not-located"} className="flex h-12 items-center justify-center rounded-xl bg-primary text-base font-bold text-white">{observed === "Yes" ? "Save Assessment" : "Proceed to Incident Not Located"}</Link>
        <button type="button" onClick={() => setShowSupportOptions((current) => !current)} className="h-12 w-full rounded-xl border-2 border-slate-200 text-base font-bold text-primary">Request Support</button>
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
