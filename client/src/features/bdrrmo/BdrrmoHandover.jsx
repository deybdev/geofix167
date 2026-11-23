import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";
import { Chip, DrawerSection, InfoRow } from "./ui";
import { statusTone } from "./constants";
import { displayStatus, QR_STATUS } from "./statusModel";
import { validateHandover } from "./validation";
import { useBdrrmoDemo } from "./BdrrmoDemoContext";
import { X, Handshake, ShieldCheck } from "lucide-react";

function HandoverView({ onOpen }) {
  const { handovers } = useBdrrmoDemo();

  return (
    <section className="overflow-hidden rounded-xl border border-[#e2e8eb] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="border-b border-[#e2e8eb] bg-(--gf-surface) text-[10px] font-bold uppercase tracking-wider text-[#60738f]">
              {["Record", "Incident", "Receiver", "Method", "QR Status", "Created", "Action"].map((h) => (
                <th className="px-4 py-3.5" key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {handovers.map((h) => (
              <tr key={h.id} className="border-b border-[#f1f4f6] last:border-b-0 hover:bg-(--gf-row-hover)">
                <td className="px-4 py-3.5 font-bold text-(--gf-green)">{h.id}</td>
                <td className="px-4 py-3.5 font-semibold text-[#263246]">{h.incidentId}</td>
                <td className="px-4 py-3.5">
                  <span className="font-semibold text-[#263246]">{h.receiver}</span>
                  <span className="block text-[10px] text-[#7c8ba3]">{h.receiverType}</span>
                </td>
                <td className="px-4 py-3.5 text-[#60738f]">{h.method}</td>
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
        className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-[#e2e8eb] bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.25)] sm:w-[40%] sm:min-w-[460px] sm:max-w-[600px]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#edf0f2] bg-(--gf-green-soft) px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold text-(--gf-green)">Handover {record.id}</h2>
              <Chip className={statusTone(record.qrStatusCode)}>
                {displayStatus(QR_STATUS, record.qrStatusCode)}
              </Chip>
            </div>
            <p className="mt-0.5 text-[10px] text-[#60738f]">Incident {record.incidentId}</p>
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
          {errors.length > 0 && <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded">{errors.join(", ")}</div>}
          <DrawerSection title="Hospital QR Handover Details" icon={Handshake}>
            <InfoRow label="Incident">{record.incidentId}</InfoRow>
            <InfoRow label="Receiver">{record.receiver}</InfoRow>
            <InfoRow label="Receiving Officer">{record.officer}</InfoRow>
            <InfoRow label="Method">{record.method}</InfoRow>
            <InfoRow label="Created">{record.createdAt}</InfoRow>
            <InfoRow label="Accepted">{record.acceptedAt ?? "Pending scan"}</InfoRow>
            <InfoRow label="Expires">{record.expiresAt ?? "—"}</InfoRow>
          </DrawerSection>
          <DrawerSection title="Remarks" icon={ShieldCheck} last>
            <p className="text-[11px] leading-relaxed text-[#42506a]">{record.remarks}</p>
          </DrawerSection>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#edf0f2] bg-(--gf-green-soft) px-5 py-3">
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
