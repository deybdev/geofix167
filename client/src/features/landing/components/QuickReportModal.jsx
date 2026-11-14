import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Send, MapPin, Camera, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";
import { PATHS } from "../../../router/paths";
import { toast } from "../../../shared/components/ui/toast";

export default function QuickReportModal({
  isOpen,
  onClose,
  onSubmitNewReport,
  defaultCoordinates = null,
}) {
  const [reportType, setReportType] = useState("sudden");
  const [category, setCategory] = useState("Fire Incident");
  const [street, setStreet] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("High");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTypeChange = (type) => {
    setReportType(type);
    setCategory(type === "sudden" ? "Fire Incident" : "Drainage / Flooding");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.add({
        title: "Description required",
        description: "Please describe the incident.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      reporter_type: "GUEST",
      is_emergency: reportType === "sudden" ? 1 : 0,
      incident_category: category,
      priority_level: urgency ? urgency.toUpperCase() : "HIGH",
      description: description.trim(),
      reverse_geocoded_address: street.trim() || null,
      ...(defaultCoordinates?.lat != null && defaultCoordinates?.lng != null
        ? {
            latitude: Number(defaultCoordinates.lat),
            longitude: Number(defaultCoordinates.lng),
            pin_manually_adjusted: 1,
          }
        : {}),
    };

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || (response.status !== 200 && response.status !== 201)) {
        throw new Error(
          data?.error || "Failed to submit incident report. Please try again.",
        );
      }

      const savedReport = data?.report ?? data;
      if (!savedReport?.incident_id || !savedReport?.reference_number) {
        throw new Error("The server did not return the saved report details. Please try again.");
      }
      if (savedReport.guest_access_token) {
        sessionStorage.setItem(`geofix:guest-report:${savedReport.incident_id}`, savedReport.guest_access_token);
        sessionStorage.setItem("geofix:last-guest-report", savedReport.incident_id);
      }
      const lat = savedReport.latitude == null ? null : Number(savedReport.latitude);
      const lng = savedReport.longitude == null ? null : Number(savedReport.longitude);

      const newReport = {
        id: savedReport.incident_id,
        reportNumber: "",
        type: reportType,
        category: savedReport.category || savedReport.incident_category || category,
        title: savedReport.title || `${category} Incident Report`,
        location: savedReport.location_description || street,
        status: savedReport.status_code || "pending",
        statusLabel: savedReport.status_label || "Submitted",
        urgency: savedReport.priority_level || urgency || "High",
        reportedAt: savedReport.received_at || savedReport.submitted_at,
        ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
        description: savedReport.sanitized_description ?? description,
        hasProof: false,
      };

      onSubmitNewReport?.(newReport);

      // Clear form state
      setReportType("sudden");
      setCategory("Fire Incident");
      setStreet("");
      setDescription("");
      setUrgency("High");

      onClose();
      toast.add({
        title: "Report submitted successfully",
        description: "Your report is saved and will be reviewed by a barangay admin.",
        type: "success",
      });
    } catch (error) {
      toast.add({
        title: "Submission Failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to submit your report right now.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={18} />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Submit Geotagged Report
            </h3>
            <p className="text-xs text-slate-500">
              Barangay 167, Caloocan City · Public Incident Intake
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          
          {/* Classification */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Incident Classification
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("sudden")}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold border transition ${
                  reportType === "sudden"
                    ? "border-red-500 bg-red-50 text-red-900 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <ShieldAlert size={14} className="text-red-600" />
                <span>Sudden Incident</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("maintenance")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition ${
                  reportType === "maintenance"
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Maintenance Issue
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#2E8B57]"
            >
              {reportType === "sudden" ? (
                <>
                  <option>Fire Incident</option>
                  <option>Medical Emergency</option>
                  <option>Road Accident</option>
                  <option>Crime / Public Disturbance</option>
                </>
              ) : (
                <>
                  <option>Drainage / Flooding</option>
                  <option>Streetlight</option>
                  <option>Road Damage / Pothole</option>
                  <option>Garbage Disposal Concern</option>
                  <option>Fallen Tree / Power Cable</option>
                </>
              )}
            </select>
          </div>

          {/* Street / Location */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Location / Street in Barangay 167
            </label>
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. Molave St., Sampaguita Ave., Prosera St."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Incident Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide exact details of the situation, visible risks, or landmarks..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57] resize-none"
              required
            />
          </div>

          {/* Urgency */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Urgency Level:</span>
            <div className="flex gap-2">
              {["Low", "Medium", "High"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setUrgency(lvl)}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                    urgency === lvl
                      ? "bg-[#ea580c] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2E8B57] py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#247447] transition active:scale-[0.99] disabled:opacity-50"
            >
              <Send size={15} />
              {isSubmitting ? "Dispatching..." : "Submit Incident Report"}
            </button>

            <Link
              to={PATHS.resident}
              onClick={onClose}
              className="text-center text-xs font-semibold text-slate-500 hover:text-[#2E8B57]"
            >
              Registered resident? Sign in to attach camera photo & video evidence
            </Link>
          </div>

        </form>

      </div>
    </div>
  );
}

