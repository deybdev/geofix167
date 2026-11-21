import { useState } from "react";
import { Bell, Building2, Globe2, KeyRound, Save, ShieldCheck, Smartphone, Users2 } from "lucide-react";
import { toast } from "../../shared/components/ui/toast";

const TOGGLE_ITEMS = [
  { key: "critical", label: "Critical incident alerts", description: "Immediate push for Critical urgency reports.", defaultChecked: true },
  { key: "digest", label: "Daily operations digest", description: "Morning summary of reports, tasks, and resolutions.", defaultChecked: true },
  { key: "verify", label: "Resolution verification reminders", description: "Remind admin when proof of repair awaits review.", defaultChecked: true },
  { key: "residents", label: "New resident sign-up notifications", description: "Notify when an account awaits verification.", defaultChecked: false },
];

export default function AdminSettings() {
  const [toggles, setToggles] = useState(Object.fromEntries(TOGGLE_ITEMS.map(({ key, defaultChecked }) => [key, defaultChecked])));
  const [profile, setProfile] = useState({ barangay: "Barangay 167 (Llano)", city: "Caloocan City", hotline: "0917-555-0100", responseTeam: "BDRRMO Response" });
  const [session, setSession] = useState("8 hours");

  function toggle(key) {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  }

  function save() {
    toast.add({ title: "Settings saved", description: "Your admin settings were updated successfully.", type: "success" });
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--gf-green-tint) text-(--gf-green)"><ShieldCheck size={18} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold text-(--gf-green)">Admin Settings</h2>
          <p className="text-[9px] text-[#60738f]">Signed in as Admin Moreno • Lead Officer of Barangay 167</p>
        </div>
        <button type="button" onClick={save} className="flex items-center gap-1 rounded-md bg-(--gf-green) px-3 py-2 text-[9px] font-bold text-white hover:bg-(--gf-green-dark)"><Save size={11} /> Save Changes</button>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-[#e2e8eb] bg-white p-4">
          <div className="flex items-center gap-2"><Building2 size={13} className="text-(--gf-green)" /><h3 className="text-[11px] font-bold text-[#263246]">Barangay Profile</h3></div>
          <div className="mt-3 grid gap-2.5">
            {[["barangay", "Barangay Name"], ["city", "City / Municipality"], ["hotline", "Operations Hotline"], ["responseTeam", "Primary Response Team"]].map(([key, label]) => (
              <label key={key} className="grid gap-1 text-[9px] font-semibold text-[#60738f]">
                {label}
                <input value={profile[key]} onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                  className="h-8 rounded-md border border-[#dfe5e8] px-2 text-[10px] text-[#263246] outline-none focus:border-(--gf-green)" />
              </label>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-[#e2e8eb] bg-white p-4">
          <div className="flex items-center gap-2"><Bell size={13} className="text-(--gf-green)" /><h3 className="text-[11px] font-bold text-[#263246]">Notification Preferences</h3></div>
          <div className="mt-3 grid gap-2">
            {TOGGLE_ITEMS.map(({ key, label, description }) => (
              <button key={key} type="button" role="switch" aria-checked={toggles[key]} onClick={() => toggle(key)}
                className="flex items-center justify-between gap-3 rounded-md border border-[#edf0f2] px-3 py-2.5 text-left hover:border-(--gf-green-border)">
                <span className="min-w-0">
                  <strong className="block text-[10px] font-bold text-[#263246]">{label}</strong>
                  <span className="text-[9px] text-[#60738f]">{description}</span>
                </span>
                <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${toggles[key] ? "bg-(--gf-green)" : "bg-[#dfe5e8]"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${toggles[key] ? "left-[18px]" : "left-0.5"}`} />
                </span>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-lg border border-[#e2e8eb] bg-white p-4">
          <div className="flex items-center gap-2"><KeyRound size={13} className="text-(--gf-green)" /><h3 className="text-[11px] font-bold text-[#263246]">Security</h3></div>
          <div className="mt-3 grid gap-2.5">
            <button type="button" onClick={() => toast.add({ title: "Verification on the way", description: "A one-time code was sent to your registered mobile.", type: "info" })} className="flex items-center justify-between gap-3 rounded-md border border-[#edf0f2] px-3 py-2.5 text-left hover:border-(--gf-green-border)">
              <span><strong className="block text-[10px] font-bold text-[#263246]">Change admin password</strong><span className="text-[9px] text-[#60738f]">Requires mobile OTP verification before updating.</span></span>
              <Smartphone size={14} className="shrink-0 text-(--gf-green)" />
            </button>
            <label className="grid gap-1 text-[9px] font-semibold text-[#60738f]">
              Admin session length
              <select value={session} onChange={(event) => setSession(event.target.value)} className="h-8 rounded-md border border-[#dfe5e8] bg-white px-2 text-[10px] text-[#263246] outline-none focus:border-(--gf-green)">
                {["4 hours", "8 hours", "12 hours", "24 hours"].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>
        </article>

        <article className="rounded-lg border border-[#e2e8eb] bg-white p-4">
          <div className="flex items-center gap-2"><Globe2 size={13} className="text-(--gf-green)" /><h3 className="text-[11px] font-bold text-[#263246]">System</h3></div>
          <div className="mt-3 grid gap-2">
            {[
              ["GeoFix Platform", "v1.4.2 — up to date"],
              ["Map Data", "Barangay 167 boundary • synced"],
              ["Responder Roster", "6 verified responder accounts"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-md bg-[#f8fafb] px-3 py-2.5">
                <strong className="text-[10px] font-bold text-[#263246]">{label}</strong>
                <span className="text-[9px] text-[#60738f]">{value}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-md border border-(--gf-green-border) bg-(--gf-green-soft) px-3 py-2.5">
              <Users2 size={14} className="text-(--gf-green)" />
              <span className="text-[9px] text-[#60738f]">Role-based access is enforced: residents and responders can only reach their own portals.</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
