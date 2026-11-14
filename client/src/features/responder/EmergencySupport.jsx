import { AlertTriangle, ArrowLeft, Check, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import EvidencePreview from "./EvidencePreview";

const cardClass = "rounded-[20px] border-2 border-slate-200 bg-white px-5 py-5";
const fieldClass = "rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-[17px]";

function ServiceChoice({ selected, children, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border-2 px-3 py-4 text-left font-semibold ${selected ? "border-primary bg-[#e2f2eb] text-primary" : "border-slate-200"}`}>
      <span className={`flex size-5 items-center justify-center rounded ${selected ? "bg-primary text-white" : "border-2 border-slate-400"}`}>{selected && <Check size={14} />}</span>
      {children}
    </button>
  );
}

export default function EmergencySupport() {
  const [services, setServices] = useState(["Police", "EMS / Medical"]);
  const [evidence, setEvidence] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const toggleService = (service) => setServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 pb-5 pt-7">
        <div className="flex items-center gap-4"><Link to="/responder/incident-not-located" aria-label="Go back" className="text-primary"><ArrowLeft size={38} /></Link><h1 className="text-[25px] font-bold text-primary">Emergency Support</h1></div>
        <span className="flex size-14 items-center justify-center rounded-full bg-primary font-bold text-white">R</span>
      </header>
      <main className="space-y-4 px-5 py-5 pb-10">
        <span className="inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-[15px] font-bold text-[#a66a00]">Emergency Escalation</span>
        <div className="flex gap-3 rounded-xl bg-[#fff1c8] px-4 py-4 text-[16px] leading-6 text-[#a66a00]"><AlertTriangle className="shrink-0" /><span><b>Emergency escalation must not wait</b><br />Use the established emergency process immediately when required. Do not wait for Front Desk approval.</span></div>
        <button type="button" className="h-14 w-full rounded-xl border-2 border-slate-200 font-bold text-primary">Record Emergency Contact Attempt</button>
        <section className={cardClass}><p className="text-[21px] font-bold text-primary">Report ID: GF-028</p><h2 className="mt-3 text-[26px] font-bold">Vehicle collision on Rizal Street</h2><p className="mt-3">Rizal Street at Mabini Street, Barangay 167</p><span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-[15px] font-bold text-primary">Responding • On Scene</span><p className="mt-3 text-[15px] text-slate-500">R. Santos • Traffic/Road Response Team A</p></section>
        <section><h2 className="text-[18px] font-bold">Select Required Services</h2><div className="mt-3 grid grid-cols-2 gap-3"><ServiceChoice selected={services.includes("Police")} onClick={() => toggleService("Police")}>Police</ServiceChoice><ServiceChoice selected={services.includes("EMS / Medical")} onClick={() => toggleService("EMS / Medical")}>EMS / Medical</ServiceChoice><ServiceChoice selected={services.includes("Fire")} onClick={() => toggleService("Fire")}>Fire</ServiceChoice><ServiceChoice selected={services.includes("Hospital")} onClick={() => toggleService("Hospital")}>Hospital</ServiceChoice></div><p className="mt-3 text-[15px] text-slate-500"><Info size={16} className="mr-1 inline text-primary" />{services.length} service{services.length === 1 ? "" : "s"} requested. Dispatch not yet confirmed.</p></section>
        <label className="block font-bold">Reason and Operational Need<textarea className={`${fieldClass} mt-2 h-28 w-full`} defaultValue="Police assistance for the obstructed junction; EMS / Medical assessment requested. Injuries and diagnoses not established." /></label>
        <label className="block font-bold">Urgency<input className={`${fieldClass} mt-2 w-full`} defaultValue="Emergency • Immediate coordination needed" /></label>
        <label className="block font-bold">Support Location<input className={`${fieldClass} mt-2 w-full`} defaultValue="Rizal Street at Mabini Street, Barangay 167" /></label>
        <section className={cardClass}><h2 className="text-[20px] font-bold text-primary">Photo or video evidence</h2><label className="mt-4 flex h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 font-bold text-primary">Add photo or video (optional)<input type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} /></label>{evidence && <div className="mt-3"><EvidencePreview file={evidence} alt="Emergency support evidence" /></div>}</section>
        <section className={cardClass}><h2 className="text-[20px] font-bold text-primary">Contact Record</h2><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Contact Acknowledgment Pending</span><p className="mt-3">No contact or acknowledgment recorded yet.</p></section>
        {!submitted ? <button type="button" onClick={() => setSubmitted(true)} className="h-16 w-full rounded-xl bg-primary font-bold text-white">Submit Request</button> : <><div className="rounded-xl bg-[#e2f2eb] px-4 py-4 text-primary"><b>Request Submitted</b><br />Emergency support request SR-028 was submitted successfully.</div><Link to="/responder/non-emergency-support" className="flex h-14 items-center justify-center rounded-xl border-2 border-primary font-bold text-primary">Open Non-Emergency Support</Link></>}
      </main>
    </div>
  );
}
