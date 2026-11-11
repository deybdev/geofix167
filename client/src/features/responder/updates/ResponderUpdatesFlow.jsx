import {
  ArrowLeft,
  Check,
  FileCheck2,
  FileText,
  Info,
  TriangleAlert,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { setResponderMeta } from "../responderMeta";

const STORAGE_KEY = "geofix.responder.updates.GF-041";
const cardClass = "rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const fieldClass = "mt-2 w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-700 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const primaryButton = "flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "flex min-h-14 w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 text-base font-bold text-primary";

const initialState = {
  responseSubmitted: false,
  decision: "",
  responseNote: "Arrived 9:55 AM. Traffic-control assistance completed 10:12 AM. Actions documented for administrator review.",
  completionTime: "April 22, 2026 • 10:12 AM",
  noHandoverReason: "",
  actionTaken: "",
  completionSummary: "",
  completionDateTime: "",
  evidenceName: "GF006_response_log.pdf",
  receivingOfficial: "N/A",
  receivingOfficialReason: "No receiving official identified at the scene.",
  department: "N/A",
  departmentReason: "Receiving agency not yet verified.",
  contactInformation: "N/A",
  handoverTime: "Not yet completed",
  acknowledgmentMethod: "Not obtained",
  acknowledgmentExplanation: "Receiver not ready; no acknowledgment received.",
  acknowledgmentReference: "",
  handoverSubmitted: false,
  receiverReady: false,
  readinessAttemptTime: "November 3, 2026 • 2:20 PM",
  readinessReason: "No receiving official identified and ready to accept responsibility at the scene.",
  contactAttempts: "Receiver readiness checked on scene. Agency and official contact unverified; no acknowledgment obtained.",
  nextUpdate: "Recheck when official availability is verified. Update sooner if scene conditions change.",
  updateTimestamp: "November 3, 2026 • 2:30 PM",
};

function readState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialState, ...JSON.parse(saved) } : initialState;
  } catch {
    return initialState;
  }
}

function useWorkflow() {
  const [state, setState] = useState(readState);
  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);
  function update(patch) {
    setState((current) => ({ ...current, ...patch }));
  }
  return [state, update];
}

const steps = {
  "/responder/updates": ["Response Review", "Review the completed response and submit its evidence for administrator verification."],
  "/responder/updates/handover-decision": ["Handover Decision", "Decide whether the completed response requires an official handover."],
  "/responder/updates/no-official-handover": ["No Official Handover", "Provide the rationale and completion details when no official handover is required."],
  "/responder/updates/handover-details": ["Handover Details", "Record the receiving official, handover timing, acknowledgement, and supporting evidence."],
  "/responder/updates/receiver-not-ready": ["Receiver Not Ready", "Record why the receiving official is not ready and keep the case open for follow-up."],
  "/responder/updates/record-submitted": ["Record Submitted", "Review the submitted handover record and its pending administrator review status."],
};

function Header({ title, backTo }) {
  return <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pb-5 pt-6 sm:px-7 sm:pt-9">
    <div className="flex min-w-0 items-center gap-3 sm:gap-5">
      <Link to={backTo} aria-label="Go back" className="shrink-0 text-primary"><ArrowLeft size={38} strokeWidth={1.8} /></Link>
      <h1 className="truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">{title}</h1>
    </div>
    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-white sm:size-16 sm:text-2xl">R</span>
  </header>;
}

function IncidentCard({ compact = false }) {
  return <section className={cardClass}>
    <p className="font-bold text-primary sm:text-lg">Report ID: GF-041</p>
    <h2 className={`${compact ? "mt-3 text-xl" : "mt-4 text-2xl"} font-bold leading-tight`}>Road obstruction on Mabini Street</h2>
    <p className="mt-3 text-base leading-6">Mabini Street at Rizal Street, Barangay 167</p>
    <span className="mt-3 inline-flex rounded-lg bg-[#e2f2eb] px-3 py-2 text-sm font-bold text-primary">Responding • On Scene</span>
    <p className="mt-3 text-sm text-slate-500">R. Santos • Traffic/Road Response Team A</p>
  </section>;
}

