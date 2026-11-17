import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  LocateFixed,
  Send,
  UserRound,
  X,
} from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import reportCatalog from "../../../../../server/src/shared/reportCatalog.json";
import { isInside } from "../../../shared/utils/mapUtils";
import { PATHS } from "../../../router/paths";
import { toast } from "../../../shared/components/ui/toast";

const DEFAULT_MAP_CENTER = [14.75, 121.02];
const ADDRESS_CACHE = new Map();
let boundaryPromise;
const URGENCY_COLORS = {
  Low: {
    select: "border-emerald-300 bg-emerald-50 text-emerald-800 focus:border-emerald-500",
    option: "bg-emerald-50 text-emerald-800",
  },
  Medium: {
    select: "border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-500",
    option: "bg-amber-50 text-amber-800",
  },
  High: {
    select: "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
    option: "bg-red-50 text-red-800",
  },
};
const CLASSIFICATION_COLORS = {
  sudden: {
    select: "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
    option: "bg-red-50 text-red-800",
  },
  maintenance: {
    select: "border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-500",
    option: "bg-amber-50 text-amber-800",
  },
};
const CATEGORY_COLORS = {
  "Road Damage": "border-amber-300 bg-amber-50 text-amber-800 focus:border-amber-500",
  Electrical: "border-orange-300 bg-orange-50 text-orange-800 focus:border-orange-500",
  Sanitation: "border-sky-300 bg-sky-50 text-sky-800 focus:border-sky-500",
  "Incident / Emergency": "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
};

const REPORT_PIN_ICON = L.divIcon({
  className: "guest-report-pin-icon",
  html: '<span style="display:block;width:18px;height:18px;border:3px solid #fff;border-radius:50%;background:#2e8b57;box-shadow:0 1px 6px #334155"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function getCoordinates(value) {
  if (!value || value.lat == null || value.lng == null) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng, accuracy: Number.isFinite(Number(value.accuracy)) ? Number(value.accuracy) : null };
}

function loadBarangayBoundary() {
  if (!boundaryPromise) {
    boundaryPromise = fetch("/barangay-167.geojson", { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return boundaryPromise;
}

function MapClickHandler({ enabled, onPin }) {
  useMapEvents({
    click(event) {
      if (enabled) onPin({ lat: event.latlng.lat, lng: event.latlng.lng, accuracy: null });
    },
  });
  return null;
}

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16), { animate: false });
  }, [map, position?.lat, position?.lng]);
  return null;
}

function FitBoundary({ boundary, pin }) {
  const map = useMap();
  useEffect(() => {
    if (!boundary || pin) return;
    const bounds = L.geoJSON(boundary).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [8, 8], maxZoom: 16, animate: false });
  }, [boundary, map, pin]);
  return null;
}

function LocationPickerMap({ pin, boundary, manualPinMode, onPin }) {
  const center = pin ? [pin.lat, pin.lng] : DEFAULT_MAP_CENTER;
  const zoom = pin ? 16 : 14;

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className="h-28 w-full rounded-lg">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {boundary && <GeoJSON data={boundary} interactive={false} style={{ color: "#2e8b57", weight: 2, fillOpacity: 0.04 }} />}
      <FitBoundary boundary={boundary} pin={pin} />
      <MapClickHandler enabled={manualPinMode} onPin={onPin} />
      <RecenterMap position={pin} />
      {pin && (
        <Marker
          position={[pin.lat, pin.lng]}
          icon={REPORT_PIN_ICON}
          draggable
          eventHandlers={{
            dragend(event) {
              const position = event.target.getLatLng();
              onPin({ lat: position.lat, lng: position.lng, accuracy: null });
            },
          }}
        />
      )}
    </MapContainer>
  );
}

export default function QuickReportModal(props) {
  if (!props.isOpen) return null;
  return <OpenQuickReportModal {...props} />;
}

