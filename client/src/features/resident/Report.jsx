import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  CarFront,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Construction,
  Droplets,
  Flame,
  HeartPulse,
  LocateFixed,
  Lightbulb,
  MoreHorizontal,
  ShieldAlert,
  Siren,
  Trash2,
  Upload,
  Video,
  Waves,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import MapViewer, { isInside } from "../../shared/components/MapViewer";
import RequestTracking from "./RequestTracking";
import InfraTracking from "./InfraTracking";
import { PATHS } from "../../router/paths";
import { useGeoLocation } from "../../shared/context/LocationProvider";

const STEPS = ["Report type", "What happened?", "Where is it?", "Tell us more", "Add photos or video", "Review and send"];

const REPORT_TYPES = [
  {
    value: "emergency",
    label: "Emergency",
    hint: "Fire, medical, crime, accidents",
    icon: Siren,
  },
  {
    value: "infrastructure",
    label: "Infrastructure",
    hint: "Roads, lights, drainage, garbage",
    icon: Wrench,
  },
];

export const CATEGORIES = {
  emergency: [
    { value: "fire", label: "Fire", hint: "Smoke or flames", icon: Flame },
    { value: "medical", label: "Medical", hint: "Someone needs help", icon: HeartPulse },
    { value: "crime", label: "Crime or threat", hint: "Safety concern", icon: ShieldAlert },
    { value: "accident", label: "Road accident", hint: "Vehicle collision", icon: CarFront },
    { value: "flood", label: "Flood or storm", hint: "Natural hazard", icon: Waves },
    { value: "other", label: "Other", hint: "Something else", icon: MoreHorizontal },
  ],
  infrastructure: [
    { value: "road", label: "Road damage", hint: "Potholes, cracks", icon: Construction },
    { value: "streetlight", label: "Streetlight", hint: "Dark or broken lights", icon: Lightbulb },
    { value: "drainage", label: "Drainage / flooding", hint: "Blocked or leaking", icon: Droplets },
    { value: "garbage", label: "Garbage", hint: "Uncollected or dumped", icon: Trash2 },
    { value: "utilities", label: "Water / electricity", hint: "Outage or leaks", icon: Zap },
    { value: "other", label: "Other", hint: "Something else", icon: MoreHorizontal },
  ],
};

const URGENCY_LEVELS = ["Low", "Moderate", "High", "Critical"];

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

