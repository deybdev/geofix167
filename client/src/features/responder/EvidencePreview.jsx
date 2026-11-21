import { FileText, Play } from "lucide-react";
import { useEffect, useMemo } from "react";

const isVideo = (file) => file?.type?.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(file?.name || "");
const isImage = (file) => file?.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file?.name || "");
const isBlob = (file) => typeof Blob !== "undefined" && file instanceof Blob;
const getSource = (file) => {
  const source = file?.url || file?.src || file?.dataUrl || "";
  return /^(data:|https?:\/\/)/i.test(source) ? source : "";
};

export default function EvidencePreview({ file, alt = "Uploaded evidence" }) {
  const canPreview = isBlob(file);
  const source = getSource(file);
  const previewUrl = useMemo(() => (
    canPreview && (isImage(file) || isVideo(file)) ? URL.createObjectURL(file) : ""
  ), [canPreview, file]);
  const mediaSource = previewUrl || source;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!file) return null;
  if (mediaSource && isImage(file)) return <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-100"><img src={mediaSource} alt={alt} className="block max-h-64 w-full object-contain" /><p className="truncate border-t border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">{file.name || "Image evidence"}</p></div>;
  if (mediaSource && isVideo(file)) return <div className="overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-900"><div className="relative"><video src={mediaSource} controls className="block max-h-64 w-full object-contain" /><span className="pointer-events-none absolute left-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"><Play size={15} fill="currentColor" /></span></div><p className="truncate border-t border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200">{file.name || "Video evidence"}</p></div>;
  if (canPreview) return <div className="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 p-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm"><FileText size={24} /></span><div className="min-w-0"><p className="truncate font-bold text-slate-800">{file.name}</p><p className="text-sm text-slate-500">This file type cannot be previewed here.</p></div></div>;
  return null;
}
