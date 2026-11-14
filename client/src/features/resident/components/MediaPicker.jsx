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

export default function MediaPicker({ files, onChange, onCapture }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  function selectFiles(event) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length + selected.length > 5) {
      setError("Choose at most 5 photos or videos per report.");
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
    onChange([...files, ...selected.map(file => ({ id: crypto.randomUUID(), file }))]);
  }

  return <section>
    <div className="flex gap-2">
      <Button type="button" variant="outline" disabled={files.length >= 5} onClick={onCapture} className="h-11 flex-1">
        <Camera size={16} /> Take Photo
      </Button>
      <Button type="button" variant="outline" disabled={files.length >= 5} onClick={() => inputRef.current?.click()} className="h-11 flex-1">
        <Upload size={16} /> Add Photo / Video
      </Button>
    </div>
    <input ref={inputRef} type="file" multiple accept={TYPES.join(",")} className="hidden" onChange={selectFiles} />
    <p className="mt-2 text-xs text-slate-500">Optional: up to 5 files. Photos up to 10 MiB; short videos up to 25 MiB. Files upload after your report is saved.</p>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    <div className="mt-3 grid grid-cols-2 gap-3">
      {files.map(item => <div key={item.id} className="relative rounded-lg border border-slate-200 p-2">
        <FilePreview file={item.file} />
        <p className="mt-1 truncate text-xs">{item.file.name}</p>
        <button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => { setError(""); onChange(files.filter(file => file.id !== item.id)); }}
          className="absolute right-0 top-0 rounded-full bg-slate-800 p-1 text-white"><X size={14} /></button>
      </div>)}
    </div>
  </section>;
}
