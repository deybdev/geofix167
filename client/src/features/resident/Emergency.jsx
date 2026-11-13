import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Camera,
  CarFront,
  ChevronRight,
  Flame,
  HeartPulse,
  LocateFixed,
  MoreHorizontal,
  Siren,
  Upload,
  Waves,
  X,
} from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import MapViewer from "../../shared/components/MapViewer";
import { isInside } from "../../shared/utils/mapUtils";
import RequestTracking from "./RequestTracking";
import { PATHS } from "../../router/paths";
import { useGeoLocation } from "../../shared/context/LocationProvider";

const EMERGENCY_CATEGORIES = [
  { value: "fire",     label: "Fire",          hint: "Smoke or flames",    icon: Flame },
  { value: "medical",  label: "Medical",        hint: "Someone needs help", icon: HeartPulse },
  { value: "accident", label: "Road accident",  hint: "Vehicle collision",  icon: CarFront },
  { value: "flood",    label: "Flood or storm", hint: "Natural hazard",     icon: Waves },
  { value: "other",    label: "Other",          hint: "Something else",     icon: MoreHorizontal },
];

function EvidenceButton({ icon: Icon, label, onClick }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="outline"
      size="sm"
      className="flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-primary transition hover:border-primary/40 hover:bg-primary/5"
    >
      <Icon size={16} strokeWidth={2} />
      {label}
    </Button>
  );
}