function Notice({ tone = "green", title, children }) {
  const styles = tone === "yellow" ? "bg-[#fff1c8] text-[#a66a00]" : "bg-[#e2f2eb] text-primary";
  const Icon = tone === "yellow" ? TriangleAlert : Info;
  return <div className={`flex gap-3 rounded-2xl px-4 py-4 text-base leading-6 ${styles}`}><Icon className="mt-0.5 shrink-0" size={22} /><p><b>{title}</b><br />{children}</p></div>;
}

function Field({ label, value, onChange, placeholder, multiline = false, required = false }) {
  const props = { value: value ?? "", onChange: (event) => onChange(event.target.value), placeholder, required };
  return <label className="block text-sm font-bold">{label}{multiline ? <textarea {...props} className={`${fieldClass} min-h-24`} /> : <input {...props} className={fieldClass} />}</label>;
}

function EvidencePicker({ state, update }) {
  return <section className={cardClass}>
    <h2 className="text-xl font-bold text-primary">Supporting evidence / document</h2>
    <div className="mt-3 flex items-center gap-3">
      <FileCheck2 className="shrink-0 text-primary" size={32} />
      <div className="min-w-0"><p className="truncate font-bold">{state.evidenceName || "No attachment added"}</p><p className="text-sm text-slate-500">{state.evidenceName ? "Attachment ready for administrator review" : "Add a file when evidence is available"}</p></div>
    </div>
    <label className={`${secondaryButton} mt-4 cursor-pointer`}>
      {state.evidenceName ? "Replace Evidence / Document" : "Add Evidence / Document"}
      <input type="file" className="sr-only" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => update({ evidenceName: event.target.files?.[0]?.name || state.evidenceName })} />
    </label>
  </section>;
}

function ResponseReview() {
  const [state, update] = useWorkflow();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    if (!state.responseNote.trim() || !state.completionTime.trim()) {
      setError("Add the completion time and response note before submitting.");
      return;
    }
    update({ responseSubmitted: true });
    navigate("/responder/updates/handover-decision");
  }
  return <><Header title="Response Review" backTo="/responder/updates" /><form onSubmit={submit} className="space-y-4 px-4 py-5 pb-8 sm:px-7 sm:py-6">
    <p className="text-base leading-6 text-slate-500">GF-006 • Responding<br />Work completed / Awaiting administrator review</p>
    <IncidentCard />
    <section className={cardClass}><h2 className="text-xl font-bold">Responding • Work status</h2><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{["Dispatched", "En route", "On scene", "Completed"].map((status) => <span key={status} className={`rounded-xl border-2 px-2 py-4 text-center text-sm font-bold ${status === "Completed" ? "border-primary bg-primary text-white" : "border-slate-200 text-slate-500"}`}>{status}</span>)}</div><Field label="Status date and time" value={state.completionTime} onChange={(value) => update({ completionTime: value })} required /><Field label="Response note" value={state.responseNote} onChange={(value) => update({ responseNote: value })} multiline required /></section>
    <EvidencePicker state={state} update={update} />
    <Notice title="Work completed. Awaiting administrator verification.">Incident remains open until officially reviewed.</Notice>
    {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
    <button type="submit" className={primaryButton}>Submit for Administrator Verification</button>
  </form></>;
}