function OpenQuickReportModal({ onClose, onSubmitNewReport, defaultCoordinates = null }) {
  const initialPin = getCoordinates(defaultCoordinates);
  const [reportType, setReportType] = useState("sudden");
  const initialClassification = reportCatalog.classifications[0];
  const [category, setCategory] = useState(initialClassification.defaultCategory);
  const [title, setTitle] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [showLocationNote, setShowLocationNote] = useState(false);
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("High");
  const [pin, setPin] = useState(initialPin);
  const pinRef = useRef(initialPin);
  const manualPinRef = useRef(false);
  const locationRequestRef = useRef(0);
  const [locationStatus, setLocationStatus] = useState("loading");
  const [locationError, setLocationError] = useState("");
  const [manualPinMode, setManualPinMode] = useState(false);
  const [address, setAddress] = useState("");
  const [addressStatus, setAddressStatus] = useState(initialPin ? "loading" : "idle");
  const [boundary, setBoundary] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isOutsideBarangay = useMemo(
    () => (pin && boundary ? !isInside(pin.lat, pin.lng, boundary) : false),
    [pin?.lat, pin?.lng, boundary],
  );

  const setPinnedLocation = useCallback((position, isManual = true) => {
    const normalized = getCoordinates(position);
    if (!normalized) return;
    manualPinRef.current = isManual;
    pinRef.current = normalized;
    setPin(normalized);
    setLocationStatus("pinned");
    setLocationError("");
    setAddress("");
    setAddressStatus("loading");
  }, []);

  const requestDeviceLocation = useCallback(() => {
    const requestId = ++locationRequestRef.current;
    manualPinRef.current = false;
    setLocationStatus("loading");
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationStatus(pinRef.current ? "pinned" : "error");
      setLocationError("Device location is unavailable. Drop a pin on the map or add a location note.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== locationRequestRef.current || manualPinRef.current) return;
        setPinnedLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }, false);
      },
      (error) => {
        if (requestId !== locationRequestRef.current || manualPinRef.current) return;
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Drop a pin on the map or add a location note."
          : error.code === error.TIMEOUT
            ? "Location timed out. Retry, drop a pin on the map, or add a location note."
            : "Device location could not be found. Retry, drop a pin on the map, or add a location note.";
        setLocationStatus(pinRef.current ? "pinned" : "error");
        setLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [setPinnedLocation]);

  useEffect(() => {
    requestDeviceLocation();
    return () => { locationRequestRef.current += 1; };
  }, [requestDeviceLocation]);

  useEffect(() => {
    let active = true;
    loadBarangayBoundary().then((data) => { if (active) setBoundary(data); });
    return () => { active = false; };
  }, []);

  const pinLatitude = pin?.lat;
  const pinLongitude = pin?.lng;
  useEffect(() => {
    if (!Number.isFinite(pinLatitude) || !Number.isFinite(pinLongitude)) return undefined;
    const key = `${pinLatitude.toFixed(5)},${pinLongitude.toFixed(5)}`;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        if (ADDRESS_CACHE.has(key)) {
          const cachedAddress = ADDRESS_CACHE.get(key);
          setAddress(cachedAddress);
          setAddressStatus(cachedAddress ? "ready" : "unavailable");
          return;
        }
        const params = new URLSearchParams({ lat: String(pinLatitude), lng: String(pinLongitude) });
        const response = await fetch(`/api/reports/reverse-geocode?${params}`, {
          signal: controller.signal,
          cache: "default",
        });
        if (!response.ok) throw new Error("Street lookup is unavailable.");
        const result = await response.json();
        if (controller.signal.aborted) return;
        const resolvedAddress = typeof result.address === "string" ? result.address.trim() : "";
        ADDRESS_CACHE.set(key, resolvedAddress);
        setAddress(resolvedAddress);
        setAddressStatus(resolvedAddress ? "ready" : "unavailable");
      } catch (error) {
        if (error.name !== "AbortError") {
          ADDRESS_CACHE.set(key, "");
          setAddress("");
          setAddressStatus("unavailable");
        }
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pinLatitude, pinLongitude]);

  const handleTypeChange = (type) => {
    const selected = reportCatalog.classifications.find((item) => item.value === type);
    setReportType(type);
    setCategory(selected?.defaultCategory ?? reportCatalog.categories[0]);
  };

  const coordinateLabel = pin
    ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
    : "No coordinates pinned";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !reporterName.trim() || !description.trim()) {
      toast.add({ title: "Required details missing", description: "Add an incident title, your name, and a description.", type: "error" });
      return;
    }
    if (!pin && !locationNote.trim()) {
      toast.add({ title: "Location required", description: "Pin the incident on the map or enter a short location note.", type: "error" });
      return;
    }

    const classification = reportCatalog.classifications.find((item) => item.value === reportType);
    const withinBoundary = pin && boundary ? (isInside(pin.lat, pin.lng, boundary) ? 1 : 0) : null;
    const payload = {
      reporter_type: "GUEST",
      guest_alias: reporterName.trim(),
      title: title.trim(),
      classification: reportType,
      is_emergency: classification?.isEmergency ? 1 : 0,
      incident_category: category,
      priority_level: urgency.toUpperCase(),
      description: description.trim(),
      reverse_geocoded_address: address || locationNote.trim() || null,
      ...(pin ? {
        latitude: pin.lat,
        longitude: pin.lng,
        accuracy_meters: pin.accuracy,
        within_barangay_boundary: withinBoundary,
      } : {}),
    };

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to submit the report. Please try again.");

      const savedReport = data?.report ?? data;
      if (!savedReport?.incident_id || !savedReport?.reference_number) {
        throw new Error("The server did not return the saved report details. Please try again.");
      }
      if (savedReport.guest_access_token) {
        sessionStorage.setItem(`geofix:guest-report:${savedReport.incident_id}`, savedReport.guest_access_token);
        sessionStorage.setItem("geofix:last-guest-report", savedReport.incident_id);
      }
      const latitude = savedReport.latitude == null ? null : Number(savedReport.latitude);
      const longitude = savedReport.longitude == null ? null : Number(savedReport.longitude);
      onSubmitNewReport?.({
        id: savedReport.incident_id,
        reportNumber: savedReport.reference_number,
        type: reportType,
        category: savedReport.category || category,
        title: savedReport.title || title.trim(),
        location: savedReport.location_description || (pin ? coordinateLabel : locationNote.trim()),
        status: savedReport.status_code || "SUBMITTED",
        statusLabel: savedReport.status_label || "Submitted",
        urgency: savedReport.priority_level || urgency.toUpperCase(),
        reportedAt: savedReport.received_at || savedReport.submitted_at,
        ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : {}),
        description: savedReport.sanitized_description ?? description.trim(),
        hasProof: false,
      });

      onClose();
      toast.add({
        title: "Report submitted successfully",
        description: "Your report is saved and will be reviewed by a barangay admin.",
        type: "success",
      });
    } catch (error) {
      toast.add({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "Unable to submit your report right now.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const locationSummary = address
    || (pin ? `Location pinned (coordinates): ${coordinateLabel}` : locationNote.trim());

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Close report form" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X size={18} />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600"><AlertTriangle size={18} /></div>
          <div className="pr-8">
            <h3 className="text-lg font-extrabold text-slate-900">Submit Geotagged Report</h3>
            <p className="text-xs text-slate-500">Barangay 167, Caloocan City · Public Incident Intake</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="guest-report-classification" className="mb-1.5 block text-xs font-bold text-slate-700">Incident Classification</label>
            <select id="guest-report-classification" value={reportType} onChange={(event) => handleTypeChange(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold outline-none ${CLASSIFICATION_COLORS[reportType]?.select ?? "border-slate-200 bg-white text-slate-800 focus:border-[#2E8B57]"}`}>
              {reportCatalog.classifications.map((option) => (
                <option key={option.value} value={option.value} className={CLASSIFICATION_COLORS[option.value]?.option}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="guest-report-category" className="mb-1.5 block text-xs font-bold text-slate-700">Category</label>
            <select id="guest-report-category" value={category} onChange={(event) => setCategory(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold outline-none ${CATEGORY_COLORS[category] ?? "border-slate-200 bg-white text-slate-800 focus:border-[#2E8B57]"}`}>
              {reportCatalog.categories.map((item) => <option key={item} value={item} className={CATEGORY_COLORS[item]}>{item}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="guest-report-title" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700"><FileText size={13} /> Incident Title</label>
            <input id="guest-report-title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Briefly name the incident" required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />
          </div>

          <div>
            <label htmlFor="guest-reporter-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700"><UserRound size={13} /> Your Name</label>
            <input id="guest-reporter-name" type="text" value={reporterName} onChange={(event) => setReporterName(event.target.value)} maxLength={100} autoComplete="name" placeholder="Name shown to barangay staff" required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700">Location / Street in Barangay 167, Caloocan City</label>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${locationStatus === "error" ? "text-amber-700" : "text-emerald-700"}`} aria-live="polite">
                <LocateFixed size={12} />
                {locationStatus === "loading" ? "Getting your location..." : locationStatus === "pinned" ? "Location pinned" : "Location unavailable"}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <LocationPickerMap
                pin={pin}
                boundary={boundary}
                manualPinMode={manualPinMode}
                onPin={(position) => setPinnedLocation(position, true)}
              />
              <div className="space-y-1.5 border-t border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-slate-800">{addressStatus === "loading" ? "Looking up nearby street..." : locationSummary || coordinateLabel}</p>
                {pin?.accuracy != null && <p className="text-[10px] text-slate-500">GPS accuracy: ±{Math.round(pin.accuracy)} m</p>}
                {pin?.accuracy > 100 && <p className="text-[10px] font-medium text-amber-700">Accuracy is low. Drag the pin to adjust the location.</p>}
                {isOutsideBarangay && <p className="text-[10px] font-semibold text-amber-700">This pin appears outside Barangay 167. You can still submit.</p>}
                {!pin && locationStatus === "error" && <p className="text-[10px] text-amber-700">{locationError}</p>}
                {pin && locationError && <p className="text-[10px] text-amber-700">{locationError}</p>}
                {manualPinMode && <p className="text-[10px] text-slate-500">Tap the map or drag the pin to set the exact location.</p>}
                {addressStatus === "unavailable" && pin && <p className="text-[10px] text-slate-500">Location pinned (coordinates). Street lookup can’t be reached right now.</p>}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <button type="button" onClick={() => setManualPinMode(true)} className="text-[10px] font-bold text-[#247447] hover:underline">
                    {pin ? "Adjust pin" : "Drop pin on map"}
                  </button>
                  {locationError && <button type="button" onClick={requestDeviceLocation} className="text-[10px] font-bold text-[#247447] hover:underline">Retry location</button>}
                  {!pin && locationStatus === "error" && !showLocationNote && <button type="button" onClick={() => setShowLocationNote(true)} className="text-[10px] font-bold text-slate-600 hover:underline">Enter a location note instead</button>}
                </div>
                {!pin && showLocationNote && (
                  <input type="text" value={locationNote} onChange={(event) => setLocationNote(event.target.value)} maxLength={500} placeholder="Optional location note" aria-label="Optional location note" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />
                )}
                <p className="text-[9px] text-slate-400">Map © OpenStreetMap contributors · Street names © OpenStreetMap contributors</p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="guest-report-description" className="mb-1.5 block text-xs font-bold text-slate-700">Incident Description</label>
            <textarea id="guest-report-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} placeholder="Provide exact details of the situation, visible risks, or landmarks..." required className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />
          </div>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="guest-report-urgency" className="text-xs font-bold text-slate-700">Urgency Level:</label>
            <select id="guest-report-urgency" value={urgency} onChange={(event) => setUrgency(event.target.value)} className={`min-w-32 rounded-lg border px-3 py-2 text-xs font-semibold outline-none ${URGENCY_COLORS[urgency]?.select ?? "border-slate-200 bg-white text-slate-800 focus:border-[#2E8B57]"}`}>
              {reportCatalog.formUrgencies.map(({ label }) => <option key={label} value={label} className={URGENCY_COLORS[label]?.option}>{label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button type="submit" disabled={isSubmitting || (!pin && !locationNote.trim())} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E8B57] py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#247447] active:scale-[0.99] disabled:opacity-50">
              <Send size={15} />
              {isSubmitting ? "Submitting report..." : "Submit Incident Report"}
            </button>
            <Link to={PATHS.resident} onClick={onClose} className="text-center text-xs font-semibold text-slate-500 hover:text-[#2E8B57]">
              Registered resident? Sign in to attach camera photo &amp; video evidence
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
