import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Camera,
  CircleAlert,
  LocateFixed,
  RotateCcw,
  Siren,
  Video,
  X,
} from "lucide-react";

import { Button } from "../../shared/components/ui/button";
import MapViewer from "../../shared/components/MapViewer";
import { isInside } from "../../shared/utils/mapUtils";
import { PATHS } from "../../router/paths";
import { useGeoLocation } from "../../shared/context/LocationProvider";
import { CATEGORIES } from "../resident/Report";

const STEPS = [
  "Select Emergency Type",
  "Confirm Your Location",
  "Add Evidence",
  "Send Emergency Request",
];

const STEP_SUBTITLES = [
  "What kind of emergency is it?",
  "We've locked onto your location for the responders.",
  "Attach a photo or video so responders can verify what's happening.",
  "Review your emergency, then send it out.",
];

export default function GuestReport() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const photoState = routeLocation.state;

  // Returning from the camera/video capture? Restore what we carried along
  const restored = Boolean(photoState?.capturedPhoto || photoState?.capturedVideo);
  const [step, setStep] = useState(restored ? 2 : 0);
  const [category, setCategory] = useState(photoState?.emergencyType ?? null);
  const [position, setPosition] = useState(
    Number.isFinite(photoState?.latitude)
      ? { lat: photoState.latitude, lng: photoState.longitude }
      : null,
  );
  const [address, setAddress] = useState(photoState?.address ?? "");
  const [addressEdited, setAddressEdited] = useState(false);
  const [photos, setPhotos] = useState(
    photoState?.capturedPhoto ? [photoState.capturedPhoto] : [],
  );
  const [video, setVideo] = useState(photoState?.capturedVideo ?? null);
  const [submitted, setSubmitted] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);

  const geoCtx = useGeoLocation();
  const locating = geoCtx.locating;
  const locationError = geoCtx.locationError;
  const geo = geoCtx.geo;

  // Sync position from global context unless the capture page gave us one
  useEffect(() => {
    if (!position && geoCtx.position) setPosition(geoCtx.position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoCtx.position]);

  // Auto-fill the street name, unless the guest pinned/typed their own
  useEffect(() => {
    if (geo.address && !addressEdited) setAddress(geo.address);
  }, [geo.address, addressEdited]);

  // Barangay boundary, used to enforce the exclusive-service rule
  const [boundary, setBoundary] = useState(null);
  useEffect(() => {
    fetch("/barangay-167.geojson")
      .then((res) => res.json())
      .then(setBoundary)
      .catch(() => setBoundary(null));
  }, []);

  // A pin is only valid when it sits inside Barangay 167. When the boundary
  // is unavailable (fetch failed) we can't verify, so any location is allowed.
  const insideOk =
    !boundary || (position && isInside(position.lat, position.lng, boundary));

  const locationReady = boundary
    ? Boolean(position) && insideOk === true
    : Boolean(position) || address.trim() !== "";

  const stepBlocked = [!category, !locationReady, false, false][step];
  const outside = Boolean(position && boundary && !insideOk);
  const chosen = CATEGORIES.emergency.find((item) => item.value === category);

  // Ask for GPS only after the guest reaches the location step. This keeps
  // browsing and logging in usable when location permission is declined.
  useEffect(() => {
    if (step === 1 && !position && !locating && !locationError) {
      geoCtx.detect();
    }
  }, [step, position, locating, locationError, geoCtx]);

  function detectLocation() {
    geoCtx.detect();
    setAddressEdited(false);
  }

  if (submitted) {
    if (position) {
      return (
        <section className="flex flex-col">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <CircleCheck size={26} className="text-primary" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Request Submitted
              </h1>
              <p className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-primary">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Looking for active responders…
              </p>
            </div>
          </div>

          <div className="relative mt-4 h-72 overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <MapViewer
              variant="picker"
              backPath={PATHS.guest}
              incidents={[]}
              selectedLocation={position}
            />
            <div className="absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-white/95 px-3 py-2.5 text-xs shadow-lg ring-1 ring-black/5">
              <p className="font-semibold text-slate-800">
                Address: {address || "Current location"}
              </p>
              <p className="mt-0.5 leading-4 text-slate-500">
                Admin and responders have been notified. Help will be dispatched
                shortly.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => navigate(PATHS.guest)}
            className="mt-4 h-11 w-full rounded-xl text-sm font-semibold"
          >
            Back to Guest Home
          </Button>
        </section>
      );
    }

    return (
      <div className="flex flex-col items-center py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CircleCheck size={40} className="text-primary" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Request Submitted
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Admin and responders have been notified. You can track its progress
          from the map without an account.
        </p>
        <Button
          type="button"
          onClick={() => navigate(PATHS.guest)}
          className="mt-6 h-11 rounded-lg px-6 text-sm font-semibold"
        >
          Back to Guest Home
        </Button>
      </div>
    );
  }

  return (
    <section className="flex flex-col space-y-5 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            step === 0 ? navigate(PATHS.guest) : setStep((s) => s - 1)
          }
          aria-label="Go back"
          className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-xs font-semibold text-slate-400">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>

      <div>
        <h1 className="text-[22px] font-bold leading-7 text-slate-900">
          {STEPS[step]}
        </h1>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">
          {STEP_SUBTITLES[step]}
        </p>
      </div>

      {/* Step 1: Emergency type */}
      {step === 0 && (
        <section>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.emergency.map(({ value, label, hint, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setCategory(value);
                  setStep(1);
                }}
                className="flex min-h-20 flex-col items-start justify-center rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-red-400"
              >
                <Icon size={17} className="text-red-500" />
                <strong className="mt-2 text-xs text-slate-900">{label}</strong>
                <small className="text-[10px] text-slate-500">{hint}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: Location */}
      {step === 1 && (
        <>
          {chosen && (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
              {(() => {
                const Icon = chosen.icon;
                return <Icon size={18} className="text-red-500" />;
              })()}
              <span className="text-xs font-semibold text-slate-700">
                {chosen.label}
              </span>
            </div>
          )}

          {outside ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 px-3 py-3 ring-1 ring-red-200">
              <LocateFixed size={17} className="mt-0.5 shrink-0 text-red-500" />
              <div className="text-xs leading-5">
                <p className="font-semibold text-red-700">
                  You&apos;re outside Barangay 167
                </p>
                <p className="text-red-600">
                  This service is exclusive to Barangay 167, Caloocan. Tap the
                  map to pin your exact location inside the boundary.
                </p>
              </div>
            </div>
          ) : (
            <div
              className={`flex items-start gap-2.5 rounded-xl px-3 py-3 ring-1 ${
                position
                  ? "bg-[#e3f2e9] ring-primary/20"
                  : "bg-amber-50 ring-amber-200"
              }`}
            >
              <LocateFixed
                size={17}
                className={`mt-0.5 shrink-0 ${
                  position
                    ? "text-primary"
                    : "text-amber-500 " +
                      (locating || geo.loading ? "animate-spin" : "")
                }`}
              />
              {position ? (
                <div className="text-xs leading-5">
                  <p className="font-semibold text-primary">
                    GPS Automatically Detected
                  </p>
                  <p className="text-slate-600">
                    {address || "Current location"}
                  </p>
                  <p className="text-slate-400">
                    {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                  </p>
                </div>
              ) : locating || geo.loading ? (
                <p className="text-xs text-amber-700">
                  Detecting your location…
                </p>
              ) : (
                <div className="flex-1 text-xs leading-5">
                  <p className="font-semibold text-amber-800">
                    {locationError || "Location unavailable"}
                  </p>
                  <p className="text-amber-700">
                    {boundary
                      ? "Pin it on the map below:"
                      : "No problem — pin it on the map below, or type the nearest landmark:"}
                  </p>
                </div>
              )}
              {!position && !locating && !geo.loading && (
                <button
                  type="button"
                  onClick={detectLocation}
                  aria-label="Retry GPS detection"
                  className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-amber-700 transition hover:bg-amber-100"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          )}

          {!position && !locating && !geo.loading && !outside && (
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Nearest street or landmark"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
            />
          )}

          {position && !outside && (
            <p className="mt-1 text-xs text-slate-500">
              Coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </p>
          )}

          {(outside || !position) && (
            <div className="h-44 w-full overflow-hidden rounded-lg ring-1 ring-slate-200">
              <MapViewer
                variant="picker"
                incidents={[]}
                selectedLocation={position}
                onLocationSelect={(loc) => {
                  setAddressEdited(true);
                  setPosition(loc);
                }}
              />
            </div>
          )}

          <Button
            type="button"
            disabled={!locationReady}
            onClick={() => setStep(2)}
            className="h-12 w-full rounded-xl text-sm font-semibold"
          >
            Continue
            <ChevronRight size={16} />
          </Button>
        </>
      )}

      {/* Step 3: Evidence */}
      {step === 2 && (
        <>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(PATHS.guestPhotoCapture, {
                  state: { emergencyType: category, address },
                })
              }
              className="flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-primary hover:border-primary/40 hover:bg-primary/5"
            >
              <Camera size={16} strokeWidth={2} />
              Take Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(PATHS.guestVideoCapture, {
                  state: { emergencyType: category, address },
                })
              }
              className="flex h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-primary hover:border-primary/40 hover:bg-primary/5"
            >
              <Video size={16} strokeWidth={2} />
              Record Video
            </Button>
          </div>

          {photos.length === 0 && !video && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
              Optional, but evidence helps responders verify the situation.
            </p>
          )}

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={photo} className="relative">
                  <img
                    src={photo}
                    alt={`Emergency photo ${index + 1}`}
                    onClick={() => setPreviewPhoto(photo)}
                    className="h-20 w-20 cursor-zoom-in rounded-lg object-cover object-center"
                  />
                  <button
                    type="button"
                    aria-label={`Remove photo ${index + 1}`}
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-red-600"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {video && (
            <div className="relative w-fit">
              <video
                src={video}
                muted
                onClick={() => setStep(2)}
                className="h-20 w-20 rounded-lg object-cover object-center"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-black/25">
                <Video size={18} className="text-white" />
              </span>
              <button
                type="button"
                aria-label="Remove video"
                onClick={() => {
                  URL.revokeObjectURL(video);
                  setVideo(null);
                }}
                className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-red-600"
              >
                <X size={12} strokeWidth={3} />
              </button>
            </div>
          )}

          <Button
            type="button"
            onClick={() => setStep(3)}
            className="h-12 w-full rounded-xl text-sm font-semibold"
          >
            {photos.length > 0 || video ? "Continue" : "Skip for now"}
            <ChevronRight size={16} />
          </Button>
        </>
      )}

      {/* Step 4: Review & send */}
      {step === 3 && (
        <>
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <p className="mb-1 font-semibold text-slate-800">Review</p>
            <p>
              <span className="font-medium">Emergency:</span>{" "}
              <span className="font-semibold text-red-600">
                {chosen?.label}
              </span>
            </p>
            <p>
              <span className="font-medium">Location:</span>{" "}
              {address || "Current location"}
            </p>
            <p>
              <span className="font-medium">Coordinates:</span>{" "}
              {position
                ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`
                : "—"}
            </p>
            <p>
              <span className="font-medium">Evidence:</span>{" "}
              {photos.length > 0
                ? `${photos.length} photo${photos.length > 1 ? "s" : ""}`
                : "No photos"}
              {video && ` + 1 video`}
            </p>
          </div>

          {!locationReady && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <CircleAlert size={14} />
              A location inside Barangay 167 is required to send a request.
            </p>
          )}

          <Button
            type="button"
            disabled={!locationReady}
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
          <img
            src={previewPhoto}
            alt="Photo preview"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </section>
  );
}