function HandoverDecision() {
  const [state, update] = useWorkflow();
  const navigate = useNavigate();
  return <><Header title="Handover Decision" backTo="/responder/updates" /><main className="space-y-4 px-4 py-5 pb-8 sm:px-7 sm:py-6">
    <IncidentCard /><Notice title="Official handover">Indicate whether responsibility must be transferred to another authorized department or official. Keep the current department assigned until the receiving party is confirmed.</Notice>
    <section className={cardClass}><h2 className="text-xl font-bold text-primary">Is Official Handover Required?</h2><div className="mt-4 space-y-3">{[["yes", "Yes", "Continue to receiving department and authorized official details."], ["no", "No", "Provide the reason no handover is required and summarize the completed actions."]].map(([value, label, detail]) => <button key={value} type="button" onClick={() => update({ decision: value })} className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left ${state.decision === value ? "border-primary bg-[#e2f2eb]" : "border-slate-200"}`}><span className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${state.decision === value ? "border-primary bg-primary text-white" : "border-slate-400"}`}>{state.decision === value && <Check size={14} />}</span><span><b className="text-lg">{label}</b><br /><span className="text-base leading-6 text-slate-600">{detail}</span></span></button>)}</div><p className="mt-4 text-sm text-slate-500">Choose Yes for handover details or No for the no-handover rationale.</p></section>
    <button type="button" disabled={!state.decision} onClick={() => navigate(state.decision === "no" ? "/responder/updates/no-official-handover" : "/responder/updates/handover-details")} className={primaryButton}>Continue</button>
    <Notice tone="yellow" title="A handover decision is not case closure">Neither choice closes the case. Administrator review is required for either path.</Notice>
    <section className={cardClass}><h2 className="text-xl font-bold text-primary">Incident lifecycle • Separate from handover</h2><p className="mt-4">Reported → Verification → Dispatched → Responding → Resolved</p><p className="mt-4 text-sm leading-5 text-slate-500">Responding / On Scene • Case open. Handover or record submission is not resolution. Administrator closure review required.</p></section>
  </main></>;
}

function NoOfficialHandover() {
  const [state, update] = useWorkflow();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    if (!state.noHandoverReason.trim() || !state.actionTaken.trim() || !state.completionSummary.trim() || !state.completionDateTime.trim()) {
      setError("Complete all required rationale and completion fields before submitting.");
      return;
    }
    update({ handoverSubmitted: true });
    navigate("/responder/updates/record-submitted");
  }
  return <><Header title="No Official Handover" backTo="/responder/updates/handover-decision" /><form onSubmit={submit} className="space-y-4 px-4 py-5 pb-8 sm:px-7 sm:py-6">
    <IncidentCard compact /><Notice tone="yellow" title="No handover required; administrator review pending">GF-041 • No-handover draft, separate from the Awaiting Official record. Administrator closure approval is still required.</Notice>
    <section className={cardClass}><h2 className="text-xl font-bold text-primary">No-handover rationale</h2><div className="mt-4 space-y-4"><Field label="Why is handover not required? *" value={state.noHandoverReason} onChange={(value) => update({ noHandoverReason: value })} placeholder="Explain why official receipt or transfer is not needed" multiline required /><Field label="Action taken *" value={state.actionTaken} onChange={(value) => update({ actionTaken: value })} placeholder="Record the response actions actually performed" required /><Field label="Response completion summary *" value={state.completionSummary} onChange={(value) => update({ completionSummary: value })} placeholder="Describe the result, remaining risks and follow-up needed" multiline required /></div></section>
    <Field label="Response completion date / time *" value={state.completionDateTime} onChange={(value) => update({ completionDateTime: value })} placeholder="Select actual completion date and time" required /><EvidencePicker state={state} update={update} /><Notice title="Case remains open">Work completion does not automatically resolve the incident. Await administrator verification and approval before closure.</Notice>{error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}<button type="submit" className={primaryButton}>Submit for Administrator Review</button><button type="button" onClick={() => setError("Draft saved on this device.")} className={secondaryButton}>Save Draft</button>
  </form></>;
}

