import { useEffect, useRef, useState } from "react";
import { Upload, Check, Clock3, FileText, LoaderCircle, X } from "lucide-react";

import { useNavigate } from "react-router-dom";
import { Button } from "../../shared/components/ui/button";
import { PATHS } from "../../router/paths";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"];
const ACCEPTED_DOCUMENTS = [
  "Barangay Certificate of Residency",
  "Barangay ID",
  "Valid government-issued ID showing a Barangay 167 address",
  "Recent utility bill or proof of address",
];

export default function VerifyDocument() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (submissionStatus !== "uploading") return undefined;

    const progressTimer = setInterval(() => {
      setUploadProgress((currentProgress) => {
        const nextProgress = Math.min(currentProgress + 20, 100);
        if (nextProgress === 100) {
          clearInterval(progressTimer);
          setTimeout(() => setSubmissionStatus("submitted"), 350);
        }
        return nextProgress;
      });
    }, 180);

    return () => clearInterval(progressTimer);
  }, [submissionStatus]);

  useEffect(() => {
    if (!selectedFile?.type.startsWith("image/")) {
      setPreviewUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const hasAcceptedType = ACCEPTED_TYPES.includes(file.type);
    const hasAcceptedExtension = ACCEPTED_EXTENSIONS.includes(extension);

    if (
      file.type.startsWith("video/") ||
      (!hasAcceptedType && !hasAcceptedExtension)
    ) {
      setSelectedFile(null);
      setError("Only JPG, PNG, and PDF files are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setError("File size must not exceed 10MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setSelectedFile(file);
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    setError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleUploadClick() {
    inputRef.current?.click();
  }

  function handleContinue() {
    if (selectedFile) {
      setUploadProgress(0);
      setSubmissionStatus("uploading");
    }
  }

  if (submissionStatus === "uploading") {
    return (
      <section className="mt-24 flex w-full flex-col items-center text-center">
        <LoaderCircle
          className="animate-spin text-primary"
          size={52}
          strokeWidth={1.5}
        />
        <h2 className="mt-5 text-xl font-bold text-slate-800">
          Uploading Document
        </h2>
        <p className="mt-2 text-xs text-slate-500">
          Uploading your document... Please keep the app open.
        </p>
        <p className="mt-8 max-w-full truncate text-xs text-slate-500">
          {selectedFile?.name}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-150"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      </section>
    );
  }

  if (submissionStatus === "submitted") {
    return (
      <section className="mt-16 flex w-full flex-col items-center text-center">
        <div className="flex size-13 items-center justify-center rounded-full border-2 border-primary text-primary">
          <Check size={28} />
        </div>
        <h2 className="mt-5 text-xl font-bold text-slate-800">
          Document Submitted
        </h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Your residency document has been submitted for verification.
          We&apos;ll notify you when there is an update.
        </p>
        <div className="mt-5 w-full rounded-lg bg-primary/10 px-3 py-3 text-left text-xs leading-5 text-primary">
          <p className="flex items-center gap-2 font-semibold">
            <Clock3 size={15} />
            Pending Verification
          </p>
          <p className="mt-1">
            Required checks and admin review are still pending. Submission does
            not verify or approve your account.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => navigate(PATHS.scanFace)}
          className="mt-5 h-11 w-full rounded-lg text-xs font-semibold"
        >
          Continue
        </Button>
      </section>
    );
  }

  return (
    <section className="relative mt-7 w-full">
      <h2 className="text-center text-[21px] font-bold leading-7 text-primary">
        Verify Your Residency
      </h2>
      <p className="mx-auto mt-3 max-w-90 text-center text-[13px] leading-5 text-slate-500">
        Upload an accepted document to help verify that you are a resident of
        Barangay 167.
      </p>

      <div
        onClick={handleUploadClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleUploadClick();
          }
        }}
        role="button"
        tabIndex={0}
        className="relative mt-4 cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-primary/5"
      >
        {selectedFile && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleRemoveFile();
            }}
            className="absolute right-3 top-3 rounded-full bg-white p-1.5 text-slate-500 shadow-sm hover:text-destructive"
            aria-label="Remove document"
          >
            <X size={16} />
          </button>
        )}

        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Selected document preview"
            className="mx-auto max-h-60 max-w-full rounded-md object-contain"
          />
        ) : (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {selectedFile?.type === "application/pdf" ? (
              <FileText className="text-primary" size={25} />
            ) : (
              <Upload className="text-primary" size={25} />
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
          onChange={handleFileChange}
          onClick={(event) => event.stopPropagation()}
          className="sr-only"
        />

        <p className="mt-3 text-sm font-semibold text-slate-700">
          {selectedFile ? "Document Selected" : "Upload your document"}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {selectedFile
            ? "Click here to change your document"
            : "Click here to browse or select a file"}
        </p>

        <p className="mt-3 break-all text-xs font-medium text-primary">
          {selectedFile
            ? selectedFile.name
            : "Supported formats: JPG, PNG, PDF"}
        </p>

        {selectedFile && (
          <p className="mt-1 text-[11px] text-slate-400">
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}

        {!selectedFile && (
          <p className="mt-1 text-[11px] text-slate-400">
            Maximum file size: 10MB
          </p>
        )}

        {error && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <p className="mt-4 text-[13px] leading-5 text-slate-500">
        Make sure your document is clear and all required details are readable.
      </p>
      <ul className="mt-2 w-full space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-left text-[13px] leading-4 text-slate-500">
        <p className="font-semibold mb-3 text-primary">Accepted Documents:</p>
        {ACCEPTED_DOCUMENTS.map((document) => (
          <li key={document} className="flex gap-2">
            <span className="text-primary">•</span>
            <span>{document}</span>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        onClick={handleContinue}
        disabled={!selectedFile}
        className="mt-3 h-11 w-full rounded-lg bg-primary text-xs font-semibold text-white hover:bg-primary/10 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:opacity-100"
      >
        Continue
      </Button>
    </section>
  );
}
