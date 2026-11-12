import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  MapPin,
  Send,
  AlertTriangle,
  Camera,
  Layers,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { PATHS } from "../../../router/paths";
import { toast } from "../../../shared/components/ui/toast";

export default function ResidentReportingCard({
  reports = [],
  selectedReport = null,
  onSelectReport = () => {},
  onSubmitNewReport = () => {},
  activeTab = "active",
  setActiveTab = () => {},
  selectedCoordinates = null,
  isPickingLocation = false,
  setIsPickingLocation = () => {},
}) {
  // Quick Report Form state
  const [formData, setFormData] = useState({
    type: "sudden",
    category: "Fire Incident",
    street: "Molave St.",
    description: "",
    urgency: "High",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTypeChange = (type) => {
    const defaultCat =
      type === "sudden" ? "Fire Incident" : "Drainage / Flooding";
    setFormData((prev) => ({
      ...prev,
      type,
      category: defaultCat,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      toast.add({
        title: "Description required",
        description: "Please provide a brief description of the incident.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      reporter_type: "RESIDENT",
      is_emergency: formData.type === "sudden" ? 1 : 0,
      incident_category: formData.category,
      priority_level: formData.urgency ? formData.urgency.toUpperCase() : "HIGH",
      description: formData.description.trim(),
      reverse_geocoded_address: formData.street.trim() || null,
      ...(selectedCoordinates?.lat != null && selectedCoordinates?.lng != null
        ? {
            latitude: Number(selectedCoordinates.lat),
            longitude: Number(selectedCoordinates.lng),
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
      const referenceNumber =
        savedReport?.reference_number || `GF167-${Date.now().toString().slice(-4)}`;

      const lat =
        savedReport?.latitude ??
        selectedCoordinates?.lat ??
        14.735 + (Math.random() - 0.5) * 0.006;
      const lng =
        savedReport?.longitude ??
        selectedCoordinates?.lng ??
        121.015 + (Math.random() - 0.5) * 0.006;

      const newReport = {
        id: savedReport?.incident_id || referenceNumber,
        reportNumber: referenceNumber,
        type: formData.type,
        category: formData.category,
        title: `${formData.category}`,
        location: formData.street,
        status: "in-progress",
        statusLabel: savedReport?.status_label || "Pending - Received",
        urgency: formData.urgency || "High",
        reportedAt: "Just now",
        lat,
        lng,
        description: savedReport?.sanitized_description ?? formData.description,
        hasProof: false,
      };

      onSubmitNewReport(newReport);
      setFormData({
        type: "sudden",
        category: "Fire Incident",
        street: "Molave St.",
        description: "",
        urgency: "High",
      });
      setIsPickingLocation(false);
      setActiveTab("active");

      toast.add({
        title: "Report Submitted Successfully!",
        description: `Reference #${referenceNumber} has been logged and pinned on Barangay 167 map.`,
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
    <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Card Header: Matching Screenshot */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
            Resident Reporting Dashboard
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Live public reports & community response tracker
          </p>
        </div>
      </div>

      {/* Tabs: [Active Reports] | [Submit Report] */}
      <div className="mt-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setActiveTab("active");
            setIsPickingLocation(false);
          }}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
            activeTab === "active"
              ? "bg-[#2E8B57] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>Active Reports</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              activeTab === "active"
                ? "bg-white/20 text-white"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {reports.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("submit")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
            activeTab === "submit"
              ? "bg-[#2E8B57] text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>Submit Report</span>
        </button>
      </div>

      {/* Tab 1: Active Reports List */}
      {activeTab === "active" && (
        <div className="mt-4 flex flex-col gap-2.5 overflow-y-auto max-h-[300px] pr-1 scrollbar-thin">
          {reports.map((report) => {
            const isSelected = selectedReport?.id === report.id;
            return (
              <div
                key={report.id}
                onClick={() => onSelectReport(report)}
                className={`group cursor-pointer rounded-xl border p-3 transition-all ${
                  isSelected
                    ? "border-[#2E8B57] bg-emerald-50/50 shadow-sm"
                    : "border-slate-100 bg-slate-50/60 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    <CheckCircle
                      size={17}
                      className={
                        report.status === "resolved"
                          ? "text-emerald-600"
                          : "text-[#2E8B57]"
                      }
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-[#2E8B57] transition-colors leading-snug">
                      Report {report.reportNumber}: {report.title} - {report.location}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                      ({report.statusLabel})
                    </p>
                  </div>

                  {report.hasProof && (
                    <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                      QR Verified
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Click any report to zoom on map</span>
            <span className="text-[#2E8B57] font-semibold">Auto-refreshed</span>
          </div>
        </div>
      )}

      {/* Tab 2: Submit Report Form */}
      {activeTab === "submit" && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {/* Report Type selector */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Issue Classification
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("sudden")}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-all ${
                  formData.type === "sudden"
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
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-all ${
                  formData.type === "maintenance"
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>Maintenance Issue</span>
              </button>
            </div>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Specific Category
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#2E8B57] focus:ring-1 focus:ring-[#2E8B57]"
            >
              {formData.type === "sudden" ? (
                <>
                  <option>Fire Incident</option>
                  <option>Medical Emergency</option>
                  <option>Crime / Public Disturbance</option>
                  <option>Road Accident</option>
                </>
              ) : (
                <>
                  <option>Drainage / Flooding</option>
                  <option>Streetlight</option>
                  <option>Road Damage / Pothole</option>
                  <option>Garbage Collection</option>
                  <option>Water / Power Hazard</option>
                </>
              )}
            </select>
          </div>

          {/* Street / Location */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Location / Street Name
              </label>
              <button
                type="button"
                onClick={() => setIsPickingLocation(!isPickingLocation)}
                className={`text-[11px] font-bold flex items-center gap-1 ${
                  isPickingLocation ? "text-red-600 animate-pulse" : "text-[#2E8B57]"
                }`}
              >
                <MapPin size={12} />
                {isPickingLocation ? "Click map to set" : "Pick on Map"}
              </button>
            </div>
            <input
              type="text"
              value={formData.street}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, street: e.target.value }))
              }
              placeholder="e.g. Molave St., Purok 3"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57] focus:ring-1 focus:ring-[#2E8B57]"
              required
            />
            {selectedCoordinates && (
              <p className="mt-1 text-[10px] text-emerald-700 font-semibold">
                ✓ Pinned at [{selectedCoordinates.lat.toFixed(4)}, {selectedCoordinates.lng.toFixed(4)}]
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Description / Notes
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Describe the condition, visible hazards, or urgency..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57] focus:ring-1 focus:ring-[#2E8B57] resize-none"
              required
            />
          </div>

          {/* Urgency selector */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Urgency:
            </span>
            <div className="flex gap-1.5">
              {["Low", "Medium", "High"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, urgency: lvl }))
                  }
                  className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
                    formData.urgency === lvl
                      ? "bg-[#ea580c] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2E8B57] py-2.5 text-xs font-bold text-white shadow transition-all hover:bg-[#247447] active:scale-[0.99] disabled:opacity-50"
          >
            <Send size={14} />
            {isSubmitting ? "Submitting Ticket..." : "Submit Geotagged Report"}
          </button>

          <div className="pt-2 border-t border-slate-100 text-center">
            <Link
              to={PATHS.resident}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2E8B57] hover:underline"
            >
              <Camera size={13} />
              <span>Resident sign-in for live photo/video capture</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