function HandoverDetails() {
  const [state, update] = useWorkflow();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    if (!state.receivingOfficial.trim() || !state.department.trim() || !state.handoverTime.trim()) {
      setError("Complete the receiving official, department, and handover time fields.");
      return;
    }
    update({ handoverSubmitted: true });
    navigate("/responder/updates/receiver-not-ready");
  }
  return <><Header title="Handover Details" backTo="/responder/updates/handover-decision" /><form onSubmit={submit} className="space-y-4 px-4 py-5 pb-8 sm:px-7 sm:py-6">
    <IncidentCard compact /><Notice tone="yellow" title="Awaiting Official">Handover not completed. An incomplete record may be submitted for review. N/A does not confirm handover.</Notice>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Receiving official details</h2><div className="mt-4 space-y-4"><Field label="Receiving official name *" value={state.receivingOfficial} onChange={(value) => update({ receivingOfficial: value })} required /><Field label="Why is the official's name unavailable? *" value={state.receivingOfficialReason} onChange={(value) => update({ receivingOfficialReason: value })} required /><Field label="Department / agency *" value={state.department} onChange={(value) => update({ department: value })} required /><Field label="Why is department / agency unavailable? *" value={state.departmentReason} onChange={(value) => update({ departmentReason: value })} required /><Field label="Contact information • Optional if obtainable" value={state.contactInformation} onChange={(value) => update({ contactInformation: value })} /></div></section>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Actual handover date / time</h2><Field label="Handover event time *" value={state.handoverTime} onChange={(value) => update({ handoverTime: value })} required /></section>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Acknowledgment</h2><div className="mt-4 space-y-4"><Field label="Acknowledgment method *" value={state.acknowledgmentMethod} onChange={(value) => update({ acknowledgmentMethod: value })} required /><Field label="Explanation when not obtained *" value={state.acknowledgmentExplanation} onChange={(value) => update({ acknowledgmentExplanation: value })} multiline required /><Field label="Method / reference when obtained" value={state.acknowledgmentReference} onChange={(value) => update({ acknowledgmentReference: value })} placeholder="Enter acknowledgment reference" /></div><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Acknowledgment pending</span></section>
    <EvidencePicker state={state} update={update} /><Notice title="Incomplete record submission">Handover is not yet complete. The receiving department must acknowledge and accept the transfer before it is confirmed.</Notice>{error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}<button type="submit" className={primaryButton}>Submit Handover Record</button><button type="button" onClick={() => setError("Draft saved on this device.")} className={secondaryButton}>Save Draft</button><button type="button" onClick={() => navigate("/responder/updates/receiver-not-ready")} className={secondaryButton}>Receiver Not Ready</button>
  </form></>;
}

function ReceiverNotReady() {
  const [state, update] = useWorkflow();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    if (!state.readinessAttemptTime.trim() || !state.readinessReason.trim() || !state.contactAttempts.trim() || !state.nextUpdate.trim() || !state.updateTimestamp.trim()) {
      setError("Complete all readiness update fields before saving.");
      return;
    }
    update({ receiverReady: false });
    navigate("/responder/updates/record-submitted");
  }
  return <><Header title="Receiver Not Ready" backTo="/responder/updates/handover-details" /><form onSubmit={submit} className="space-y-4 px-4 py-5 pb-8 sm:px-7 sm:py-6">
    <IncidentCard compact /><section className={cardClass}><h2 className="text-lg font-bold text-primary">Handover status</h2><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Awaiting Official</span><p className="mt-3">Actual handover: Not yet completed</p><p className="mt-3 text-sm text-slate-500">Incident lifecycle: Responding • Case open</p></section>
    <Notice tone="yellow" title="Keep the case open">The case remains open until the receiving official accepts the handover or an authorized administrator approves an alternative arrangement.</Notice>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Record readiness update</h2><div className="mt-4 space-y-4"><Field label="Attempt date / time *" value={state.readinessAttemptTime} onChange={(value) => update({ readinessAttemptTime: value })} required /><Field label="Why is the receiver not ready? *" value={state.readinessReason} onChange={(value) => update({ readinessReason: value })} multiline required /><Field label="Contact attempts / checks *" value={state.contactAttempts} onChange={(value) => update({ contactAttempts: value })} multiline required /><Field label="Next update / reason *" value={state.nextUpdate} onChange={(value) => update({ nextUpdate: value })} multiline required /><Field label="Update timestamp" value={state.updateTimestamp} onChange={(value) => update({ updateTimestamp: value })} required /></div></section>
    {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}<button type="submit" className={primaryButton}>Save Update</button><button type="button" onClick={() => navigate("/responder/updates/handover-details")} className={secondaryButton}>Update Handover Status</button><button type="button" onClick={() => update({ receiverReady: true })} className={secondaryButton}>Official Ready: Resume Details</button>
    {state.receiverReady && <Notice title="Receiver marked ready">Return to Handover Details to complete the official acknowledgement.</Notice>}
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Update history</h2><div className="mt-4 space-y-3 text-sm"><p><b>2:20 PM Attempt recorded</b><br /><span className="text-slate-500">R. Santos • Receiver readiness checked at the scene; no receiving official identified.</span></p><p className="border-t border-slate-200 pt-3"><b>2:30 PM Awaiting Official update</b><br /><span className="text-slate-500">R. Santos • No receiver ready. Identity, agency and contact remain unavailable.</span></p></div></section>
  </form></>;
}

