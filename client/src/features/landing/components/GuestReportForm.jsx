import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Camera, FileText, ImagePlus, LocateFixed, Locate, RotateCcw, Send, Trash2, UserRound, X } from "lucide-react";
import L from "leaflet";
import { Circle, GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import reportCatalog from "../../../../../server/src/shared/reportCatalog.json";
import { isInside } from "../../../shared/utils/mapUtils";
import { PATHS } from "../../../router/paths";
import { toast } from "../../../shared/components/ui/toast";

const DEFAULT_MAP_CENTER = [14.75, 121.02];
const ADDRESS_CACHE = new Map();
let boundaryPromise;

const CLASSIFICATION_COLORS = {
  sudden: { select: "border-red-300 bg-red-50 text-red-800 focus:border-red-500", option: "bg-red-50 text-red-800" },
  maintenance: { select: "border-[#9fb6a4] bg-[#e5efe6] text-[#174b37] focus:border-[#47745a]", option: "bg-[#e5efe6] text-[#174b37]" },
};
const CATEGORY_COLORS = {
  "Incident / Emergency": "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
  "Fire Incident": "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
  "Medical Emergency": "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
  "Road Accident": "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
  "Crime / Public Disturbance": "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
  "Road Damage": "border-[#cbd8ce] bg-[#f1f5f0] text-[#40584a] focus:border-[#78917d]",
  "Drainage / Flooding": "border-[#9fb6a4] bg-[#e5efe6] text-[#174b37] focus:border-[#47745a]",
  Sanitation: "border-[#cbd8ce] bg-[#edf3ec] text-[#315440] focus:border-[#78917d]",
  Structural: "border-[#cbd8ce] bg-[#edf3ec] text-[#315440] focus:border-[#78917d]",
  Electrical: "border-[#cbd8ce] bg-[#edf3ec] text-[#315440] focus:border-[#78917d]",
  Waterways: "border-[#9fb6a4] bg-[#e5efe6] text-[#174b37] focus:border-[#47745a]",
  Streetlight: "border-[#cbd8ce] bg-[#edf3ec] text-[#315440] focus:border-[#78917d]",
  "Road Damage / Pothole": "border-[#cbd8ce] bg-[#f1f5f0] text-[#40584a] focus:border-[#78917d]",
  "Garbage Collection": "border-[#cbd8ce] bg-[#edf3ec] text-[#315440] focus:border-[#78917d]",
  "Water / Power Hazard": "border-red-300 bg-red-50 text-red-800 focus:border-red-500",
};
const isHighCategory = (type, item) => type === "sudden"
  || reportCatalog.guestUrgency.maintenanceHighCategories.includes(item);

const REPORT_PIN_ICON = L.divIcon({
  className: "guest-report-pin-icon",
  html: '<span style="display:block;width:20px;height:20px;border:3px solid #fff;border-radius:50%;background:#2e8b57;box-shadow:0 1px 6px #334155"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

async function compressEvidenceImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file for photo evidence.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This photo could not be prepared. Please try another image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encode = (quality) => new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("This photo could not be compressed. Please try another image.")),
      "image/jpeg", quality,
    ));
    let blob = await encode(0.7);
    if (blob.size > 2 * 1024 * 1024) blob = await encode(0.55);
    if (blob.size > 2 * 1024 * 1024) throw new Error("This image is too detailed to compress under 2 MiB. Choose a smaller photo.");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "incident-evidence";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
}

function getCoordinates(value) {
  if (!value || value.lat == null || value.lng == null) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const accuracy = value.accuracy == null ? null : Number(value.accuracy);
  return { lat, lng, accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null };
}

function loadBarangayBoundary() {
  if (!boundaryPromise) {
    boundaryPromise = fetch("/barangay-167.geojson", { cache: "force-cache" })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return boundaryPromise;
}

function MapClickHandler({ onPin, onMapFocused }) {
  useMapEvents({
    click(event) {
      onMapFocused();
      onPin({ lat: event.latlng.lat, lng: event.latlng.lng, accuracy: null });
    },
  });
  return null;
}

function MapSizeManager() {
  const map = useMap();
  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const timer = window.setTimeout(() => map.invalidateSize({ pan: false }), 180);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [map]);
  return null;
}

