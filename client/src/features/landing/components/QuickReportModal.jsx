import GuestReportForm from "./GuestReportForm";

export default function QuickReportModal({ isOpen, onClose, onSubmitNewReport, defaultCoordinates = null }) {
  if (!isOpen) return null;

  return (
    <GuestReportForm
      onClose={onClose}
      onSubmitNewReport={onSubmitNewReport}
      defaultCoordinates={defaultCoordinates}
    />
  );
}