function RecordSubmitted() {
  const [state, update] = useWorkflow();
  const navigate = useNavigate();
  return <><Header title="Record Submitted" backTo="/responder/updates/receiver-not-ready" /><main className="space-y-4 px-4 py-5 pb-8 sm:px-7 sm:py-6">
    <Notice title="Handover record submitted">Incomplete handover record submitted for administrator review. The receiving official has not yet accepted the transfer.</Notice>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Handover reference: HO-041</h2><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Pending Admin Review</span><Field label="Report reference" value="GF-041" onChange={() => {}} /><Field label="Submitted date / time" value="November 3, 2026 • 2:35 PM" onChange={() => {}} /></section>
    <IncidentCard compact /><section className={cardClass}><h2 className="text-lg font-bold text-primary">Actual handover status</h2><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Awaiting Official</span><p className="mt-3">Handover time: {state.handoverTime}</p><p className="mt-3 text-sm text-slate-500">Administrator review pending. Case remains Responding / open.</p></section>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Submitted receiver details</h2><Field label="Receiving official" value={state.receivingOfficial} onChange={(value) => update({ receivingOfficial: value })} /><Field label="Department / agency" value={state.department} onChange={(value) => update({ department: value })} /><Field label="Contact information" value={state.contactInformation} onChange={(value) => update({ contactInformation: value })} /></section>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Acknowledgment status</h2><span className="mt-3 inline-flex rounded-lg bg-[#fff1c8] px-3 py-2 text-sm font-bold text-[#a66a00]">Not obtained • Pending</span><p className="mt-3">{state.acknowledgmentExplanation}</p></section>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Supporting evidence / document</h2><p className="mt-3 flex items-center gap-3"><FileText className="text-primary" />{state.evidenceName || "No attachment added"}</p><button type="button" onClick={() => navigate("/responder/updates/handover-details")} className={`${secondaryButton} mt-4`}>Update Attachment</button></section>
    <button type="button" onClick={() => navigate("/responder/updates/handover-details")} className={primaryButton}>View Handover</button><button type="button" onClick={() => navigate("/responder/updates/handover-details")} className={secondaryButton}>Update Requested Details</button>
    <section className={cardClass}><h2 className="text-lg font-bold text-primary">Incident lifecycle • Separate from handover</h2><p className="mt-3 text-sm">Reported → Verification → Dispatched → Responding → Resolved</p><p className="mt-3 text-sm text-slate-500">Current status: Responding / On Scene. The incident remains open. Administrator review is required before closure.</p></section>
  </main></>;
}

export default function ResponderUpdates() {
  const { pathname } = useLocation();
  const page = steps[pathname] || steps["/responder/updates"];
  useEffect(() => setResponderMeta(page[0], page[1]), [page]);
  if (pathname.endsWith("handover-decision")) return <HandoverDecision />;
  if (pathname.endsWith("no-official-handover")) return <NoOfficialHandover />;
  if (pathname.endsWith("handover-details")) return <HandoverDetails />;
  if (pathname.endsWith("receiver-not-ready")) return <ReceiverNotReady />;
  if (pathname.endsWith("record-submitted")) return <RecordSubmitted />;
  return <ResponseReview />;
}