function MapRecenter({ position, version }) {
  const map = useMap();
  const previousVersion = useRef(version);
  useEffect(() => {
    if (version === previousVersion.current || !position) return;
    previousVersion.current = version;
    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 16), { animate: false });
  }, [map, position, version]);
  return null;
}

function FitBarangayBoundary({ boundary, pin }) {
  const map = useMap();
  useEffect(() => {
    if (!boundary || pin) return;
    const bounds = L.geoJSON(boundary).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [8, 8], maxZoom: 15, animate: false });
  }, [boundary, map, pin]);
  return null;
}

function ZoomButtons() {
  const map = useMap();
  return (
    <div className="leaflet-top leaflet-left" style={{ pointerEvents: "none" }}>
      <div className="leaflet-control leaflet-bar grid overflow-hidden rounded-md border border-slate-300 bg-white shadow" style={{ pointerEvents: "auto" }}>
        <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()} className="flex h-10 w-10 items-center justify-center border-b border-slate-200 text-xl font-semibold text-slate-700 hover:bg-slate-50">+</button>
        <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()} className="flex h-10 w-10 items-center justify-center text-xl font-semibold text-slate-700 hover:bg-slate-50">−</button>
      </div>
    </div>
  );
}

function LocationPickerMap({ pin, boundary, recenterVersion, wheelZoomEnabled, onPin, onMapFocused }) {
  const center = pin ? [pin.lat, pin.lng] : DEFAULT_MAP_CENTER;
  const zoom = pin ? 16 : 14;

  return (
    <MapContainer center={center} zoom={zoom} zoomControl={false} scrollWheelZoom={wheelZoomEnabled} className="h-[260px] w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {boundary && <GeoJSON data={boundary} interactive={false} style={{ color: "#2e8b57", weight: 2, fillOpacity: 0.04 }} />}
      {pin?.accuracy > 0 && <Circle center={[pin.lat, pin.lng]} radius={pin.accuracy} pathOptions={{ color: "#2e8b57", weight: 1.5, fillColor: "#2e8b57", fillOpacity: 0.13 }} />}
      <FitBarangayBoundary boundary={boundary} pin={pin} />
      <MapClickHandler onPin={onPin} onMapFocused={onMapFocused} />
      <MapSizeManager />
      <MapRecenter position={pin} version={recenterVersion} />
      <ZoomButtons />
      {pin && (
        <Marker
          position={[pin.lat, pin.lng]}
          icon={REPORT_PIN_ICON}
          draggable
          eventHandlers={{
            dragstart: onMapFocused,
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

export default function GuestReportForm({
  embedded = false,
  onClose = () => {},
  onSuccess,
  onSubmitNewReport,
  defaultCoordinates = null,
}) {
  const [initialPin] = useState(() => getCoordinates(defaultCoordinates));
  const idPrefix = useId();
  const [reportType, setReportType] = useState("sudden");
  const initialClassification = reportCatalog.classifications.find((item) => item.value === "sudden");
  const [category, setCategory] = useState(initialClassification.defaultCategory);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const categoryControlRef = useRef(null);
  const [title, setTitle] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [showLocationNote, setShowLocationNote] = useState(false);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraStreamRef = useRef(null);
  const videoRef = useRef(null);
  const photoInputRef = useRef(null);
  const replacePhotoIndexRef = useRef(null);
  const [pin, setPin] = useState(initialPin);
  const pinRef = useRef(initialPin);
  const manualPinRef = useRef(Boolean(initialPin));
  const locationRequestRef = useRef(0);
  const [manuallyAdjusted, setManuallyAdjusted] = useState(Boolean(initialPin));
  const [confirmPoorAccuracy, setConfirmPoorAccuracy] = useState(false);
  const [recenterVersion, setRecenterVersion] = useState(0);
  const [wheelZoomEnabled, setWheelZoomEnabled] = useState(false);
  const [locationStatus, setLocationStatus] = useState(initialPin ? "pinned" : "loading");
  const [locationError, setLocationError] = useState("");
  const [address, setAddress] = useState("");
  const [addressStatus, setAddressStatus] = useState(initialPin ? "loading" : "idle");
  const [boundary, setBoundary] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const classification = reportCatalog.classifications.find((item) => item.value === reportType);
  const categories = reportCatalog.categories[reportType] ?? [];
  const categoryIsHigh = isHighCategory(reportType, category);
  const urgencyCode = reportType === "sudden"
    ? reportCatalog.guestUrgency.sudden
    : reportCatalog.guestUrgency.maintenanceHighCategories.includes(category)
      ? reportCatalog.guestUrgency.sudden
      : reportCatalog.guestUrgency.maintenanceDefault;
  const urgency = urgencyCode === "HIGH" ? "High" : urgencyCode === "LOW" ? "Low" : "Medium";
  const highUrgency = urgency === "High";
  const isOutsideBarangay = useMemo(
    () => Boolean(pin && boundary && !isInside(pin.lat, pin.lng, boundary)),
    [pin?.lat, pin?.lng, boundary],
  );
  const needsAccuracyConfirmation = pin?.accuracy > 100 && !manuallyAdjusted;

  useEffect(() => {
    if (!categoryOpen) return undefined;
    const closeOutside = (event) => {
      if (!categoryControlRef.current?.contains(event.target)) setCategoryOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [categoryOpen]);

  const handleCategoryKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) event.preventDefault();
    if (event.key === "Escape") { setCategoryOpen(false); return; }
    if (event.key === "ArrowDown") {
      if (!categoryOpen) setCategoryOpen(true);
      setActiveCategoryIndex((index) => Math.min(categories.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      if (!categoryOpen) setCategoryOpen(true);
      setActiveCategoryIndex((index) => Math.max(0, index - 1));
    } else if ((event.key === "Enter" || event.key === " ") && categoryOpen) {
      setCategory(categories[activeCategoryIndex]); setCategoryOpen(false);
    }
  };

  const commitPhotos = useCallback((nextPhotos) => {
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
  }, []);

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    if (cameraOpen && cameraStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
  }, []);

  const acceptEvidencePhoto = useCallback(async (file, replacementIndex = null) => {
    const compressed = await compressEvidenceImage(file);
    const current = photosRef.current;
    if (replacementIndex == null && current.length >= 3) throw new Error("You can attach up to three photos.");
    const next = [...current];
    const entry = { id: crypto.randomUUID(), file: compressed, previewUrl: URL.createObjectURL(compressed) };
    if (replacementIndex != null && current[replacementIndex]) {
      URL.revokeObjectURL(current[replacementIndex].previewUrl);
      next[replacementIndex] = entry;
    } else {
      next.push(entry);
    }
    commitPhotos(next);
  }, [commitPhotos]);

  const startCamera = useCallback(async (replacementIndex = null) => {
    replacePhotoIndexRef.current = replacementIndex;
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable. Choose an image from your device instead.");
      return;
    }
    setCameraBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraError(error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError"
        ? "No camera was found. Choose an image from your device instead."
        : "Camera access was denied or unavailable. Choose an image from your device instead.");
    } finally {
      setCameraBusy(false);
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError("The camera is still starting. Please try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCameraBusy(true);
    try {
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("The photo could not be captured. Please try again.")),
        "image/jpeg", 0.7,
      ));
      await acceptEvidencePhoto(new File([blob], `incident-evidence-${Date.now()}.jpg`, { type: "image/jpeg" }), replacePhotoIndexRef.current);
      replacePhotoIndexRef.current = null;
      stopCamera();
      setCameraError("");
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "The photo could not be saved.");
      stopCamera();
    } finally {
      setCameraBusy(false);
    }
  }, [acceptEvidencePhoto, stopCamera]);

  const handlePhotoFiles = useCallback(async (event) => {
    const chosenFiles = [...(event.target.files ?? [])];
    event.target.value = "";
    const replacementIndex = replacePhotoIndexRef.current;
    replacePhotoIndexRef.current = null;
    try {
      const candidates = replacementIndex == null ? chosenFiles.slice(0, Math.max(0, 3 - photosRef.current.length)) : chosenFiles.slice(0, 1);
      for (let index = 0; index < candidates.length; index += 1) {
        await acceptEvidencePhoto(candidates[index], replacementIndex == null ? null : replacementIndex);
      }
      if (chosenFiles.length > candidates.length) setCameraError("Only three photos can be attached to one report.");
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "This photo could not be prepared.");
    }
  }, [acceptEvidencePhoto]);

  const removePhoto = (id) => {
    const current = photosRef.current;
    const removed = current.find((photo) => photo.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    commitPhotos(current.filter((photo) => photo.id !== id));
  };

  const setPinnedLocation = useCallback((position, isManual = true, recenter = false) => {
    const normalized = getCoordinates(position);
    if (!normalized) return;
    manualPinRef.current = isManual;
    pinRef.current = normalized;
    setPin(normalized);
    setManuallyAdjusted(isManual);
    setConfirmPoorAccuracy(false);
    setLocationStatus("pinned");
    setLocationError("");
    setAddress("");
    setAddressStatus("loading");
    if (recenter) setRecenterVersion((version) => version + 1);
  }, []);

  const requestDeviceLocation = useCallback(() => {
    const requestId = ++locationRequestRef.current;
    manualPinRef.current = false;
    setLocationStatus("loading");
    setLocationError("");
    setConfirmPoorAccuracy(false);

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
        }, false, true);
      },
      (error) => {
        if (requestId !== locationRequestRef.current || manualPinRef.current) return;
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Tap the map to drop a pin or add a location note."
          : error.code === error.TIMEOUT
            ? "Location timed out. Retry, tap the map to drop a pin, or add a location note."
            : "Device location could not be found. Retry, tap the map to drop a pin, or add a location note.";
        setLocationStatus(pinRef.current ? "pinned" : "error");
        setLocationError(message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [setPinnedLocation]);

  useEffect(() => {
    if (!initialPin) requestDeviceLocation();
    return () => { locationRequestRef.current += 1; };
  }, [initialPin, requestDeviceLocation]);

  useEffect(() => {
    let active = true;
    loadBarangayBoundary().then((data) => { if (active) setBoundary(data); });
    return () => { active = false; };
  }, []);

  const pinLatitude = pin?.lat;
  const pinLongitude = pin?.lng;
  useEffect(() => {
    if (!Number.isFinite(pinLatitude) || !Number.isFinite(pinLongitude)) {
      setAddressStatus("idle");
      return undefined;
    }
    const key = `${pinLatitude.toFixed(5)},${pinLongitude.toFixed(5)}`;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        if (ADDRESS_CACHE.has(key)) {
          const cachedAddress = ADDRESS_CACHE.get(key);
          setAddress(cachedAddress);
          setAddressStatus(cachedAddress ? "ready" : "unavailable");
          return;
        }
        const params = new URLSearchParams({ lat: String(pinLatitude), lng: String(pinLongitude) });
        const response = await fetch(`/api/reports/reverse-geocode?${params}`, { signal: controller.signal, cache: "default" });
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
    return () => { clearTimeout(timer); controller.abort(); };
  }, [pinLatitude, pinLongitude]);

  const handleTypeChange = (type) => {
    const selected = reportCatalog.classifications.find((item) => item.value === type);
    setReportType(type);
    setCategory(selected?.defaultCategory ?? (reportCatalog.categories[type] ?? [])[0] ?? "");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !reporterName.trim() || (!highUrgency && !description.trim())) {
      toast.add({ title: "Required details missing", description: highUrgency ? "Add an incident title and your name." : "Add an incident title, your name, and a description.", type: "error" });
      return;
    }
    if (highUrgency && photosRef.current.length === 0) {
      toast.add({ title: "Photo evidence required", description: "Attach at least one photo for a High urgency report.", type: "error" });
      return;
    }
    if (!pin && !locationNote.trim()) {
      toast.add({ title: "Location required", description: "Tap the map to place a pin or provide a short location note.", type: "error" });
      return;
    }
    if (needsAccuracyConfirmation && !confirmPoorAccuracy) {
      toast.add({ title: "Confirm the pin location", description: "Move the pin to improve accuracy or confirm that its current location is correct.", type: "error" });
      return;
    }

    const reportBoundary = boundary ?? await loadBarangayBoundary();
    if (!boundary && reportBoundary) setBoundary(reportBoundary);
    const withinBoundary = pin && reportBoundary ? (isInside(pin.lat, pin.lng, reportBoundary) ? 1 : 0) : null;
    const payload = {
      reporter_type: "GUEST",
      guest_alias: reporterName.trim(),
      title: title.trim(),
      classification: reportType,
      is_emergency: classification?.isEmergency ? 1 : 0,
      incident_category: category,
      description: description.trim(),
      reverse_geocoded_address: address || locationNote.trim() || null,
      pin_manually_adjusted: manuallyAdjusted ? 1 : 0,
      ...(pin ? {
        latitude: pin.lat,
        longitude: pin.lng,
        accuracy_meters: pin.accuracy,
        within_barangay_boundary: withinBoundary,
      } : {}),
    };

    setIsSubmitting(true);
    try {
      const requestBody = new FormData();
      requestBody.append("report", JSON.stringify(payload));
      photosRef.current.forEach((photo) => requestBody.append("photos", photo.file, photo.file.name));
      const response = await fetch("/api/reports", {
        method: "POST",
        credentials: "include",
        body: requestBody,
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
        classification: reportType,
        category: savedReport.category || category,
        title: savedReport.title || title.trim(),
        location: savedReport.location_description || (isOutsideBarangay ? "Pinned outside Barangay 167" : "Pinned on map"),
        withinBarangayBoundary: savedReport.within_barangay_boundary,
        status: savedReport.status_code || "SUBMITTED",
        statusLabel: savedReport.status_label || "Submitted",
        urgency: savedReport.priority_level || urgency.toUpperCase(),
        reportedAt: savedReport.received_at || savedReport.submitted_at,
        ...(Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : {}),
        description: savedReport.sanitized_description ?? description.trim(),
        hasProof: photosRef.current.length > 0,
      });
      onSuccess?.(savedReport);
      toast.add({ title: "Report submitted successfully", description: "Your report is saved and will be reviewed by barangay staff.", type: "success" });
      if (!embedded) onClose();
    } catch (error) {
      toast.add({ title: "Submission Failed", description: error instanceof Error ? error.message : "Unable to submit your report right now.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const locationSummary = address || (pin ? (isOutsideBarangay ? "Pinned outside Barangay 167" : "Pinned location, Barangay 167") : "Tap the map to place a pin");
  const mapHasFocus = () => setWheelZoomEnabled(true);

  return (
    <div className={embedded ? "min-w-0" : "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"}>
      <div className={embedded ? "relative min-w-0" : "landing-report-modal relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6"}>
        {!embedded && <button type="button" onClick={onClose} aria-label="Close report form" className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>}

        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-[#b42318]"><AlertTriangle size={18} /></div>
          <div className="pr-8">
            <h3 className="text-lg font-extrabold text-slate-900">Submit Geotagged Report</h3>
            <p className="text-xs text-slate-500">Barangay 167, Caloocan City · Public Incident Intake</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={`${embedded ? "mt-4 space-y-3" : "mt-5 space-y-4"}`}>
          <div>
            <label htmlFor={`${idPrefix}-classification`} className="mb-1.5 block text-xs font-bold text-slate-700">Incident Classification</label>
            <select id={`${idPrefix}-classification`} value={reportType} onChange={(event) => handleTypeChange(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-xs font-semibold outline-none ${CLASSIFICATION_COLORS[reportType]?.select ?? "border-slate-200 bg-white text-slate-800 focus:border-[#2E8B57]"}`}>
              {reportCatalog.classifications.map((option) => <option key={option.value} value={option.value} className={CLASSIFICATION_COLORS[option.value]?.option}>{option.label}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-category`} className="mb-1.5 block text-xs font-bold text-slate-700">Category</label>
            <div ref={categoryControlRef} className="relative">
              <button id={`${idPrefix}-category`} type="button" role="combobox" aria-label="Category" aria-haspopup="listbox" aria-expanded={categoryOpen} aria-controls={`${idPrefix}-category-options`} onKeyDown={handleCategoryKeyDown} onClick={() => { setCategoryOpen((open) => !open); setActiveCategoryIndex(Math.max(0, categories.indexOf(category))); }} className={`flex min-h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${categoryIsHigh ? "border-red-300 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-800"}`}>
                <span className="flex min-w-0 items-center gap-2 truncate">{categoryIsHigh && <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden="true" />}{category}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${categoryIsHigh ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-800"}`}>{categoryIsHigh ? "High" : "Medium"}</span></span><span aria-hidden="true">⌄</span>
              </button>
              {categoryOpen && <div id={`${idPrefix}-category-options`} role="listbox" aria-label="Incident category" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                {categories.map((item, index) => {
                  const high = isHighCategory(reportType, item);
                  return <button key={item} type="button" role="option" aria-selected={category === item} onMouseEnter={() => setActiveCategoryIndex(index)} onClick={() => { setCategory(item); setCategoryOpen(false); }} className={`flex min-h-9 w-full items-center justify-between rounded-md px-2 text-left text-xs hover:bg-slate-50 ${index === activeCategoryIndex ? "bg-slate-50" : ""} ${high ? "text-red-700" : "text-slate-700"}`}>
                    <span className="flex items-center gap-2">{high && <span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />}{item}</span>{high && <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700">High</span>}
                  </button>;
                })}
              </div>}
            </div>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-title`} className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700"><FileText size={13} /> Incident Title</label>
            <input id={`${idPrefix}-title`} type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Briefly name the incident" required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />
          </div>

          <div>
            <label htmlFor={`${idPrefix}-reporter`} className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700"><UserRound size={13} /> Your Name</label>
            <input id={`${idPrefix}-reporter`} type="text" value={reporterName} onChange={(event) => setReporterName(event.target.value)} maxLength={100} autoComplete="name" placeholder="Name shown to barangay staff" required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700">Location / Street in Barangay 167, Caloocan City</label>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${locationStatus === "error" ? "text-[#b42318]" : "text-[#2f7550]"}`} aria-live="polite">
                <LocateFixed size={12} />{locationStatus === "loading" ? "Getting your location..." : locationStatus === "pinned" ? "Location pinned" : "Location unavailable"}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div
                className="relative z-0 isolate"
                tabIndex={0}
                aria-label="Incident location map. Drag the pin or tap the map to set the exact location."
                onClick={() => setWheelZoomEnabled(true)}
                onFocus={() => setWheelZoomEnabled(true)}
                onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setWheelZoomEnabled(false); }}
              >
                <LocationPickerMap
                  pin={pin}
                  boundary={boundary}
                  recenterVersion={recenterVersion}
                  wheelZoomEnabled={wheelZoomEnabled}
                  onPin={(position) => setPinnedLocation(position, true)}
                  onMapFocused={mapHasFocus}
                />
              </div>
              <div className="space-y-1.5 border-t border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-slate-800">{addressStatus === "loading" && pin ? "Looking up nearby street..." : locationSummary}</p>
                {pin?.accuracy != null && <p className="text-[10px] text-slate-500">GPS accuracy: ±{Math.round(pin.accuracy)} m</p>}
                {needsAccuracyConfirmation && <p className="text-[10px] font-medium text-[#9f241b]">Accuracy is low. Adjust the pin or confirm its current location below.</p>}
                {isOutsideBarangay && <p className="text-[10px] font-semibold text-[#9f241b]">This pin appears outside Barangay 167. You can still submit.</p>}
                {locationError && <p className="text-[10px] text-[#9f241b]">{locationError}</p>}
                {!pin && locationStatus === "error" && <p className="text-[10px] text-slate-500">The map is centered on Barangay 167. Drop a pin to continue.</p>}
                <p className="text-[10px] text-slate-500">Drag the pin or tap the map to set the exact location.</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
                  <button type="button" onClick={requestDeviceLocation} className="inline-flex min-h-8 items-center gap-1 text-[10px] font-bold text-[#247447] hover:underline"><Locate size={12} /> Use my current location</button>
                  {locationError && <button type="button" onClick={requestDeviceLocation} className="min-h-8 text-[10px] font-bold text-[#247447] hover:underline">Retry</button>}
                  {pin && (addressStatus === "unavailable" || locationError) && !showLocationNote && <button type="button" onClick={() => setShowLocationNote(true)} className="min-h-8 text-[10px] font-bold text-slate-600 hover:underline">Add a location note</button>}
                  {!pin && locationStatus === "error" && !showLocationNote && <button type="button" onClick={() => setShowLocationNote(true)} className="min-h-8 text-[10px] font-bold text-slate-600 hover:underline">Add a location note</button>}
                </div>
                {showLocationNote && <input type="text" value={locationNote} onChange={(event) => setLocationNote(event.target.value)} maxLength={500} placeholder="Optional street or landmark note" aria-label="Optional location note" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />}
                {needsAccuracyConfirmation && <label className="flex min-h-8 items-center gap-2 text-[10px] font-semibold text-slate-700"><input type="checkbox" checked={confirmPoorAccuracy} onChange={(event) => setConfirmPoorAccuracy(event.target.checked)} /> I confirm this pin is correct.</label>}
                {addressStatus === "unavailable" && pin && <p className="text-[10px] text-slate-500">Street lookup is unavailable; your pinned location will still be submitted.</p>}
                <p className="text-[9px] text-slate-400">Map © OpenStreetMap contributors · Street names © OpenStreetMap contributors</p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-description`} className={`mb-1.5 block text-xs font-bold ${highUrgency ? "text-red-700" : "text-slate-700"}`}>Incident Description{highUrgency ? " (optional)" : ""}</label>
            {highUrgency && <p className="mb-1 text-[10px] text-red-700">High urgency: photo evidence is required. A description can help responders, but is optional.</p>}
            {!highUrgency && <p className="mb-1 text-[10px] text-slate-500">Medium urgency: please describe the issue.</p>}
            <textarea id={`${idPrefix}-description`} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} placeholder="Provide exact details of the situation, visible risks, or landmarks..." required={!highUrgency} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none focus:ring-2 ${highUrgency ? "border-red-200 bg-red-50/50 text-slate-800 focus:border-red-400 focus:ring-red-100" : "border-slate-200 bg-white text-slate-800 focus:border-[#2E8B57] focus:ring-emerald-100"}`} />
          </div>

          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3" aria-label="Photo evidence">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><Camera size={14} /> Photo evidence</h4>
              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${highUrgency ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                {highUrgency ? "Required for High urgency" : "Optional for Medium urgency"}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Take a photo as evidence. Your browser will ask for camera access. Up to 3 photos, each under 2 MiB.</p>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoFiles} className="sr-only" aria-label="Choose photo evidence" />
            {cameraOpen ? (
              <div className="mt-3 space-y-2">
                <video ref={videoRef} autoPlay playsInline muted className="max-h-64 w-full rounded-lg bg-slate-900 object-contain" aria-label="Camera preview" />
                <div className="flex gap-2">
                  <button type="button" disabled={cameraBusy} onClick={capturePhoto} className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2E8B57] px-3 text-xs font-bold text-white hover:bg-[#247447] disabled:opacity-60"><Camera size={14} />{cameraBusy ? "Preparing..." : "Capture photo"}</button>
                  <button type="button" onClick={() => { stopCamera(); replacePhotoIndexRef.current = null; }} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={cameraBusy || photos.length >= 3} onClick={() => startCamera()} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#b7ccbd] bg-white px-3 text-xs font-semibold text-[#216b43] hover:bg-[#eff6f0] disabled:opacity-50"><Camera size={14} />{cameraBusy ? "Opening camera..." : "Take photo"}</button>
                <button type="button" disabled={cameraBusy || (photos.length >= 3 && replacePhotoIndexRef.current == null)} onClick={() => photoInputRef.current?.click()} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><ImagePlus size={14} />Choose photo</button>
              </div>
            )}
            {cameraError && <p role="status" className="mt-2 text-[10px] font-medium text-[#9f241b]">{cameraError}</p>}
            {photos.length > 0 && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {photos.map((photo, index) => <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img src={photo.previewUrl} alt={`Photo evidence ${index + 1}`} className="h-24 w-full object-cover" />
                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <span className="text-[9px] font-semibold text-slate-600">Photo {index + 1}</span>
                  <div className="flex gap-1">
                    <button type="button" disabled={cameraBusy} onClick={() => startCamera(index)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-semibold text-[#216b43] hover:bg-emerald-50 disabled:opacity-50"><RotateCcw size={10} />Retake</button>
                    <button type="button" onClick={() => removePhoto(photo.id)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-semibold text-red-700 hover:bg-red-50"><Trash2 size={10} />Remove</button>
                  </div>
                </div>
              </div>)}
            </div>}
            {highUrgency && photos.length === 0 && <p className="mt-2 text-[10px] font-semibold text-red-700">Add at least one photo before submitting this High urgency report.</p>}
          </section>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-xs font-bold text-slate-700">Urgency determined from report details</span>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${urgency === "High" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{urgency}</span>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button type="submit" disabled={isSubmitting || cameraOpen || cameraBusy || (highUrgency && photos.length === 0) || (!pin && !locationNote.trim()) || (needsAccuracyConfirmation && !confirmPoorAccuracy)} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2E8B57] py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#247447] active:scale-[0.99] disabled:opacity-50">
              <Send size={15} />{isSubmitting ? "Submitting report..." : "Submit Incident Report"}
            </button>
            <Link to={PATHS.resident} onClick={onClose} className="text-center text-xs font-semibold text-slate-500 hover:text-[#2E8B57]">Registered resident? Sign in to attach camera photo &amp; video evidence</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
