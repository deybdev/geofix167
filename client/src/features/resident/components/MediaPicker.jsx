import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "../../../shared/components/ui/button";

const TYPES = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"];

function FilePreview({ file }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return file.type.startsWith("video/")
    ? <video ref={ref} controls playsInline preload="metadata" aria-label={file.name} className="h-32 w-full rounded-lg bg-black object-contain" />
    : <button type="button" aria-label={expanded ? "Close photo preview" : `Preview ${file.name}`}
        onClick={() => setExpanded(value => !value)}
        className={expanded ? "fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 p-4" : "w-full"}>
        <img ref={ref} alt={file.name} className={expanded ? "max-h-full max-w-full object-contain" : "h-32 w-full rounded-lg object-contain"} />
      </button>;
}

/**
 * maxFiles is the maximum total number of items allowed in this picker's queue
 * (not the number of additional selections). Existing items always stay
 * visible and removable, even when capacity drops to zero.
 * onAdd(files) lets a caller take over item creation (e.g. to reuse upload IDs).
 */
export default function MediaPicker({
  files, onChange, onCapture, onAdd, maxFiles = 5, hideCamera = false, disabled = false,
  hint = "Files upload after your report is saved.",
}) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const limit = Math.max(0, maxFiles);
  const full = files.length >= limit;
  const showCamera = Boolean(onCapture) && !hideCamera;

  function selectFiles(event) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (files.length + selected.length > limit) {
      const room = Math.max(0, limit - files.length);
      setError(room ? `You can add ${room} more file${room === 1 ? "" : "s"} (${limit} maximum here).`
        : "No attachment slots remain for this queue.");
      return;
    }
    for (const file of selected) {
      const max = (file.type.startsWith("video/") ? 25 : 10) * 1024 * 1024;
      if (!TYPES.includes(file.type) || !file.size || file.size > max) {
        setError(`${file.name}: use JPEG, PNG, WebP (up to 10 MiB) or MP4, WebM, MOV (up to 25 MiB).`);
        return;
      }
    }
    setError("");
    if (onAdd) onAdd(selected);
    else onChange([...files, ...selected.map(file => ({ id: crypto.randomUUID(), file }))]);
  }

  return <section>
    <div className="flex gap-2">
      {showCamera && <Button type="button" variant="outline" disabled={disabled || full} onClick={onCapture} className="h-11 flex-1">
        <Camera size={16} /> Take Photo
      </Button>}
      <Button type="button" variant="outline" disabled={disabled || full} onClick={() => inputRef.current?.click()} className="h-11 flex-1">
        <Upload size={16} /> Add Photo / Video
      </Button>
    </div>
    <input ref={inputRef} type="file" multiple accept={TYPES.join(",")} className="hidden" onChange={selectFiles} />
    <p className="mt-2 text-xs text-slate-500">Optional: up to {limit} file{limit === 1 ? "" : "s"}. Photos up to 10 MiB; short videos up to 25 MiB. {hint}</p>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    <div className="mt-3 grid grid-cols-2 gap-3">
      {files.map(item => <div key={item.id} className="relative rounded-lg border border-slate-200 p-2">
        <FilePreview file={item.file} />
        <p className="mt-1 truncate text-xs">{item.file.name}</p>
        {item.label && <p className="truncate text-[10px] text-slate-500">{item.label}</p>}
        <button type="button" aria-label={`Remove ${item.file.name}`} disabled={disabled} onClick={() => { setError(""); onChange(files.filter(file => file.id !== item.id)); }}
          className="absolute right-0 top-0 rounded-full bg-slate-800 p-1 text-white disabled:opacity-50"><X size={14} /></button>
      </div>)}
    </div>
  </section>;
}
