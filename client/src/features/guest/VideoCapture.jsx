import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  MapPin,
  RotateCcw,
  Square,
  Video,
} from "lucide-react";

import { Button } from "../../shared/components/ui/button";
import { PATHS } from "../../router/paths";
import { useAddress } from "../../shared/hooks/useAddress";

const formatCoordinates = (location) =>
  location
    ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : "Location unavailable";

const formatTimer = (totalSeconds) =>
  `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(
    totalSeconds % 60,
  ).padStart(2, "0")}`;

// Best supported container first; mp4 plays natively on iOS Safari
const pickMimeType = () => {
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return (
    candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? ""
  );
};

export default function VideoCapture() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [cameraError, setCameraError] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [capturedVideo, setCapturedVideo] = useState(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");

  const geo = useAddress(
    location ? { lat: location.latitude, lng: location.longitude } : null,
  );

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (active) setCameraError("Camera access is required to record video.");
      }
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setCameraError("Video recording is not supported in this browser.");
    } else {
      startCamera();
    }

    if (!navigator.geolocation) {
      setLocationError("Location is unavailable.");
    } else {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (active) setLocation(coords);
        },
        () => {
          if (active)
            setLocationError("Allow location access to add coordinates.");
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
    };
  }, [cameraKey]);

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickMimeType();
    try {
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        setCapturedVideo(URL.createObjectURL(blob));
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(
        () => setElapsed((seconds) => seconds + 1),
        1000,
      );
    } catch {
      setCameraError("Video recording failed. Please try again.");
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  function retakeVideo() {
    if (capturedVideo) URL.revokeObjectURL(capturedVideo);
    setCapturedVideo(null);
    setCameraKey((key) => key + 1);
  }

  function confirmVideo() {
    navigate(routeLocation.state?.returnPath ?? PATHS.guestReport, {
      state: {
        ...routeLocation.state,
        capturedVideo,
        coordinates: formatCoordinates(location),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        address: geo.address,
      },
    });
  }

  const locationLabel = geo.address || locationError || "Getting location…";

  return (
    <section className="fixed inset-0 z-30 flex flex-col bg-black">
      {/* Header */}
      <header className="flex items-center gap-3 bg-slate-950 px-4 py-3 text-white">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          disabled={recording}
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-sm font-semibold">Video Evidence</h1>
      </header>

      {/* Viewfinder / preview */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-slate-950">
        {capturedVideo ? (
          <video
            src={capturedVideo}
            controls
            className="max-h-full w-full object-contain"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            {/* Camera error */}
            {cameraError && (
              <div className="absolute inset-x-6 flex flex-col items-center gap-3 text-center">
                <Video size={28} className="text-white/60" />
                <p className="text-sm text-white/80">{cameraError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCameraKey((key) => key + 1)}
                  className="rounded-full bg-transparent text-white"
                >
                  Try again
                </Button>
              </div>
            )}

            {/* Recording indicator */}
            {recording && (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-white" />
                </span>
                <span className="font-mono tabular-nums">
                  {formatTimer(elapsed)}
                </span>
              </div>
            )}

            {/* Live location badge */}
            <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/65 px-3 py-2.5 text-xs text-white backdrop-blur-sm">
              <p className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  <span className="block font-semibold leading-snug">
                    {geo.loading && location
                      ? "Finding street name…"
                      : locationLabel}
                  </span>
                  {location && (
                    <span className="block text-white/60">
                      {formatCoordinates(location)}
                    </span>
                  )}
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Bottom controls */}
      {capturedVideo ? (
        <div className="space-y-3 bg-white px-4 py-5">
          <p className="rounded-full bg-primary/10 px-3 py-2 text-center text-xs font-semibold text-primary">
            Video recorded successfully
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={retakeVideo}
            >
              <RotateCcw size={16} className="mr-1.5" /> Retake
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={confirmVideo}
            >
              <Check size={16} className="mr-1.5" /> Use Video
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center bg-slate-950 py-6">
          {recording ? (
            <button
              type="button"
              aria-label="Stop recording"
              onClick={stopRecording}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-600 text-white transition active:scale-95"
            >
              <Square size={22} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Start recording"
              onClick={startRecording}
              disabled={!!cameraError}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-red-500 transition active:scale-95 disabled:opacity-40"
            >
              <Video size={26} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
