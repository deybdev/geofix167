import { useMemo, useState } from "react";
import { Download, MapPin, Phone, Search, ShieldCheck, UserRound, UserRoundX } from "lucide-react";
import { toast } from "../../shared/components/ui/toast";

const STATUS_STYLES = { "Verified": "bg-[#d9f7e4] text-[#2e8b57]", "Unverified": "bg-[#fff1c6] text-[#e69500]", "Disabled": "bg-[#fdecea] text-[#dc2626]" };

const initialResidents = [
  { id: "usr_res_001", name: "Marvin Navarrete", mobile: "0917•••0167", address: "Blk 4, Rizal Street", verified: true, reports: 3, status: "Verified", joined: "January 2026" },
  { id: "usr_res_002", name: "Rain Opinion", mobile: "0918•••2210", address: "Blk 7, Quezon Avenue", verified: true, reports: 5, status: "Verified", joined: "December 2025" },
  { id: "usr_res_003", name: "Ellyz Gomez", mobile: "0920•••7781", address: "Blk 2, Magsaysay Boulevard", verified: true, reports: 2, status: "Verified", joined: "February 2026" },
  { id: "usr_res_004", name: "Cataluna Jhone", mobile: "0921•••5432", address: "Blk 9, Roxas Boulevard", verified: false, reports: 1, status: "Unverified", joined: "March 2026" },
  { id: "usr_res_005", name: "Rain Santiago", mobile: "0928•••1199", address: "Blk 5, Bonifacio Street", verified: true, reports: 4, status: "Verified", joined: "November 2025" },
  { id: "usr_res_006", name: "Efren Cahilig", mobile: "0936•••8822", address: "Blk 3, Magsaysay Boulevard", verified: false, reports: 0, status: "Unverified", joined: "March 2026" },
  { id: "usr_res_007", name: "Demi Villanueva", mobile: "0945•••3041", address: "Blk 6, Rizal Street", verified: false, reports: 0, status: "Disabled", joined: "October 2025" },
];

export default function Residents() {
  const [residents] = useState(initialResidents);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [reportFilter, setReportFilter] = useState("All Reporters");

  const filtered = useMemo(() => residents.filter((resident) => {
    const search = query.trim().toLowerCase();
    const matchesQuery = !search || `${resident.name} ${resident.address} ${resident.mobile}`.toLowerCase().includes(search);
    const matchesStatus = status === "All Statuses" || resident.status === status;
    const matchesReports = reportFilter === "All Reporters" || (reportFilter === "Active" ? resident.reports > 0 : resident.reports === 0);
    return matchesQuery && matchesStatus && matchesReports;
  }), [residents, query, status, reportFilter]);

  function setVerification(id, verify) {
    toast.add({
      title: verify ? "Verification notice sent" : "Account reviewed",
      description: verify ? "The resident will receive SMS instructions to complete verification." : "Resident account remains unverified.",
      type: verify ? "success" : "info",
    });
  }

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4ed] text-[#2e8b57]"><UserRound size={18} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold text-[#2e8b57]">Residents</h2>
          <p className="text-[9px] text-[#60738f]">{residents.length} registered accounts • {residents.filter((resident) => resident.status === "Verified").length} verified • {residents.filter((resident) => resident.status !== "Verified").length} pending attention</p>
        </div>
        <button type="button" onClick={() => toast.add({ title: "Export ready", description: "Resident directory CSV export generated.", type: "success" })} className="flex items-center gap-1 rounded-md border border-[#d9e8df] px-2.5 py-2 text-[9px] font-semibold text-[#2e8b57]"><Download size={11} /> Export Directory</button>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e2e8eb] bg-white p-2">
        <label className="flex h-7 min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[#dfe5e8] px-2 text-slate-400">
          <Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, address, or mobile..." className="w-full text-[9px] outline-none placeholder:text-slate-400" />
        </label>
        <label className="relative min-w-[120px]">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-7 w-full appearance-none rounded-md border border-[#dfe5e8] bg-white px-2.5 pr-7 text-[9px] text-[#2e8b57] outline-none focus:border-[#2e8b57]">
            {["All Statuses", "Verified", "Unverified", "Disabled"].map((option) => <option key={option}>{option}</option>)}
          </select>
          <ShieldCheck size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2e8b57]" />
        </label>
        <label className="relative min-w-[120px]">
          <select value={reportFilter} onChange={(event) => setReportFilter(event.target.value)} className="h-7 w-full appearance-none rounded-md border border-[#dfe5e8] bg-white px-2.5 pr-7 text-[9px] text-[#2e8b57] outline-none focus:border-[#2e8b57]">
            {["All Reporters", "Active", "No Reports"].map((option) => <option key={option}>{option}</option>)}
          </select>
          <UserRoundX size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2e8b57]" />
        </label>
      </section>

      <section className="rounded-lg border border-[#e2e8eb] bg-white p-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[9px]">
            <thead className="bg-[#f5f8fa] text-[8px] font-bold text-[#60738f]">
              <tr>{["Resident", "Mobile", "Address", "Reports", "Status", "Member Since", "Action"].map((heading) => <th key={heading} className="px-2 py-2 first:rounded-l-md last:rounded-r-md">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((resident) => (
                <tr key={resident.id} className="border-b border-[#e7ecef] last:border-0">
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2e8b57] text-[8px] font-bold text-white">{resident.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                      <div><strong className="block text-[10px] font-bold text-[#263246]">{resident.name}</strong><span className="text-[8px] text-[#7184a0]">{resident.id}</span></div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-[#60738f]"><span className="flex items-center gap-1"><Phone size={10} className="text-[#2e8b57]" />{resident.mobile}</span></td>
                  <td className="px-2 py-3 text-[#60738f]"><span className="flex items-center gap-1"><MapPin size={10} className="text-[#2e8b57]" />{resident.address}</span></td>
                  <td className="px-2 py-3 font-bold text-[#2e8b57]">{resident.reports}</td>
                  <td className="px-2 py-3"><span className={`rounded px-2 py-1 text-[8px] font-bold ${STATUS_STYLES[resident.status]}`}>{resident.status}</span></td>
                  <td className="px-2 py-3 text-[#60738f]">{resident.joined}</td>
                  <td className="px-2 py-3">
                    <button type="button" onClick={() => setVerification(resident.id, resident.status !== "Verified")} className="rounded border border-[#d9e8df] px-2 py-1 text-[8px] font-semibold text-[#2e8b57] hover:bg-[#f3faf6]">
                      {resident.status === "Verified" ? "Revoke" : "Send Verify Notice"}
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan="7" className="py-8 text-center text-xs text-[#60738f]">No residents match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
