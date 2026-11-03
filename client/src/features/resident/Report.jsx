import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronDown,
  Info,
  LocateFixed,
  MapPin,
  Upload,
  Video,
} from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { PATHS } from "../../router/paths";
import { useAddress } from "../../shared/hooks/useAddress";

const REPORT_TYPES = [
  { value: "incident", label: "Incident / Emergency" },
  { value: "infrastructure", label: "Infrastructure Concern" },
];

const CATEGORIES = {
  incident: ["Fire", "Medical Emergency", "Accident", "Crime", "Other"],
  infrastructure: [
    "Road Damage",
    "Streetlight",
    "Drainage / Flooding",
    "Garbage",
    "Water / Electricity",
    "Other",
  ],
};

const URGENCY_LEVELS = ["Low", "Medium", "High"];

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
  const [reportType, setReportType] = useState("infrastructure");
  const [category, setCategory] = useState("Road Damage");
  const [description, setDescription] = useState(
    "Large, deep pothole in the middle of Rizal Street, creating hazard for motorcycles and small cars.",
  );
  const [urgency, setUrgency] = useState("High");
  const [submitted, setSubmitted] = useState(false);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

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
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const geo = useAddress(position);

  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setAddressEdited(false); // new position, new address
        setPosition({ lat: coords.latitude, lng: coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationError("Allow location access, or type the address.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Ask for the device location once, unless the photo page gave us one
  useEffect(() => {
    if (!position) detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Put the street name in the text field, unless the person typed their own
  useEffect(() => {
    if (geo.address && !addressEdited) setAddress(geo.address);
  }, [geo.address, addressEdited]);

  function changeReportType(value) {
    setReportType(value);
    setCategory(CATEGORIES[value][0]);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-md space-y-4 text-sm text-slate-700"
    >
      <section>
        <p className="mb-2 font-semibold">Report Type</p>
        <div className="grid grid-cols-2 gap-2">
          {REPORT_TYPES.map((type) => (
            <Button
              key={type.value}
              type="button"
              onClick={() => changeReportType(type.value)}
              variant={reportType === type.value ? "default" : "outline"}
              size="sm"
              className={`h-11 rounded-lg border px-2 text-sm font-semibold transition ${
                reportType === type.value
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {type.label}
            </Button>
          ))}
        </div>
      </section>

      <label className="block">
        <span className="mb-2 block font-semibold">Category</span>
        <span className="relative block">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm outline-none focus:border-primary"
          >
            {CATEGORIES[reportType].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block font-semibold">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          className="min-h-11 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-primary"
        />
      </label>

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
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-11 text-sm outline-none focus:border-primary"
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
        {(locationError || (geo.error && !address)) && (
          <p className="mt-1 text-xs text-red-600">
            {locationError || `${geo.error} You can type it in.`}
          </p>
        )}
        <div className="relative mt-1 h-[66px] overflow-hidden rounded-lg bg-[#e8e4d9]">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(25deg,transparent_45%,#c9c4b8_46%,transparent_48%),linear-gradient(115deg,transparent_45%,#d1cbc0_46%,transparent_48%)] [background-size:45px_30px]" />
          <div className="absolute left-[53%] top-[35%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <MapPin size={21} fill="#168b59" className="text-white drop-shadow" />
            <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-white">
              Current Location
            </span>
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 font-semibold">Photo or Video Evidence</p>
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
        <Input ref={photoInputRef} type="file" accept="image/*" className="hidden" />
        <Input ref={videoInputRef} type="file" accept="video/*" className="hidden" />
        {routeLocation.state?.capturedPhoto && (
          <img
            src={routeLocation.state.capturedPhoto}
            alt="Captured evidence"
            className="mt-2 h-20 w-full rounded-lg object-cover"
          />
        )}
      </section>

      <section>
        <p className="mb-2 font-semibold">Urgency Level</p>
        <div className="grid grid-cols-3 gap-2">
          {URGENCY_LEVELS.map((level) => (
            <Button
              key={level}
              type="button"
              onClick={() => setUrgency(level)}
              variant={urgency === level ? "default" : "outline"}
              size="sm"
              className={`h-11 rounded-lg border text-sm font-medium ${
                urgency === level
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {level}
            </Button>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-lg bg-[#e3f2e9] px-3 py-2 text-xs leading-4 text-primary">
        <Info size={15} className="mt-0.5 shrink-0" />
        <span>
          Use an accurate geotag and clear photo or video evidence to support
          dispatch and response.
        </span>
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-lg text-sm font-semibold sm:h-11"
      >
        {submitted ? "Report Submitted" : "Submit Report"}
      </Button>
    </form>
  );
}