export default function Emergency() {
  const navigate = useNavigate();
  const routeLocation = useLocation();

  const returningFromCamera = routeLocation.state?.emergencyFlow === true;
  const preselectedCategory = routeLocation.state?.emergencyType ?? null;

  const [step, setStep] = useState(returningFromCamera ? 2 : 0);
  const [category, setCategory] = useState(preselectedCategory);
  const [submitted, setSubmitted] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photos, setPhotos] = useState(
    routeLocation.state?.capturedPhoto ? [routeLocation.state.capturedPhoto] : [],
  );

  const photoInputRef = useRef(null);

  const geoCtx = useGeoLocation();
  const { geo } = geoCtx;

  const photoState = routeLocation.state;
  const [position, setPosition] = useState(
    Number.isFinite(photoState?.latitude)
      ? { lat: photoState.latitude, lng: photoState.longitude }
      : null,
  );
  const [address, setAddress] = useState(photoState?.address ?? "");
  const [addressEdited, setAddressEdited] = useState(false);

  const [boundary, setBoundary] = useState(null);
  useEffect(() => {
    fetch("/barangay-167.geojson")
      .then((r) => r.json())
      .then(setBoundary)
      .catch(() => setBoundary(null));
  }, []);

  useEffect(() => {
    if (!position && geoCtx.position) setPosition(geoCtx.position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoCtx.position]);

  useEffect(() => {
    if (geo.address && !addressEdited) setAddress(geo.address);
  }, [geo.address, addressEdited]);

  const insideOk = !boundary || (position && isInside(position.lat, position.lng, boundary));
  const locationReady = boundary
    ? Boolean(position) && insideOk === true
    : Boolean(position) || address.trim() !== "";

  const chosen = EMERGENCY_CATEGORIES.find((c) => c.value === category);
  const outside = Boolean(position && boundary && !insideOk);

  const TITLES = [
    "Select Emergency Type",
    "Pin your location",
    "Capture the Incident",
    "Send Emergency Request",
  ];
  const SUBTITLES = [
    "What kind of emergency is it?",
    "Tap the map to drop a pin inside Barangay 167, Caloocan.",
    "Attach a photo so responders can verify what's happening.",
    "Review your emergency, then send it out.",
  ];

  if (submitted) {
    // With coordinates, show the full-page dispatch-tracking map with the
    // responder sheet (details, message/call, live route to the pin)
    if (position) {
      return (
        <RequestTracking
          position={position}
          address={address}
          category={category}
          categoryLabel={chosen?.label ?? "Emergency"}
        />
      );
    }

    // No coordinates — plain success screen
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-red-100">
          <Siren size={36} className="text-red-600" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Request Submitted</h1>
        <p className="mt-1 text-sm text-slate-500">
          Admin and responders have been notified. You can track its progress
          from the map.
        </p>
        <Button
          type="button"
          onClick={() => navigate(PATHS.resident)}
          className="mt-6 h-11 rounded-lg px-6 text-sm font-semibold"
        >
          Back to Home
        </Button>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-md space-y-5 p-6 text-sm text-slate-700">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{TITLES[step]}</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">{SUBTITLES[step]}</p>
      </div>

      {/* Step 0 — category */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {EMERGENCY_CATEGORIES.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setCategory(value); setStep(1); }}
              className="flex min-h-20 flex-col items-start justify-center rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-red-400"
            >
              <Icon size={17} className="text-red-500" />
              <strong className="mt-2 text-xs text-slate-900">{label}</strong>
              <small className="text-[10px] text-slate-500">{hint}</small>
            </button>
          ))}
        </div>
      )}

      {/* Step 1 — location */}
      {step === 1 && (
        <>
          {chosen && (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
              {(() => { const Icon = chosen.icon; return <Icon size={18} className="text-red-500" />; })()}
              <span className="text-xs font-semibold text-slate-700">{chosen.label}</span>
            </div>
          )}

          {outside ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 px-3 py-3 ring-1 ring-red-200">
              <LocateFixed size={17} className="mt-0.5 shrink-0 text-red-500" />
              <div className="text-xs leading-5">
                <p className="font-semibold text-red-700">You're outside Barangay 167</p>
                <p className="text-red-600">This service is exclusive to Barangay 167, Caloocan. Tap the map to pin your exact location inside the boundary.</p>
              </div>
            </div>
          ) : position ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-[#e3f2e9] px-3 py-3 ring-1 ring-primary/20">
              <LocateFixed size={17} className="mt-0.5 shrink-0 text-primary" />
              <div className="text-xs leading-5">
                <p className="font-semibold text-primary">Location pinned in Barangay 167</p>
                <p className="text-slate-600">{address || "Current location"}</p>
                <p className="text-slate-400">{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-3 ring-1 ring-amber-200">
              <LocateFixed size={17} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs leading-5 text-amber-700">
                Tap the map below to pin your exact location inside Barangay 167.
              </p>
            </div>
          )}

          {!boundary && (
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Nearest street or landmark"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
            />
          )}

          <div className="h-56 w-full overflow-hidden rounded-lg ring-1 ring-slate-200">
            <MapViewer
              variant="picker"
              incidents={[]}
              selectedLocation={position}
              onLocationSelect={(loc) => { setAddressEdited(false); setPosition(loc); }}
            />
          </div>

          <Button
            type="button"
            size="lg"
            disabled={!locationReady}
            onClick={() => setStep(2)}
            className="h-12 w-full rounded-xl text-sm font-semibold"
          >
            Continue <ChevronRight size={16} />
          </Button>
        </>
      )}

      {/* Step 2 — photo */}
      {step === 2 && (
        <>
          <Input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).map((f) => URL.createObjectURL(f));
              setPhotos((prev) => [...prev, ...files]);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <EvidenceButton
              icon={Camera}
              label="Take Photo"
              onClick={() =>
                navigate(PATHS.photoCapture, {
                  state: { emergencyFlow: true, emergencyType: category, address, fromEmergencyPage: true },
                })
              }
            />
            <EvidenceButton icon={Upload} label="Upload Photo" onClick={() => photoInputRef.current?.click()} />
          </div>

          {photos.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
              Optional, but a photo helps responders verify the situation.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                <div key={photo} className="relative">
                  <img
                    src={photo}
                    alt={`Photo ${i + 1}`}
                    onClick={() => setPreviewPhoto(photo)}
                    className="h-20 w-20 cursor-zoom-in rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-red-600"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button
            type="button"
            size="lg"
            onClick={() => setStep(3)}
            className="h-12 w-full rounded-xl text-sm font-semibold"
          >
            {photos.length > 0 ? "Continue" : "Skip for now"} <ChevronRight size={16} />
          </Button>
        </>
      )}

      {/* Step 3 — review & send */}
      {step === 3 && (
        <>
          <section className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <p className="mb-1 font-semibold text-slate-800">Review</p>
            <p><span className="font-medium">Emergency:</span>{" "}<span className="font-semibold text-red-600">{chosen?.label}</span></p>
            <p><span className="font-medium">Location:</span> {address || "Current location"}</p>
            <p><span className="font-medium">Photo:</span> {photos.length > 0 ? `${photos.length} attached` : "None"}</p>
            {position && (
              <p><span className="font-medium">Coordinates:</span> {position.lat.toFixed(6)}, {position.lng.toFixed(6)}</p>
            )}
          </section>

          <Button
            type="button"
            size="lg"
            onClick={() => setSubmitted(true)}
            className="h-12 w-full rounded-xl bg-red-600 text-sm font-semibold text-white shadow-lg shadow-red-600/25 hover:bg-red-700"
          >
            <Siren size={16} />
            Send Emergency Request
          </Button>
        </>
      )}

      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[1100] flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          <img src={previewPhoto} alt="Preview" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </section>
  );
}