export default function Report() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  // Returning from the camera with an emergency already in flight?
  // Rehydrate the quick flow instead of restarting it.
  const emergencyFlowReturn = routeLocation.state?.emergencyFlow === true;
  const [step, setStep] = useState(
    routeLocation.state?.capturedPhoto ? 4 : 0,
  );
  const [reportType, setReportType] = useState(emergencyFlowReturn ? "emergency" : null);
  const [emergencyStep, setEmergencyStep] = useState(emergencyFlowReturn ? 2 : 0);
  const [category, setCategory] = useState(
    emergencyFlowReturn ? (routeLocation.state?.emergencyType ?? null) : null,
  );
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("High");
  const [injured, setInjured] = useState("Yes");
  const [submitted, setSubmitted] = useState(false);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [photos, setPhotos] = useState(
    routeLocation.state?.capturedPhoto ? [routeLocation.state.capturedPhoto] : [],
  );
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Location: comes from the photo page if a photo was just taken,
  // otherwise from this device's GPS
  const photoState = routeLocation.state;
  const [position, setPosition] = useState(
    Number.isFinite(photoState?.latitude)
      ? { lat: photoState.latitude, lng: photoState.longitude }
      : null,
  );
  const [address, setAddress] = useState(photoState?.address ?? "");
  const [addressEdited, setAddressEdited] = useState(false);
  const [touched, setTouched] = useState(false);
  const geoCtx = useGeoLocation();
  const locating = geoCtx.locating;
  const locationError = geoCtx.locationError;
  const geo = geoCtx.geo;

  // Sync position from global context unless photo page gave us one
  useEffect(() => {
    if (!position && geoCtx.position) setPosition(geoCtx.position);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoCtx.position]);

  // Put the street name in the text field, unless the person typed their own
  useEffect(() => {
    if (geo.address && !addressEdited) setAddress(geo.address);
  }, [geo.address, addressEdited]);

  function detectLocation() {
    geoCtx.detect();
    setAddressEdited(false);
  }

  // Barangay boundary, used to enforce the exclusive-service rule
  const [boundary, setBoundary] = useState(null);
  useEffect(() => {
    fetch("/barangay-167.geojson")
      .then((res) => res.json())
      .then(setBoundary)
      .catch(() => setBoundary(null));
  }, []);

  // A pin is only valid when it sits inside Barangay 167. When the
  // boundary is unavailable (fetch failed) we can't verify, so any
  // location is allowed rather than blocking the resident.
  const insideOk =
    !boundary || (position && isInside(position.lat, position.lng, boundary));

  // Location is acceptable only with a pin inside the barangay; without a
  // verifiable boundary, a typed address is an acceptable fallback
  const locationReady = boundary
    ? Boolean(position) && insideOk === true
    : Boolean(position) || address.trim() !== "";

  // Blockers for moving forward on each step
  const stepBlocked = [
    !reportType,
    !category,
    !locationReady,
    description.trim() === "",
    false,
    false,
  ][step];

  function pickReportType(value) {
    setReportType(value);
    setCategory(null); // category list changes, so the pick resets
    if (value === "emergency") {
      // Emergencies use the quick request flow instead of the full wizard;
      // the location step then requires a pin inside Barangay 167
      setEmergencyStep(0);
    } else {
      setStep(1); // categories next, related to the chosen type
    }
  }

  function goNext() {
    setTouched(true);
    if (stepBlocked) return;
    setTouched(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!category) return; // type may have changed mid-flow, invalidating it
    setSubmitted(true);
  }

  if (submitted) {
    const emergency = reportType === "emergency";

    // With a pinned location, show the full-page tracking view:
    // infrastructure follows the maintenance workflow timeline, while
    // emergencies get the live responder-dispatch map
    if (position) {
      const categoryLabel =
        CATEGORIES[reportType]?.find((item) => item.value === category)?.label ??
        "Report";

      if (reportType === "infrastructure") {
        return (
          <InfraTracking
            address={address}
            category={category}
            categoryLabel={categoryLabel}
            photos={photos}
          />
        );
      }

      return (
        <RequestTracking
          position={position}
          address={address}
          category={category}
          categoryLabel={categoryLabel}
        />
      );
    }

    // No coordinates (boundary check unavailable) — plain success screen
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <CircleCheck size={40} className="text-primary" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          {emergency ? "Request Submitted" : "Report Submitted"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {emergency
            ? "Admin and responders have been notified. You can track its progress from the map."
            : "Thank you! Your report has been sent to the responders. You can track its progress from the map."}
        </p>
        <Button
          type="button"
          onClick={() => navigate(PATHS.map)}
          className="mt-6 h-11 rounded-lg px-6 text-sm font-semibold"
        >
          Back to Home
        </Button>
      </div>
    );
  }

  // Quick emergency flow: type -> GPS -> capture -> send (no full wizard)
  if (reportType === "emergency") {
    const titles = [
      "Select Emergency Type",
      "Pin your location",
      "Capture the Incident",
      "Send Emergency Request",
    ];
    const subtitles = [
      "What kind of emergency is it?",
      "Tap the map to drop a pin inside Barangay 167, Caloocan.",
      "Attach a photo so responders can verify what's happening.",
      "Review your emergency, then send it out.",
    ];
    const chosen = CATEGORIES.emergency.find(
      (item) => item.value === category,
    );
    const outside = Boolean(position && boundary && !insideOk);

    return (
      <section className="mx-auto max-w-md space-y-5 text-sm text-slate-700">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() =>
              emergencyStep === 0
                ? setReportType(null)
                : setEmergencyStep((s) => s - 1)
            }
            aria-label="Go back"
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {titles[emergencyStep]}
          </h1>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {subtitles[emergencyStep]}
          </p>
        </div>

        {emergencyStep === 0 && (
          <section>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.emergency.map(({ value, label, hint, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCategory(value);
                    setEmergencyStep(1);
                  }}
                  className="flex min-h-20 flex-col items-start justify-center rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary/50 hover:border-red-400"
                >
                  <Icon size={17} className="text-red-500" />
                  <strong className="mt-2 text-xs text-slate-900">{label}</strong>
                  <small className="text-[10px] text-slate-500">{hint}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        {emergencyStep === 1 && (
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
                    You're outside Barangay 167
                  </p>
                  <p className="text-red-600">
                    This service is exclusive to Barangay 167, Caloocan. Tap the
                    map to pin your exact location inside the boundary.
                  </p>
                </div>
              </div>
            ) : position ? (
              <div className="flex items-start gap-2.5 rounded-xl bg-[#e3f2e9] px-3 py-3 ring-1 ring-primary/20">
                <LocateFixed size={17} className="mt-0.5 shrink-0 text-primary" />
                <div className="text-xs leading-5">
                  <p className="font-semibold text-primary">
                    Location pinned in Barangay 167
                  </p>
                  <p className="text-slate-600">
                    {address || "Current location"}
                  </p>
                  <p className="text-slate-400">
                    {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-3 ring-1 ring-amber-200">
                <LocateFixed size={17} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-xs leading-5 text-amber-700">
                  Tap the map below to pin your exact location inside
                  Barangay 167.
                </p>
              </div>
            )}
            {!boundary && (
              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Nearest street or landmark"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-primary"
              />
            )}
            <div className="h-56 w-full overflow-hidden rounded-lg ring-1 ring-slate-200">
              <MapViewer
                variant="picker"
                incidents={[]}
                selectedLocation={position}
                onLocationSelect={(loc) => {
                  setAddressEdited(false);
                  setPosition(loc);
                }}
              />
            </div>
            <Button
              type="button"
              size="lg"
              disabled={!locationReady}
              onClick={() => setEmergencyStep(2)}
              className="h-12 w-full rounded-xl text-sm font-semibold"
            >
              Continue
              <ChevronRight size={16} />
            </Button>
          </>
        )}

        {emergencyStep === 2 && (
          <section>
            <Input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).map((file) =>
                  URL.createObjectURL(file),
                );
                setPhotos((prev) => [...prev, ...files]);
                event.target.value = "";
              }}
            />
            <div className="flex gap-2">
              <EvidenceButton
                icon={Camera}
                label="Take Photo"
                onClick={() =>
                  navigate(PATHS.photoCapture, {
                    state: {
                      emergencyFlow: true,
                      emergencyType: category,
                      address,
                    },
                  })
                }
              />
              <EvidenceButton
                icon={Upload}
                label="Upload Photo"
                onClick={() => photoInputRef.current?.click()}
              />
            </div>
            {photos.length === 0 ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                Optional, but a photo of the incident helps responders verify
                the situation.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <div key={photo} className="relative">
                    <img
                      src={photo}
                      alt={`Incident photo ${index + 1}`}
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
            <Button
              type="button"
              size="lg"
              onClick={() => setEmergencyStep(3)}
              className="mt-4 h-12 w-full rounded-xl text-sm font-semibold"
            >
              {photos.length > 0 ? "Continue" : "Skip for now"}
              <ChevronRight size={16} />
            </Button>
          </section>
        )}

        {emergencyStep === 3 && (
          <>
            <section className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
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
                <span className="font-medium">Photo:</span>{" "}
                {photos.length > 0 ? `${photos.length} attached` : "None"}
              </p>
              <p>
                <span className="font-medium">Coordinates:</span>{" "}
                {position ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : "—"}
              </p>
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

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-md space-y-5 text-sm text-slate-700"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))}
          aria-label="Go back"
          className="flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-primary hover:text-primary"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Progress header */}
      <div>
        <div className="flex items-baseline justify-center">
          <p className="text-xs font-semibold text-slate-400">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
        <div className="mt-2 flex gap-1">
          {STEPS.map((label, i) => (
            <span key={label} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-slate-200"}`} />
          ))}
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">{STEPS[step]}</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {step === 0 && "Is it an emergency or about public infrastructure?"}
          {step === 1 && "Choose the closest match. You can add details next."}
          {step === 2 && "An exact location helps responders arrive faster."}
          {step === 3 && "This helps dispatch send the right help."}
          {step === 4 && "Optional, but it helps responders prepare."}
          {step === 5 && "Check everything, then submit your report."}
        </p>
      </div>

      {/* Step 1: Report type */}
      {step === 0 && (
        <section className="space-y-2">
          {REPORT_TYPES.map(({ value, label, hint, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => pickReportType(value)}
              className={`flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition ${
                reportType === value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-slate-200 bg-white hover:border-primary/50"
              }`}
            >
              <span className={`flex size-12 shrink-0 items-center justify-center rounded-full ${
                value === "emergency" ? "bg-red-50" : "bg-primary/10"
              }`}>
                <Icon size={24} className={value === "emergency" ? "text-red-500" : "text-primary"} />
              </span>
              <span className="flex-1">
                <strong className="block text-base text-slate-900">{label}</strong>
                <small className="text-xs text-slate-500">{hint}</small>
              </span>
            </button>
          ))}
        </section>
      )}

      {/* Step 2: What happened (categories for the chosen type) */}
      {step === 1 && (
        <section>
          <p className="mb-2 font-semibold">Category</p>
          <div className="grid grid-cols-2 gap-2">
            {(CATEGORIES[reportType] ?? []).map(({ value, label, hint, icon: Icon }) => (
              <button key={value} type="button" onClick={() => setCategory(value)}
                className={`flex min-h-20 flex-col items-start justify-center rounded-xl border p-3 text-left transition ${category === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 bg-white hover:border-primary/50"}`}>
                <Icon size={17} className={category === value ? "text-primary" : "text-slate-700"} />
                <strong className="mt-2 text-xs text-slate-900">{label}</strong>
                <small className="text-[10px] text-slate-500">{hint}</small>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-500">Not sure? Pick Other and describe it in your own words later.</p>
          {touched && !category && (
            <p className="mt-1 text-xs text-red-600">Pick a category to continue.</p>
          )}
        </section>
      )}

      {/* Step 3: Location */}
      {step === 2 && (
        <section>
          <p className="mb-2 font-semibold">Location / Map Pin</p>
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                setAddressEdited(event.target.value.trim() !== "");
              }}
              placeholder={
                locating || geo.loading
                  ? "Finding your location..."
                  : "Street or landmark"
              }
              className={`h-11 w-full rounded-lg border px-3 pr-11 text-sm outline-none focus:border-primary ${
                touched && !position && address.trim() === ""
                  ? "border-red-400"
                  : "border-slate-200"
              }`}
            />
            <button
              type="button"
              aria-label="Use my current location"
              onClick={detectLocation}
              disabled={locating}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-primary disabled:opacity-50"
            >
              <LocateFixed size={16} className={locating ? "animate-spin" : ""} />
            </button>
          </div>
          {position && (
            <p className="mt-1 text-xs text-slate-500">
              Coordinates: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </p>
          )}
          {position && boundary && !insideOk ? (
            <p className="mt-1 flex items-start gap-1 rounded-lg bg-red-50 px-2.5 py-2 text-xs leading-4 text-red-700 ring-1 ring-red-200">
              <span className="mt-0.5">
                <LocateFixed size={12} className="text-red-500" />
              </span>
              You're outside Barangay 167 — this service is exclusive to the
              barangay. Tap the map to pin your exact location inside.
            </p>
          ) : (locationError || (geo.error && !address)) && (
            <p className="mt-1 text-xs text-red-600">
              {locationError || `${geo.error} You can type it in.`}
            </p>
          )}
          <div className="mt-3 h-44 w-full overflow-hidden rounded-lg ring-1 ring-slate-200">
            <MapViewer
              variant="picker"
              incidents={[]}
              selectedLocation={position}
              onLocationSelect={(loc) => {
                setAddressEdited(false); // let the street name auto-fill refresh
                setPosition(loc);
              }}
            />
          </div>
        </section>
      )}

      {/* Step 4: Details */}
      {step === 3 && (
        <section>
          <p className="mb-2 text-xs font-semibold">How serious is it?</p>
          <div className="grid grid-cols-4 gap-1.5">
            {URGENCY_LEVELS.map((level) => (
              <Button key={level} type="button" onClick={() => setUrgency(level)} variant={urgency === level ? "default" : "outline"} size="sm" className="h-9 rounded-lg px-1 text-xs">{level}</Button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-slate-500">{urgency}: serious danger to people or property.</p>
          <p className="mb-2 mt-4 text-xs font-semibold">Is anyone injured?</p>
          <div className="grid grid-cols-3 gap-2">
            {["Yes", "No", "Not sure"].map((value) => (
              <Button key={value} type="button" onClick={() => setInjured(value)} variant={injured === value ? "default" : "outline"} size="sm" className="h-9 rounded-lg text-xs">{value}</Button>
            ))}
          </div>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-semibold">Describe what is happening</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What can you see? Are there hazards responders should know about?" className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
        </section>
      )}

      {/* Step 5: Evidence */}
      {step === 4 && (
        <section>
          <div className="flex gap-2">
            <EvidenceButton
              icon={Camera}
              label="Take Photo"
              onClick={() => navigate(PATHS.photoCapture)}
            />
            <EvidenceButton
              icon={Upload}
              label="Upload Photo"
              onClick={() => photoInputRef.current?.click()}
            />
            <EvidenceButton
              icon={Video}
              label="Upload Video"
              onClick={() => videoInputRef.current?.click()}
            />
          </div>
          <Input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []).map((file) =>
                URL.createObjectURL(file),
              );
              setPhotos((prev) => [...prev, ...files]);
              event.target.value = "";
            }}
          />
          <Input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
          />
          {photos.length === 0 && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
              Optional, but evidence helps responders act faster.
            </p>
          )}
          {photos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={photo} className="relative">
                  <img
                    src={photo}
                    alt={`Evidence ${index + 1}`}
                    onClick={() => setPreviewPhoto(photo)}
                    className="h-20 w-20 cursor-zoom-in rounded-lg object-cover object-center"
                  />
                  <button
                    type="button"
                    aria-label={`Remove evidence ${index + 1}`}
                    onClick={() =>
                      setPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-slate-800 text-white shadow hover:bg-primary"
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step 6: Review */}
      {step === 5 && (
        <>
          <section className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            <p className="mb-1 font-semibold text-slate-800">Review</p>
            <p>
              <span className="font-medium">Type:</span>{" "}
              {REPORT_TYPES.find((item) => item.value === reportType)?.label}
            </p>
            <p>
              <span className="font-medium">Category:</span>{" "}
              {CATEGORIES[reportType]?.find((item) => item.value === category)?.label}
            </p>
            <p><span className="font-medium">Urgency:</span> {urgency}</p>
            <p><span className="font-medium">Injured:</span> {injured}</p>
            <p>
              <span className="font-medium">Location:</span>{" "}
              {address || "Current location"}
            </p>
            <p>
              <span className="font-medium">Evidence:</span>{" "}
              {photos.length > 0
                ? `${photos.length} photo${photos.length > 1 ? "s" : ""}`
                : "None"}
            </p>
            <p><span className="font-medium">Details:</span> {description || "None"}</p>
          </section>
        </>
      )}

      {/* Back / Next / Submit */}
      <div className="flex items-center gap-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setStep((s) => s - 1)}
            className="h-12 flex-1 rounded-lg text-sm font-semibold sm:h-11"
          >
            <ChevronLeft size={16} />
            Back
          </Button>
        )}
        {step > 0 && step < STEPS.length - 1 && (
          <Button
            type="button"
            onClick={goNext}
            size="lg"
            className="h-12 flex-[2] rounded-lg text-sm font-semibold sm:h-11"
          >
            Next
            <ChevronRight size={16} />
          </Button>
        )}
        {step === STEPS.length - 1 && (
          <Button
            type="submit"
            size="lg"
            className="h-12 flex-1 rounded-lg text-sm font-semibold sm:h-11"
          >
            <Check size={16} strokeWidth={3} />
            Submit Report
          </Button>
        )}
      </div>

      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-[1100] flex cursor-zoom-out items-center justify-center bg-black/80 p-4"
        >
          <img
            src={previewPhoto}
            alt="Evidence preview"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </form>
  );
}
