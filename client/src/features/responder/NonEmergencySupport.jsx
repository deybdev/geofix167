import { ArrowLeft, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

const cardClass = "rounded-[20px] border-2 border-slate-200 bg-white px-5 py-5";
const fieldClass = "rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-[17px]";

export default function NonEmergencySupport() {
  const [evidence, setEvidence] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const evidenceUrl = evidence ? URL.createObjectURL(evidence) : "";
  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 pb-5 pt-7">
        <div className="flex items-center gap-4"><Link to="/responder/emergency-support" aria-label="Go back" className="text-primary"><ArrowLeft size={38} /></Link><h1 className="text-[25px] font-bold text-primary">Additional Support</h1></div>
        <span className="flex size-14 items-center justify-center rounded-full bg-primary font-bold text-white">R</span>
      </header>
      <main className="space-y-4 px-5 py-5 pb-10">
        <span className="inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-[15px] font-bold text-primary">Non-Emergency • Front Desk</span>
        <section className={cardClass}><p className="text-[21px] font-bold text-primary">Report ID: GF-029</p><h2 className="mt-3 text-[26px] font-bold">Damaged Drainage Cover</h2><p className="mt-3">Mabini Street near the covered court, Barangay 167</p><span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-[15px] font-bold text-primary">Responding • On Scene</span><p className="mt-3 text-[15px] text-slate-500">L. Reyes • Barangay Maintenance Team Alpha</p></section>
        <div className="flex gap-3 rounded-xl bg-[#e2f2eb] px-4 py-4 text-[16px] leading-6 text-primary"><Info className="shrink-0" /><span><b>Front Desk Approval Is Required</b><br />Non-emergency support requires Front Desk approval and coordination. Responders cannot dispatch another team.</span></div>
        <label className="block font-bold">Requesting Responder<input className={`${fieldClass} mt-2 w-full`} defaultValue="L. Reyes • Barangay Maintenance Team Alpha" /></label>
        <label className="block font-bold">Location<input className={`${fieldClass} mt-2 w-full`} defaultValue="Mabini Street near the covered court, Barangay 167" /></label>
        <label className="block font-bold">Scene Findings<textarea className={`${fieldClass} mt-2 h-24 w-full`} defaultValue="Cracked drainage cover at the pedestrian edge. No active flooding observed. Repair requires equipment the team does not carry." /></label>
        <label className="block font-bold">Assistance Needed<textarea className={`${fieldClass} mt-2 h-28 w-full`} defaultValue="Replacement cover, lifting equipment and a public works crew. The team cannot safely repair the cover with its equipment." /></label>
        <label className="block font-bold">Required Route<input className={`${fieldClass} mt-2 w-full`} defaultValue="Front Desk • Approval and Coordination" /></label>
        <section className={cardClass}><h2 className="text-[20px] font-bold text-primary">Evidence</h2><label className="mt-4 flex h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-slate-200 font-bold text-primary">Add Photo / Video (Optional)<input type="file" accept="image/*,video/*" className="sr-only" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} /></label>{evidence && <div className="mt-3 overflow-hidden rounded-xl border-2 border-slate-200">{evidence.type.startsWith("video/") ? <video src={evidenceUrl} controls className="max-h-56 w-full object-contain" /> : <img src={evidenceUrl} alt="Non-emergency support evidence" className="max-h-56 w-full object-contain" />}<p className="px-3 py-2 text-sm text-slate-500">{evidence.name}</p></div>}</section>
        {!submitted ? <button type="button" onClick={() => setSubmitted(true)} className="h-16 w-full rounded-xl bg-primary font-bold text-white">Submit to Front Desk</button> : <section className={cardClass}><h2 className="text-[20px] font-bold text-primary">After Submission • SR-029</h2><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Pending Front Desk Approval</span><p className="mt-3">Requested • November 3, 2026, 1:45 PM</p><p className="mt-2 text-slate-500">No team dispatched. Awaiting authorized Front Desk review.</p></section>}
      </main>
    </div>
  );
}
