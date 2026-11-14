import { LockKeyhole, MapPin, ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="site-container public-page-content flex justify-center bg-[#f5f8f6] text-slate-800">
      <div className="w-full max-w-5xl px-4 sm:px-0">
        <article className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-[0_12px_40px_rgba(15,64,42,0.07)]">
          <header className="bg-[#103725] px-6 py-8 text-white sm:px-10 sm:py-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/30 bg-emerald-300/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100"><ShieldCheck size={13} /> Privacy · GeoFix 167</div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Privacy Policy</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">A short explanation of the information used to receive and respond to Barangay 167 reports.</p>
          </header>
          <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-10">
            <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-[#247447]"><MapPin size={17} /></div>
              <h2 className="font-bold text-slate-900">Information in a report</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Reports may include your description, selected location or coordinates, category, urgency, and any photo or video you attach. Signed-in accounts also provide account details needed to manage your reports.</p>
            </section>
            <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-[#247447]"><LockKeyhole size={17} /></div>
              <h2 className="font-bold text-slate-900">How it is used</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Authorized barangay staff use report details to review, assign, respond, and update the report. Access to private report details is limited by account permissions.</p>
            </section>
            <section className="rounded-xl border border-slate-200 p-5 sm:col-span-2">
              <h2 className="font-bold text-slate-900">Public information and questions</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Only information selected for publication, such as approved community updates or accomplishment summaries, appears in public areas. Do not include information in a report that is unrelated to resolving the issue. For privacy questions, contact Barangay 167 through its official channels.</p>
            </section>
          </div>
        </article>
      </div>
    </div>
  );
}
