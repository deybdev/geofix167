import { useState } from "react";
import { useAuth } from "../../shared/hooks/useAuth";

function Toggle({ label, value, setValue }) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-[#edf0f2] pt-4">
      <span className="text-sm font-semibold text-[#263246]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => setValue(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-(--gf-green)" : "bg-[#c8d2da]"}`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

export default function BdrrmoSettings() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [compact, setCompact] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-(--gf-green-soft) p-3 text-(--gf-green)">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" className="text-(--gf-green)">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <div>
          <h2 className="text-lg font-bold text-[#263246]">Profile & Settings</h2>
          <p className="text-xs text-[#60738f]">Manage BDRRMO dashboard preferences and session details.</p>
        </div>
      </div>
      <section className="max-w-3xl rounded-xl border border-[#e2e8eb] bg-white p-5 shadow-sm">
        <h3 className="font-bold text-[#263246]">Account</h3>
        <div className="mt-3 rounded-lg bg-[#f8fafb] p-4">
          <strong className="text-sm text-[#263246]">
            {user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "BDRRMO Officer"}
          </strong>
          <p className="text-xs text-[#60738f]">Role: {user?.role || "bdrrmo"}</p>
        </div>
        <h3 className="mt-6 font-bold text-[#263246]">Dashboard preferences</h3>
        <Toggle label="Operational notifications" value={notifications} setValue={setNotifications} />
        <Toggle label="Compact table density" value={compact} setValue={setCompact} />
        <button
          type="button"
          onClick={() => {
            // Preferences saved (demo)
          }}
          className="mt-5 rounded-md bg-(--gf-green) px-4 py-2 text-xs font-bold text-white hover:bg-(--gf-green-dark)"
        >
          Save preferences
        </button>
      </section>
    </div>
  );
}
