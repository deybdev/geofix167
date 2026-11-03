import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, MapPin, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../shared/components/ui/button";
import { PATHS } from "../../router/paths";
import { useAddress } from "../../shared/hooks/useAddress";

const formatCoordinates = (location) =>
  location
    ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : "Location unavailable";

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (
    end > 1 &&
    ctx.measureText(`${text.slice(0, end)}...`).width > maxWidth
  ) {
    end -= 1;
  }
  return `${text.slice(0, end)}...`;
}

function drawStamp(canvas, video, location, address, capturedDate) {
  const { videoWidth: w, videoHeight: h } = video;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  // Smaller text
  const baseFontSize = Math.max(11, w * 0.018);
  const lineGap = baseFontSize * 1.4;
  const pad = baseFontSize * 0.75;

  const lines = [
    { text: capturedDate.toLocaleString(), bold: false },
    address ? { text: `Location: ${address}`, bold: false, fit: true } : null,
    {
      text: `Coordinates: ${formatCoordinates(location)}`,
      bold: false,
    },
  ].filter(Boolean);

  // Calculate background width based on the longest text
  ctx.font = `400 ${baseFontSize}px sans-serif`;

  const maxLineWidth = Math.max(
    ...lines.map((line) => {
      ctx.font = `${line.bold ? "600" : "400"} ${baseFontSize}px sans-serif`;
      return ctx.measureText(line.text).width;
    }),
  );

  const panelWidth = Math.min(maxLineWidth + pad * 2, w * 0.9);
  const panelHeight = pad * 2 + lines.length * lineGap;

  const panelX = 0;
  const panelY = h - panelHeight;

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);

  // Horizontally mirrored text
  ctx.save();
  ctx.translate(panelWidth, 0);
  ctx.scale(-1, 1);

  let y = panelY + pad;

  for (const line of lines) {
    ctx.font = `${line.bold ? "600" : "400"} ${baseFontSize}px sans-serif`;
    ctx.fillStyle = "#ffffff";

    const text = line.fit
      ? fitText(ctx, line.text, panelWidth - pad * 2)
      : line.text;

    ctx.fillText(text, panelX + pad, y + baseFontSize);
    y += lineGap;
  }

  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.9);
}

export default function PhotoCapture() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraError, setCameraError] = useState("");
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedAt, setCapturedAt] = useState(null);
  const [cameraKey, setCameraKey] = useState(0);

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
        if (active)
          setCameraError("Camera access is required to take a photo.");
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not support camera capture.");
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
    };
  }, [cameraKey]);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const now = new Date();
    const dataUrl = drawStamp(canvas, video, location, geo.address, now);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCapturedAt(now);
    setCapturedPhoto(dataUrl);
  }

  function retakePhoto() {
    setCapturedPhoto(null);
    setCapturedAt(null);
    setCameraKey((k) => k + 1);
  }

  function confirmPhoto() {
    navigate(PATHS.report, {
      state: {
        capturedPhoto,
        capturedAt: capturedAt?.toISOString(),
        coordinates: formatCoordinates(location),
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        address: geo.address,
      },
    });
  }

  const locationLabel = location
    ? geo.address ||
      (geo.loading ? "Finding street name…" : "Street name unavailable")
    : locationError || "Getting location…";

  return (
    <section className="fixed inset-0 z-30 flex flex-col bg-black">
      {/* Header */}
      <header className="flex items-center gap-3 bg-slate-950 px-4 py-3 text-white">
        <button type="button" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-sm font-semibold">Photo Evidence</h1>
      </header>

      {/* Viewfinder / preview */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-slate-950">
        {capturedPhoto ? (
          <img
            src={capturedPhoto}
            alt="Captured evidence"
            className="max-h-full -scale-x-100 w-full object-contain"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full -scale-x-100 w-full object-cover"
          />
        )}

        {/* Camera error */}
        {!capturedPhoto && cameraError && (
          <p className="absolute inset-x-6 text-center text-sm text-white/80">
            {cameraError}
          </p>
        )}

        {/* Live location badge */}
        {!capturedPhoto && (
          <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-black/65 px-3 py-2.5 text-xs text-white backdrop-blur-sm">
            <p className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-300" />
              <span>
                <span className="block font-semibold leading-snug">
                  {locationLabel}
                </span>
                {location && (
                  <span className="block text-white/60">
                    {formatCoordinates(location)}
                  </span>
                )}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bottom controls */}
      {capturedPhoto ? (
        <div className="space-y-3 bg-white px-4 py-5">
          <p className="rounded-full bg-emerald-100 px-3 py-2 text-center text-xs font-semibold text-emerald-700">
            ✓ Photo captured successfully
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={retakePhoto}
            >
              <RotateCcw size={16} className="mr-1.5" /> Retake
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={confirmPhoto}
            >
              <Check size={16} className="mr-1.5" /> Use Photo
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center bg-slate-950 py-6">
          <button
            type="button"
            aria-label="Capture photo"
            onClick={capturePhoto}
            disabled={!!cameraError}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40"
          >
            <Camera size={26} className="text-white" />
          </button>
        </div>
      )}
    </section>
  );
}
