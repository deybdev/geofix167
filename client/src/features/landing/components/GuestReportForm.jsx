import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AlertTriangle, Camera, Check, Copy, FileText, Image as ImageIcon, LocateFixed, Locate, RotateCcw, Send, Share2, Trash2, X } from "lucide-react";
import L from "leaflet";
import { Circle, GeoJSON, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import reportCatalog from "../../../../../server/src/shared/reportCatalog.json";
import { isInside } from "../../../shared/utils/mapUtils";
import { PATHS } from "../../../router/paths";
import { toast } from "../../../shared/components/ui/toast";

const DEFAULT_MAP_CENTER = [14.75, 121.02];
const ADDRESS_CACHE = new Map();
let boundaryPromise;

const GUEST_REPORT_TYPE = "sudden";
const MAX_SUDDEN_CATEGORIES = 4;

const CATEGORY_URGENCY_STYLES = {
  high: {
    rowSelected: "border-red-300 bg-red-50/75",
    rowIdle: "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/35",
    boxSelected: "border-(--gf-red) bg-(--gf-red)",
    boxIdle: "border-slate-500 bg-white group-hover:border-(--gf-red)",
    ring: "peer-focus-visible:ring-2 peer-focus-visible:ring-(--gf-red) peer-focus-visible:ring-offset-2",
    badge: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200",
    label: "High",
  },
  medium: {
    rowSelected: "border-amber-300 bg-amber-50/75",
    rowIdle: "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/35",
    boxSelected: "border-amber-700 bg-amber-700",
    boxIdle: "border-slate-500 bg-white group-hover:border-amber-700",
    ring: "peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700 peer-focus-visible:ring-offset-2",
    badge: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
    label: "Medium",
  },
};

function getCategoryUrgency(category, type = GUEST_REPORT_TYPE) {
  if (type === "sudden") return "high";
  return reportCatalog.guestUrgency.maintenanceHighCategories.includes(category) ? "high" : "medium";
}
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

function MapSizeManager() {
  const map = useMap();
  useEffect(() => {
    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    const timer = window.setTimeout(() => map.invalidateSize({ pan: false }), 180);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [map]);
  return null;
}

function MapCenterPinHandler({ pin, onPin }) {
  useMapEvents({
    moveend(event) {
      const center = event.target.getCenter();
      if (pin && Math.abs(center.lat - pin.lat) < 0.00001 && Math.abs(center.lng - pin.lng) < 0.00001) return;
      onPin({ lat: center.lat, lng: center.lng, accuracy: null });
    },
  });
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

function LocationPickerMap({ pin, boundary, recenterVersion, wheelZoomEnabled, onPin }) {
  const center = pin ? [pin.lat, pin.lng] : DEFAULT_MAP_CENTER;
  const zoom = pin ? 16 : 14;

  return (
    <div className="relative">
    <MapContainer center={center} zoom={zoom} zoomControl={false} scrollWheelZoom={wheelZoomEnabled} className="h-[260px] w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {boundary && <GeoJSON data={boundary} interactive={false} style={{ color: "#2e8b57", weight: 2, fillOpacity: 0.04 }} />}
      {pin?.accuracy > 0 && <Circle center={[pin.lat, pin.lng]} radius={pin.accuracy} pathOptions={{ color: "#2e8b57", weight: 1.5, fillColor: "#2e8b57", fillOpacity: 0.13 }} />}
      <FitBarangayBoundary boundary={boundary} pin={pin} />
      <MapSizeManager />
      <MapCenterPinHandler pin={pin} onPin={onPin} />
      <MapRecenter position={pin} version={recenterVersion} />
      <ZoomButtons />
    </MapContainer>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
      <span className="-translate-y-[18px] drop-shadow-md"><span className="block h-7 w-7 rounded-full border-[3px] border-white bg-[#2e8b57] shadow-[0_2px_6px_rgba(15,23,42,.45)]"><span className="mx-auto mt-[6px] block h-2 w-2 rounded-full bg-white" /></span><span className="mx-auto -mt-1 block h-2 w-2 rotate-45 border-b-2 border-r-2 border-white bg-[#2e8b57]" /></span>
    </div>
    </div>
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
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [formStep, setFormStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState({});
  const [focusField, setFocusField] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [showLocationNote, setShowLocationNote] = useState(false);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const photosRef = useRef([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraConsentOpen, setCameraConsentOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraStreamRef = useRef(null);
  const videoRef = useRef(null);
  const photoInputRef = useRef(null);
  const formContentRef = useRef(null);
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
  const [trackingUrl, setTrackingUrl] = useState("");
  const [savedTrackingUrl, setSavedTrackingUrl] = useState(() => {
    try { return window.localStorage.getItem("geofix:last-tracking-url") || ""; }
    catch { return ""; }
  });
  const [trackingLinkCopied, setTrackingLinkCopied] = useState(false);
  const classification = reportCatalog.classifications.find((item) => item.value === GUEST_REPORT_TYPE);
  const categories = reportCatalog.categories[GUEST_REPORT_TYPE] ?? [];
  const urgencyCode = reportCatalog.guestUrgency.sudden;
  const urgency = urgencyCode === "HIGH" ? "High" : urgencyCode === "LOW" ? "Low" : "Medium";
  const isOutsideBarangay = useMemo(
    () => Boolean(pin && boundary && !isInside(pin.lat, pin.lng, boundary)),
    [pin, boundary],
  );
  const needsAccuracyConfirmation = pin?.accuracy > 100 && !manuallyAdjusted;

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

  const clearValidationError = useCallback((field) => {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  useEffect(() => {
    const container = formContentRef.current;
    if (!container) return;
    const modal = container.closest(".landing-report-modal");
    if (modal) modal.scrollTo({ top: 0, behavior: "smooth" });
    else container.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [formStep]);

  useEffect(() => {
    if (!focusField) return;
    const form = formContentRef.current?.querySelector("form");
    const element = focusField === "category"
      ? form?.querySelector('input[name="incident-category"]')
      : document.getElementById(`${idPrefix}-${focusField}`);
    if (!element) return;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    element.focus?.({ preventScroll: true });
  }, [focusField, idPrefix, validationErrors]);

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
      setCameraError("Camera access is unavailable. Use HTTPS or localhost in a camera-enabled browser, or choose a photo below.");
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
        ? "No camera was found. Connect or enable a camera, or choose a photo below."
        : error?.name === "NotReadableError"
          ? "The camera is busy in another app. Close that app and retry, or choose a photo below."
          : error?.name === "NotAllowedError" || error?.name === "SecurityError"
            ? "Camera access was denied. Re-enable it in this site's browser permissions, or choose a photo below."
            : "Camera access failed. Check this site's browser permissions and retry, or choose a photo below.");
    } finally {
      setCameraBusy(false);
    }
  }, []);

  const requestCameraAccess = useCallback(async (replacementIndex = null) => {
    replacePhotoIndexRef.current = replacementIndex;
    setCameraError("");
    if (!window.isSecureContext) {
      setCameraError("Camera access requires HTTPS or localhost. You can still choose a photo below.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot access a camera. Choose a photo below or use a camera-enabled browser.");
      return;
    }

    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: "camera" });
        if (permission.state === "granted") {
          void startCamera(replacementIndex);
          return;
        }
        if (permission.state === "denied") {
          setCameraError("Camera permission is blocked. Re-enable it in this site's browser permissions, or choose a photo below.");
          return;
        }
      } catch {
        // Some browsers do not expose camera permission state; ask in-app first.
      }
    }
    setCameraConsentOpen(true);
  }, [startCamera]);

  const handlePhotoFiles = useCallback(async (event) => {
    const chosenFiles = [...(event.target.files ?? [])];
    event.target.value = "";
    const replacementIndex = replacePhotoIndexRef.current;
    replacePhotoIndexRef.current = null;
    try {
      const candidates = replacementIndex == null
        ? chosenFiles.slice(0, Math.max(0, 3 - photosRef.current.length))
        : chosenFiles.slice(0, 1);
      for (const file of candidates) await acceptEvidencePhoto(file, replacementIndex);
      if (chosenFiles.length > candidates.length) setCameraError("You can attach up to three photos.");
      else if (candidates.length) setCameraError("");
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "This photo could not be prepared.");
    }
  }, [acceptEvidencePhoto]);

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
    setValidationErrors((current) => {
      if (!current.location && !current.accuracy) return current;
      const next = { ...current };
      delete next.location;
      delete next.accuracy;
      return next;
    });
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
    const timer = initialPin ? null : window.setTimeout(requestDeviceLocation, 0);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      locationRequestRef.current += 1;
    };
  }, [initialPin, requestDeviceLocation]);

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

  const handleNext = () => {
    const errors = {};
    if (!selectedCategories.length || selectedCategories.length > 4 || selectedCategories.some(value => !categories.includes(value))) {
      errors.category = "Choose one to four sudden incidents.";
    }
    if (!pin && !locationNote.trim()) errors.location = "Pin the incident location or add a location note.";
    if (needsAccuracyConfirmation && !confirmPoorAccuracy) errors.accuracy = "Confirm the current pin or adjust it before continuing.";
    setValidationErrors(errors);
    const firstInvalid = ["category", "location", "accuracy"].find((field) => errors[field]);
    if (firstInvalid) {
      setFocusField(firstInvalid);
      return;
    }
    locationRequestRef.current += 1;
    setFocusField("");
    setFormStep(2);
    void requestCameraAccess();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!selectedCategories.length || selectedCategories.length > 4 || selectedCategories.some(value => !categories.includes(value))) {
      errors.category = "Choose one to four sudden incidents.";
    }
    if (!pin && !locationNote.trim()) errors.location = "Pin the incident location or add a location note.";
    if (needsAccuracyConfirmation && !confirmPoorAccuracy) errors.accuracy = "Confirm the current pin or adjust it before continuing.";
    if (photosRef.current.length === 0) errors.photos = "Capture or choose at least one photo to submit this report.";
    setValidationErrors(errors);
    const firstInvalid = ["category", "location", "accuracy", "photos"].find((field) => errors[field]);
    if (firstInvalid && firstInvalid !== "photos") {
      setFormStep(1);
      setFocusField(firstInvalid);
      return;
    }
    if (errors.photos) {
      setFocusField("photos");
      toast.add({ title: "Photo evidence required", description: errors.photos, type: "error" });
      return;
    }
    setFocusField("");

    const reportBoundary = boundary ?? await loadBarangayBoundary();
    if (!boundary && reportBoundary) setBoundary(reportBoundary);
    const withinBoundary = pin && reportBoundary ? (isInside(pin.lat, pin.lng, reportBoundary) ? 1 : 0) : null;
    const payload = {
      reporter_type: "GUEST",
      classification: GUEST_REPORT_TYPE,
      is_emergency: classification?.isEmergency ? 1 : 0,
      categories: selectedCategories,
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
      const reportTrackingUrl = typeof data?.tracking_url === "string" ? data.tracking_url : "";
      if (reportTrackingUrl) {
        setTrackingUrl(reportTrackingUrl);
        setSavedTrackingUrl(reportTrackingUrl);
        setFormStep(3);
        try { window.localStorage.setItem("geofix:last-tracking-url", reportTrackingUrl); }
        catch { /* The success screen still provides the link if storage is unavailable. */ }
      }
      const latitude = savedReport.latitude == null ? null : Number(savedReport.latitude);
      const longitude = savedReport.longitude == null ? null : Number(savedReport.longitude);
      onSubmitNewReport?.({
        id: savedReport.incident_id,
        reportNumber: savedReport.reference_number,
        type: GUEST_REPORT_TYPE,
        classification: GUEST_REPORT_TYPE,
        categories: savedReport.categories,
        category: savedReport.category || selectedCategories[0],
        title: savedReport.title || selectedCategories.join(" + "),
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
      onSuccess?.({ ...savedReport, tracking_url: reportTrackingUrl || undefined });
      toast.add({ title: "Report submitted successfully", description: "Your report is saved and will be reviewed by barangay staff.", type: "success" });
      if (!embedded && !reportTrackingUrl) onClose();
    } catch (error) {
      toast.add({ title: "Submission Failed", description: error instanceof Error ? error.message : "Unable to submit your report right now.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCameraConsentOpen(false);
    stopCamera();
    onClose();
  };

  const copyTrackingLink = async (url = trackingUrl || savedTrackingUrl) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setTrackingLinkCopied(true);
      window.setTimeout(() => setTrackingLinkCopied(false), 1800);
    } catch {
      toast.add({ title: "Copy unavailable", description: "Open the tracking page and copy its address from your browser.", type: "error" });
    }
  };

  const shareTrackingLink = async () => {
    if (!trackingUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: "GeoFix 167 incident tracking", url: trackingUrl }); }
      catch (error) { if (error?.name !== "AbortError") await copyTrackingLink(trackingUrl); }
    } else await copyTrackingLink(trackingUrl);
  };

  const locationSummary = address || (pin ? (isOutsideBarangay ? "Pinned outside Barangay 167" : "Pinned location, Barangay 167") : "Tap the map to place a pin");

  return (
    <>
    <div className={embedded ? "min-w-0" : "fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"}>
      <div ref={formContentRef} className={embedded ? "relative min-w-0" : "landing-report-modal relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6"}>
        {!embedded && <button type="button" onClick={handleClose} aria-label="Close report form" className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>}

        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-[#b42318]"><AlertTriangle size={18} /></div>
          <div className="pr-8">
            <h3 className="text-lg font-extrabold text-slate-900">Report Sudden Incident</h3>
            <p className="text-xs text-slate-500">Barangay 167, Caloocan City · Guest Sudden Incident Intake</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={`${embedded ? "mt-4 space-y-3" : "mt-5 space-y-4"}`}>
          {formStep < 3 && <div className="flex items-center gap-2" aria-label={`Step ${formStep} of 2`}>
            <span className={`h-1.5 flex-1 rounded-full ${formStep === 1 ? "bg-[#2E8B57]" : "bg-emerald-200"}`} />
            <span className={`h-1.5 flex-1 rounded-full ${formStep === 2 ? "bg-[#2E8B57]" : "bg-slate-200"}`} />
            <span className="ml-1 text-[10px] font-semibold text-slate-500">Step {formStep} of 2</span>
          </div>}
          {formStep === 3 ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4" role="status">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Check size={19} /></span>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Your report was sent for review</h4>
                <p className="mt-1 text-xs leading-5 text-slate-600">Keep this private link to follow the responder assigned to your incident.</p>
              </div>
            </div>
            <a href={trackingUrl} className="mt-4 block break-all rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-semibold text-emerald-900 underline decoration-emerald-300 underline-offset-2">{trackingUrl}</a>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <a href={trackingUrl} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#174b37] px-3 text-xs font-bold text-white">Open tracking</a>
              <button type="button" onClick={() => void copyTrackingLink()} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800">{trackingLinkCopied ? <Check size={14} /> : <Copy size={14} />}{trackingLinkCopied ? "Copied" : "Copy link"}</button>
              <button type="button" onClick={() => void shareTrackingLink()} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800"><Share2 size={14} />Share</button>
            </div>
            <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-[10px] leading-4 text-slate-600">Anyone with this link can see your responder&apos;s live location until the incident is resolved.</p>
            <button type="button" onClick={() => onClose?.()} className="mt-3 min-h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Done</button>
          </section> : formStep === 1 ? <>
          {savedTrackingUrl && <aside className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
            <span className="text-[10px] font-semibold text-emerald-900">A tracking link is saved on this device.</span>
            <a href={savedTrackingUrl} className="text-[10px] font-bold text-emerald-800 underline underline-offset-2">Reopen tracking</a>
          </aside>}
          <fieldset>
            <legend className="mb-1 text-xs font-bold text-slate-700">Sudden incidents</legend>
            <p className="mb-2 text-[10px] text-slate-500">Guests can report sudden incidents only. Sign in as a registered resident to report maintenance issues.</p>
            <div className="space-y-2">
              {categories.map((item) => {
                const checked = selectedCategories.includes(item);
                const disabled = !checked && selectedCategories.length >= MAX_SUDDEN_CATEGORIES;
                const urgencyKey = getCategoryUrgency(item, GUEST_REPORT_TYPE);
                const tone = CATEGORY_URGENCY_STYLES[urgencyKey];
                return (
                  <label
                    key={item}
                    className={`group relative flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-colors duration-150 motion-reduce:transition-none ${
                      checked
                        ? tone.rowSelected
                        : disabled
                          ? "cursor-not-allowed border-slate-200 bg-slate-50/70 opacity-55"
                          : `cursor-pointer ${tone.rowIdle}`
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="incident-category"
                      value={item}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => {
                        setSelectedCategories((current) =>
                          checked ? current.filter((value) => value !== item) : [...current, item],
                        );
                        clearValidationError("category");
                      }}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px] border-2 transition-colors duration-120 motion-reduce:transition-none ${
                        checked ? tone.boxSelected : disabled ? "border-slate-400 bg-slate-100" : tone.boxIdle
                      } ${tone.ring}`}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        className="h-3.5 w-3.5 text-white"
                      >
                        <path
                          d="M3.25 8.5 6.5 11.75 12.75 4.75"
                          stroke="currentColor"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="20"
                          strokeDashoffset={checked ? 0 : 20}
                          className="transition-[stroke-dashoffset,opacity] duration-120 ease-out motion-reduce:transition-none"
                          style={{ opacity: checked ? 1 : 0 }}
                        />
                      </svg>
                    </span>
                    <span className={`flex-1 font-medium ${checked ? "text-slate-900" : "text-slate-700"}`}>
                      {item}
                    </span>
                    {disabled && (
                      <span className="shrink-0 text-[10px] font-medium text-slate-500">
                        Maximum of {MAX_SUDDEN_CATEGORIES}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            {validationErrors.category && <p role="alert" className="mt-1 text-[10px] font-medium text-red-700">{validationErrors.category}</p>}
          </fieldset>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700">Location / Street in Barangay 167, Caloocan City</label>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${locationStatus === "error" ? "text-[#b42318]" : "text-[#2f7550]"}`} aria-live="polite">
                <LocateFixed size={12} />{locationStatus === "loading" ? "Getting your location..." : locationStatus === "pinned" ? "Location pinned" : "Location unavailable"}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <div
                id={`${idPrefix}-location`}
                className="relative z-0 isolate"
                tabIndex={0}
                aria-invalid={Boolean(validationErrors.location)}
            aria-label="Incident location map. Drag the location pin to correct its position. The map itself only pans and zooms."
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
                />
              </div>
              <div className="space-y-1.5 border-t border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-slate-800">{addressStatus === "loading" && pin ? "Looking up nearby street..." : locationSummary}</p>
                {pin?.accuracy != null && <p className="text-[10px] text-slate-500">GPS accuracy: ±{Math.round(pin.accuracy)} m</p>}
                {needsAccuracyConfirmation && <p className="text-[10px] font-medium text-[#9f241b]">Accuracy is low. Adjust the pin or confirm its current location below.</p>}
                {isOutsideBarangay && <p className="text-[10px] font-semibold text-[#9f241b]">This pin appears outside Barangay 167. You can still submit.</p>}
                {locationError && <p className="text-[10px] text-[#9f241b]">{locationError}</p>}
                {validationErrors.location && <p role="alert" className="text-[10px] font-semibold text-red-700">{validationErrors.location}</p>}
                {!pin && locationStatus === "error" && <p className="text-[10px] text-slate-500">Pan the map beneath the center pin to set a location.</p>}
                <p className="text-[10px] text-slate-500">The pin stays fixed in the center. Pan the map beneath it to adjust the location.</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5">
                  <button type="button" onClick={requestDeviceLocation} className="inline-flex min-h-8 items-center gap-1 text-[10px] font-bold text-[#247447] hover:underline"><Locate size={12} /> Use my current location</button>
                  {locationError && <button type="button" onClick={requestDeviceLocation} className="min-h-8 text-[10px] font-bold text-[#247447] hover:underline">Retry</button>}
                  {pin && (addressStatus === "unavailable" || locationError) && !showLocationNote && <button type="button" onClick={() => setShowLocationNote(true)} className="min-h-8 text-[10px] font-bold text-slate-600 hover:underline">Add a location note</button>}
                  {!pin && locationStatus === "error" && !showLocationNote && <button type="button" onClick={() => setShowLocationNote(true)} className="min-h-8 text-[10px] font-bold text-slate-600 hover:underline">Add a location note</button>}
                </div>
                {showLocationNote && <input id={`${idPrefix}-location-note`} type="text" value={locationNote} onChange={(event) => { setLocationNote(event.target.value); clearValidationError("location"); }} maxLength={500} placeholder="Optional street or landmark note" aria-label="Optional location note" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57]" />}
                {needsAccuracyConfirmation && <label className="flex min-h-8 items-center gap-2 text-[10px] font-semibold text-slate-700"><input id={`${idPrefix}-accuracy`} type="checkbox" checked={confirmPoorAccuracy} onChange={(event) => { setConfirmPoorAccuracy(event.target.checked); clearValidationError("accuracy"); }} /> I confirm this pin is correct.</label>}
                {validationErrors.accuracy && <p role="alert" className="text-[10px] font-semibold text-red-700">{validationErrors.accuracy}</p>}
                {addressStatus === "unavailable" && pin && <p className="text-[10px] text-slate-500">Street lookup is unavailable; your pinned location will still be submitted.</p>}
                <p className="text-[9px] text-slate-400">Map © OpenStreetMap contributors · Street names © OpenStreetMap contributors</p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={`${idPrefix}-description`} className="mb-1.5 block text-xs font-bold text-slate-700">Incident Description (optional)</label>
            <p className="mb-1 text-[10px] text-slate-500">In an emergency you can skip this. Barangay staff will review your photo.</p>
            <textarea id={`${idPrefix}-description`} rows={3} value={description} onChange={(event) => { setDescription(event.target.value); clearValidationError("description"); }} maxLength={10000} placeholder="Provide exact details of the situation, visible risks, or landmarks..." aria-invalid={Boolean(validationErrors.description)} aria-describedby={validationErrors.description ? `${idPrefix}-description-error` : undefined} className={`w-full resize-none rounded-lg border px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#2E8B57] focus:ring-2 focus:ring-emerald-100 ${validationErrors.description ? "border-red-400 bg-red-50/40" : "border-slate-200 bg-white"}`} />
            {validationErrors.description && <p id={`${idPrefix}-description-error`} role="alert" className="mt-1 text-[10px] font-medium text-red-700">{validationErrors.description}</p>}
          </div>
          <div className="flex flex-col gap-2 pt-1">
            {Object.keys(validationErrors).length > 0 && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-800">Please fix the highlighted fields before continuing.</p>}
            <button type="button" onClick={handleNext} disabled={cameraBusy || cameraOpen} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2E8B57] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#247447] active:scale-[0.99] disabled:opacity-50">Next: Camera evidence <Camera size={15} /></button>
            <Link to={PATHS.resident} onClick={handleClose} className="text-center text-xs font-semibold text-slate-500 hover:text-[#2E8B57]">Need to report a maintenance issue? Sign in as a registered resident</Link>
          </div>
          </> : <>
          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3" aria-label="Photo evidence">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><Camera size={14} /> Photo evidence</h4>
              <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-bold text-red-700">Required</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Add at least one photo as evidence for barangay staff. You can capture a new photo or choose one from your device.</p>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={handlePhotoFiles} aria-label="Choose photo evidence" />
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
                <button id={`${idPrefix}-photos`} type="button" disabled={cameraBusy || photos.length >= 3} onClick={() => requestCameraAccess()} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#b7ccbd] bg-white px-3 text-xs font-semibold text-[#216b43] hover:bg-[#eff6f0] disabled:opacity-50"><Camera size={14} />{cameraBusy ? "Opening camera..." : photos.length ? "Take another photo" : "Open camera"}</button>
                <button type="button" disabled={cameraBusy || photos.length >= 3} onClick={() => { replacePhotoIndexRef.current = null; photoInputRef.current?.click(); }} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><ImageIcon size={14} />Choose photo</button>
              </div>
            )}
            {cameraError && <p role="status" className="mt-2 text-[10px] font-medium text-[#9f241b]">{cameraError}</p>}
            {cameraError && <p className="mt-1 text-[10px] text-slate-500">If camera permission is blocked, allow it in this site&apos;s browser settings or use Choose photo.</p>}
            {photos.length > 0 && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {photos.map((photo, index) => <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <img src={photo.previewUrl} alt={`Photo evidence ${index + 1}`} className="h-24 w-full object-cover" />
                <div className="space-y-1 px-2 py-1.5">
                  <span className="block text-[10px] font-semibold text-slate-600">Photo {index + 1}</span>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" disabled={cameraBusy} onClick={() => requestCameraAccess(index)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-[#216b43] hover:bg-emerald-50 disabled:opacity-50"><RotateCcw size={10} />Retake</button>
                    <button type="button" disabled={cameraBusy} onClick={() => { replacePhotoIndexRef.current = index; photoInputRef.current?.click(); }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><FileText size={10} />Replace</button>
                    <button type="button" onClick={() => removePhoto(photo.id)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-50"><Trash2 size={10} />Remove</button>
                  </div>
                </div>
              </div>)}
            </div>}
            {photos.length === 0 && <p role={validationErrors.photos ? "alert" : undefined} className={`mt-2 text-[10px] font-semibold ${validationErrors.photos ? "text-red-700" : "text-slate-500"}`}>{validationErrors.photos || "Add at least one photo before submitting this report."}</p>}
          </section>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
            <button type="button" disabled={cameraBusy || isSubmitting} onClick={() => { setCameraConsentOpen(false); stopCamera(); setFormStep(1); }} className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Back</button>
            <button type="submit" disabled={isSubmitting || cameraOpen || cameraBusy || photos.length === 0} className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#2E8B57] py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#247447] active:scale-[0.99] disabled:opacity-50">
              <Send size={15} />{isSubmitting ? "Submitting report..." : "Submit Incident Report"}
            </button>
          </div>
          <Link to={PATHS.resident} onClick={handleClose} className="block text-center text-xs font-semibold text-slate-500 hover:text-[#2E8B57]">Need to report a maintenance issue? Sign in as a registered resident</Link>
          </>}
        </form>
      </div>
    </div>
    {cameraConsentOpen && createPortal(
      <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby={`${idPrefix}-camera-title`} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Camera size={18} /></span>
            <div>
              <h4 id={`${idPrefix}-camera-title`} className="text-sm font-bold text-slate-900">Camera permission</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">GeoFix 167 needs your camera to take photo evidence. Your browser will ask for permission next.</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => { setCameraConsentOpen(false); setCameraError("Camera access wasn't requested. Choose a photo from your device to continue."); }} className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Not now</button>
            <button type="button" onClick={() => { setCameraConsentOpen(false); void startCamera(replacePhotoIndexRef.current); }} className="min-h-9 rounded-lg bg-[#2E8B57] px-3 text-xs font-bold text-white hover:bg-[#247447]">Allow camera</button>
          </div>
        </section>
      </div>,
      document.body,
    )}
    </>
  );
}
