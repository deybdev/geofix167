import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";
import { Chip, DrawerSection, InfoRow } from "./ui";
import { statusTone } from "./constants";
import { displayStatus, QR_STATUS } from "./statusModel";
import { validateHandover } from "./validation";
import { useBdrrmoDemo } from "./BdrrmoDemoContext";
import { X, Handshake, ShieldCheck, Users, Camera, Download } from "lucide-react";

function HandoverView({ onOpen }) {
  const { handovers } = useBdrrmoDemo();

  return (
    <section className="overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
              {["Record", "Incident", "Receiving Hospital", "Patients", "QR Status", "Created (PH)", "Action"].map((h) => (
                <th className="px-4 py-3.5" key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {handovers.map((h) => (
              <tr key={h.id} className="border-b border-[#f1f4f6] last:border-b-0 hover:bg-(--gf-row-hover)">
                <td className="px-4 py-3.5 font-bold text-(--gf-green)">{h.id}</td>
                <td className="px-4 py-3.5 font-semibold text-[#263246]">{h.incidentRef || h.incidentId}</td>
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-[#263246]">{h.hospitalName || h.receiver}</span>
                  <span className="block text-[10px] text-[#7c8ba3]">{h.receiverType}</span>
                </td>
                <td className="px-4 py-3.5 text-[#42506a]">
                  {h.patients?.length ? `${h.patients.length} person${h.patients.length > 1 ? "s" : ""}` : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <Chip className={statusTone(h.qrStatusCode)}>
                    {displayStatus(QR_STATUS, h.qrStatusCode)}
                  </Chip>
                </td>
                <td className="px-4 py-3.5 text-[11px] text-[#60738f]">{h.createdAt}</td>
                <td className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => onOpen(h)}
                    className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-(--gf-green-dark)"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
            {!handovers.length && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-[#60738f]">
                  No hospital QR handover records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HandoverDrawer({ record, onClose, onIncident }) {
  const errors = validateHandover(record, { correctionReason: record.remarks });
  const patients = Array.isArray(record.patients) ? record.patients : [];
  const photoUrl = record.proofMediaId
    ? `/api/reports/${encodeURIComponent(record.incidentId)}/photos/${encodeURIComponent(record.proofMediaId)}`
    : null;

  return (
    <>
      <button
        type="button"
        aria-label="Close handover drawer"
        onClick={onClose}
        className="fixed inset-0 z-[80] cursor-default border-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Handover ${record.id}`}
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] sm:w-[44%] sm:min-w-[460px] sm:max-w-[620px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f2] bg-(--gf-green-soft) px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">Handover {record.id}</h2>
              <Chip className={statusTone(record.qrStatusCode)}>
                {displayStatus(QR_STATUS, record.qrStatusCode)}
              </Chip>
            </div>
            <p className="mt-0.5 text-[11px] font-semibold text-[#60738f]">
              Incident {record.incidentRef || record.incidentId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#60738f] transition hover:bg-white hover:text-(--gf-green)"
          >
            <X size={16} />
          </button>
        </header>

        <div className="gf-drawer-body">
          {errors.length > 0 && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{errors.join(", ")}</div>}

          <DrawerSection title="Hospital QR Handover Information" icon={Handshake}>
            <InfoRow label="Incident Reference">{record.incidentRef || record.incidentId}</InfoRow>
            <InfoRow label="Receiving Hospital">{record.hospitalName || record.receiver}</InfoRow>
            <InfoRow label="Receiving Officer">{record.officer}</InfoRow>
            <InfoRow label="Handover Method">{record.method}</InfoRow>
            <InfoRow label="Created">{record.createdAt}</InfoRow>
            <InfoRow label="Accepted">{record.acceptedAt ?? "Pending scan"}</InfoRow>
            <InfoRow label="Expires">{record.expiresAt ?? "—"}</InfoRow>
          </DrawerSection>

          <DrawerSection title={`Involved Persons (${patients.length})`} icon={Users}>
            {patients.length > 0 ? (
              <div className="space-y-2.5">
                {patients.map((person, index) => (
                  <div
                    key={`${person.full_name || "person"}-${index}`}
                    className="rounded-lg border border-[#e2e8eb] bg-[#f8fafc] p-3 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#1e293b]">
                        {person.full_name || "Unnamed Person"}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-(--gf-green)">
                        {index === 0 ? "Reporter's Information" : `Additional Person #${index}`}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[#475569]">
                      <div><span className="font-semibold text-[#64748b]">Contact:</span> {person.contact || "—"}</div>
                      <div><span className="font-semibold text-[#64748b]">Age / Sex:</span> {[person.age, person.sex].filter(Boolean).join(" • ") || "—"}</div>
                      <div className="col-span-2"><span className="font-semibold text-[#64748b]">Condition:</span> {person.condition || person.role_in_incident || "—"}</div>
                      {person.notes ? (
                        <div className="col-span-2"><span className="font-semibold text-[#64748b]">Notes:</span> {person.notes}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[#64748b]">No patient or person records attached.</p>
            )}
          </DrawerSection>

          <DrawerSection title="Handover Notes" icon={ShieldCheck}>
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#42506a]">
              {record.furtherInfo || "No additional handover notes provided."}
            </p>
          </DrawerSection>

          <DrawerSection title="Transport Proof Photo" icon={Camera} last>
            {photoUrl ? (
              <a
                href={photoUrl}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-[#e2e8eb] bg-slate-50 transition hover:opacity-95"
              >
                <img
                  src={photoUrl}
                  alt="Transport proof photo"
                  className="max-h-64 w-full object-cover"
                />
                <span className="block px-3 py-1.5 text-[10px] font-semibold text-(--gf-green)">
                  Click to view full-resolution photo
                </span>
              </a>
            ) : (
              <p className="text-[11px] text-[#64748b]">No transport proof photo attached.</p>
            )}
          </DrawerSection>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#edf0f2] bg-(--gf-green-soft) px-5 py-3">
          <a
            href={`/api/reports/${encodeURIComponent(record.incidentId)}/handover-summary`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-(--gf-green) bg-white px-3 py-2 text-[10px] font-bold text-(--gf-green) transition hover:bg-emerald-50"
          >
            <Download size={12} />
            Summary PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#dfe7ea] bg-white px-3 py-2 text-[10px] font-bold text-[#60738f]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onIncident}
            className="rounded-md bg-(--gf-green) px-3.5 py-2 text-[10px] font-bold text-white hover:bg-(--gf-green-dark)"
          >
            Open Linked Incident
          </button>
        </footer>
      </aside>
    </>
  );
}

export default function BdrrmoHandover() {
  const { incidents } = useBdrrmoDemo();
  const navigate = useNavigate();
  const [selectedHandover, setSelectedHandover] = useState(null);

  const openLinkedIncident = (incidentId) => {
    const linked = incidents.find(
      (i) => i.incidentId === incidentId || i.id === incidentId,
    );
    setSelectedHandover(null);
    if (linked) {
      navigate(`${PATHS.bdrrmoIncidents}?incident=${encodeURIComponent(linked.id)}`);
    }
  };

  return (
    <div className="space-y-5">
      <HandoverView onOpen={setSelectedHandover} />

      {selectedHandover && (
        <HandoverDrawer
          record={selectedHandover}
          onClose={() => setSelectedHandover(null)}
          onIncident={() => openLinkedIncident(selectedHandover.incidentId)}
        />
      )}
    </div>
  );
}
