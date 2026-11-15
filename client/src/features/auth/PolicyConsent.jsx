import { useRef } from "react";
import TermsOfService from "../../pages/TermsOfService";
import PrivacyPolicy from "../../pages/PrivacyPolicy";
import { Button } from "../../shared/components/ui/button";

export const POLICY_VERSION = "2026-11-13";

export default function PolicyConsent({ checked, onChange }) {
  const dialog = useRef(null);
  return <section className="space-y-3 text-sm">
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 leading-5 text-slate-600">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
      <span>I agree to the <button type="button" className="font-semibold text-primary underline" onClick={event => { event.preventDefault(); dialog.current?.showModal(); }}>Terms of Service</button> and acknowledge the Privacy Policy.</span>
    </label>
    <dialog ref={dialog} aria-label="Terms and Privacy" className="m-auto w-[min(92vw,800px)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50">
      <div tabIndex={0} className="max-h-[72vh] overflow-y-auto p-5">
        <h2 className="mb-4 text-xl font-bold text-primary">Terms &amp; Privacy</h2>
        <TermsOfService embedded />
        <hr className="my-6 border-slate-200" />
        <PrivacyPolicy embedded />
      </div>
      <div className="border-t bg-white p-4"><Button type="button" className="w-full" onClick={() => dialog.current.close()}>Done reviewing</Button></div>
    </dialog>
  </section>;
}
