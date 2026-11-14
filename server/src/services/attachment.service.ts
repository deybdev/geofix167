import type { AppEnv } from "../types/env";
import { ReportError } from "./report.service";

export const MAX_ATTACHMENTS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_VIDEO_BYTES + 64 * 1024;
const URL_TTL_SECONDS = 3600;
type Database = AppEnv["Bindings"]["geofix167_db"];
export type Attachment = {
  incident_media_id: string; incident_id: string; media_type: "PHOTO" | "VIDEO";
  storage_key: string; content_type: string; byte_size: number;
  original_filename: string | null; upload_key: string | null;
  content_sha256: string | null; media_url: string | null; created_at: string;
};

const formats: Record<string, { extension: string; type: "PHOTO" | "VIDEO" }> = {
  "image/jpeg": { extension: "jpg", type: "PHOTO" },
  "image/png": { extension: "png", type: "PHOTO" },
  "image/webp": { extension: "webp", type: "PHOTO" },
  "video/mp4": { extension: "mp4", type: "VIDEO" },
  "video/webm": { extension: "webm", type: "VIDEO" },
  "video/quicktime": { extension: "mov", type: "VIDEO" },
};

export async function validateMedia(file: File) {
  const format = formats[file.type];
  if (!format) throw new ReportError("Use JPEG, PNG, WebP, MP4, WebM, or MOV files.", 415);
  const limit = format.type === "PHOTO" ? MAX_PHOTO_BYTES : MAX_VIDEO_BYTES;
  if (!file.size || file.size > limit) {
    throw new ReportError(`Files must not be empty. Photos: 10 MiB maximum; videos: 25 MiB maximum.`, 413);
  }
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const matches = {
    "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    "image/png": [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v),
    "image/webp": ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
    "video/mp4": ascii(4, 8) === "ftyp" && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |MSNV|dash)$/.test(ascii(8, 12)),
    "video/quicktime": ascii(4, 8) === "ftyp" && ascii(8, 12) === "qt  ",
    "video/webm": [0x1a, 0x45, 0xdf, 0xa3].every((v, i) => bytes[i] === v),
  }[file.type];
  if (!matches) throw new ReportError("The file contents do not match its media type.", 415);
  return format;
}

export function findUpload(db: Database, incidentId: string, uploadKey: string) {
  return db.prepare("SELECT * FROM incident_media WHERE incident_id = ? AND upload_key = ?")
    .bind(incidentId, uploadKey).first<Attachment>();
}

async function signingKey(secret: string) {
  if (!secret || secret.length < 32) throw new ReportError("Media signing is not configured.", 503);
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
const signedMessage = (id: string, expires: number) => new TextEncoder().encode(`media:v1:${id}:${expires}`);

export async function attachmentResponse(row: Attachment, secret: string) {
  const expires = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(secret), signedMessage(row.incident_media_id, expires)));
  const hex = Array.from(signature, b => b.toString(16).padStart(2, "0")).join("");
  // Relative to the API origin: works with the existing same-origin /api proxy.
  const url = `/api/media/${encodeURIComponent(row.incident_media_id)}?expires=${expires}&signature=${hex}`;
  return { id: row.incident_media_id, media_type: row.media_type, content_type: row.content_type,
    byte_size: row.byte_size, original_filename: row.original_filename, created_at: row.created_at,
    url, expires_at: new Date(expires * 1000).toISOString() };
}

export async function verifyMediaSignature(id: string, expiresText: string, signature: string, secret: string) {
  const expires = Number(expiresText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + URL_TTL_SECONDS || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const bytes = Uint8Array.from(signature.match(/../g)!, hex => parseInt(hex, 16));
  return crypto.subtle.verify("HMAC", await signingKey(secret), bytes, signedMessage(id, expires));
}
