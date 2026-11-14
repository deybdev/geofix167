import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, ScanLine, X } from "lucide-react";
import { Button } from "../../shared/components/ui/button";
import LoadingOverlay from "../../shared/components/loading/LoadingOverlay";

export default function BarangayIdScanner({ onScan }) {
  const dialogRef = useRef(null);
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const validId = value => /^\d{4}-\d{4}$/.test(value);

  const createReader = async () => {
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_39]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.ENABLE_CODE_39_EXTENDED_MODE, true);
    return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 500 });
  };

  const loadImage = file => new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("INVALID_IMAGE")); };
    image.src = url;
  });

  const imageCanvas = (image, region, mode = "color") => {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const sx = Math.round(sourceWidth * region.x);
    const sy = Math.round(sourceHeight * region.y);
    const sw = Math.round(sourceWidth * region.width);
    const sh = Math.round(sourceHeight * region.height);
    const scale = Math.min(3, Math.max(0.25, 1800 / sw));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const context = canvas.getContext("2d", { willReadFrequently: mode !== "color" });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    if (mode !== "color") {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const gray = Math.round(pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114);
        const value = mode === "threshold" ? (gray > 145 ? 255 : 0) : Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128));
        pixels.data[index] = value;
        pixels.data[index + 1] = value;
        pixels.data[index + 2] = value;
      }
      context.putImageData(pixels, 0, 0);
    }
    return canvas;
  };

  const decodeIdPhoto = async file => {
    const image = await loadImage(file);
    const reader = await createReader();
    const regions = [
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 0.08, y: 0.18, width: 0.84, height: 0.52 },
      { x: 0.08, y: 0.28, width: 0.84, height: 0.32 },
      { x: 0.04, y: 0.34, width: 0.92, height: 0.24 },
      { x: 0.04, y: 0.42, width: 0.92, height: 0.24 },
    ];
    for (const region of regions) {
      for (const mode of ["color", "grayscale", "threshold"]) {
        try {
          const value = reader.decodeFromCanvas(imageCanvas(image, region, mode)).getText().trim();
          if (validId(value)) return value;
        } catch { /* Try the next automatic enhancement. */ }
      }
    }
    throw new Error("BARCODE_NOT_FOUND");
  };

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  useEffect(() => () => stop(), []);

  const close = () => {
    stop();
    dialogRef.current?.close();
  };

  const start = async () => {
    setError("");
    dialogRef.current?.showModal();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("UNSUPPORTED_CAMERA");
      const [reader, { NotFoundException }] = await Promise.all([createReader(), import("@zxing/library")]);
      setScanning(true);
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        videoRef.current,
        (result, scanError) => {
          if (result) {
            const value = result.getText().trim();
            if (validId(value)) {
              onScan(value);
              close();
            } else {
              setError("The scanned barcode did not contain a valid Barangay ID. Keep only the ID barcode inside the frame.");
            }
          } else if (scanError && !(scanError instanceof NotFoundException)) {
            setError("The barcode could not be read clearly. Hold the ID steady and try again.");
          }
        },
      );
    } catch (err) {
      setError(err?.name === "NotAllowedError"
        ? "Camera access was denied. Allow camera access or enter the ID manually."
        : err?.message === "UNSUPPORTED_CAMERA"
          ? "Camera scanning is not supported by this browser. Open GeoFix in Chrome or enter the ID manually."
          : "The camera could not be opened. Open GeoFix over HTTPS in Chrome or enter the ID manually.");
      stop();
    }
  };

  const readImage = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Choose a JPG, PNG, or other image file up to 10 MB.");
      return;
    }
    setReadingImage(true);
    stop();
    try {
      const value = await decodeIdPhoto(file);
      onScan(value);
      close();
    } catch {
      setError("We couldn’t read the Barangay ID barcode. Retake the full ID photo in good lighting, keep it straight, and avoid glare.");
    } finally {
      setReadingImage(false);
    }
  };

  return (
    <>
      <LoadingOverlay open={readingImage} message="Reading your Barangay ID…" />
      <Button type="button" variant="outline" onClick={start} className="h-11 shrink-0 gap-2" aria-haspopup="dialog">
        <ScanLine size={17} aria-hidden="true" /> Scan ID
      </Button>
      <dialog ref={dialogRef} onClose={stop} className="m-auto w-[min(92vw,28rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-slate-950/60">
        <div className="p-4">
          <header className="flex items-center justify-between gap-3">
            <div><h3 className="font-semibold text-slate-900">Scan Barangay ID</h3><p className="text-xs text-slate-500">Align the barcode or QR code inside the frame.</p></div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={close} aria-label="Close scanner"><X size={19} /></Button>
          </header>
          <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-slate-950">
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            {scanning && <div aria-hidden="true" className="absolute inset-8 rounded-lg border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,.25)]" />}
            {!scanning && !error && <Camera className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/60" size={36} />}
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <input ref={fileRef} type="file" accept="image/*" onChange={readImage} className="sr-only" aria-label="Upload a Barangay ID photo" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={readingImage} className="gap-2"><ImageUp size={17} />{readingImage ? "Reading photo…" : "Upload ID photo"}</Button>
            <Button type="button" variant="outline" onClick={close}>Enter ID manually</Button>
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">The selected image is processed on this device and is not uploaded.</p>
        </div>
      </dialog>
    </>
  );
}
