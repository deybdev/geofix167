# Resident report attachments: implementation and rollout

Photos and videos now upload after the report is created. R2 stores the file bytes; D1 stores metadata. Both the full resident wizard and quick emergency flow use the same picker and upload endpoint.

## Implementation plan and exact source files

1. Reuse the existing R2 binding in `server/wrangler.jsonc` and `incident_media` table from migration `0005_guest_incidents.sql`. There is no `report_attachments` table, but its equivalent already exists. Apply `0017_report_attachments.sql` to add filenames, stable media paths, file hashes, and idempotency keys.
2. `server/src/controllers/attachment.controller.ts` implements authenticated upload and listing. `server/src/services/attachment.service.ts` validates files and signs URLs. `server/src/routes/report.route.ts` mounts these handlers and caps request bodies before multipart parsing.
3. `server/src/routes/media.route.ts`, mounted in `server/src/index.ts`, validates expiring signatures and streams R2 content, including single byte ranges for video seeking. `server/src/types/env.ts` types the signing secret.
4. `client/src/services/residentService.js` sends real `File` objects in `FormData`, leaves the multipart boundary to the browser, and loads attachment URLs with report details.
5. `client/src/features/resident/Report.jsx` saves the report first, then uploads files sequentially. It displays file-by-file progress and partial failure messages, and retries only files that have not succeeded. Each file keeps its upload UUID across retries. Camera return state preserves the form draft and converts the captured data URL into a `File`.
6. `client/src/features/resident/components/MediaPicker.jsx` provides photo/video selection, validation, previews, removal, and object URL cleanup. `ReportDetails.jsx` displays saved photos and playable videos.

## R2 configuration

This repository uses `wrangler.jsonc`, not `wrangler.toml`. Its existing configuration is sufficient:

```jsonc
"r2_buckets": [
  {
    "bucket_name": "geofix167-uploads",
    "binding": "geofix167_uploads"
  }
]
```

The equivalent TOML, if migrating the configuration format, is:

```toml
[[r2_buckets]]
binding = "geofix167_uploads"
bucket_name = "geofix167-uploads"
```

`MEDIA_BUCKET` would also be a valid binding name, but would require changing the existing TypeScript environment and all `c.env.geofix167_uploads` references. Do not add a second Wrangler config just for this feature.

R2 remains private. No public bucket domain, browser R2 credentials, S3 signing credentials, or R2 CORS rules are needed: uploads and playback go through the Worker. The existing frontend uses same-origin `/api` requests; production hosting must proxy/route `/api/*` to the Worker just as Vite does locally. This includes `/api/media/*` and its `Range` headers.

## D1 migration

The existing `incident_media` table already contains the incident foreign key, uploader, media type, unique storage key, MIME type, size, and timestamps. Migration `0017_report_attachments.sql` adds:

```sql
ALTER TABLE incident_media ADD COLUMN original_filename TEXT;
ALTER TABLE incident_media ADD COLUMN upload_key TEXT;
ALTER TABLE incident_media ADD COLUMN content_sha256 TEXT;
ALTER TABLE incident_media ADD COLUMN media_url TEXT;

CREATE UNIQUE INDEX idx_incident_media_upload_key
  ON incident_media(incident_id, upload_key);
```

New rows store `media_url` as `/api/media/<attachment-id>`. This is a durable route, not an expiring signed URL. The upload/list responses append a fresh expiry and HMAC signature. Legacy rows can keep NULL values for new columns; listing derives URLs from their attachment IDs.

## Local setup

From `server/`, generate a random secret (this command prints the newly generated value):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Add the value to your gitignored `server/.dev.vars`, preserving any existing entries:

```dotenv
MEDIA_SIGNING_SECRET=<paste-the-generated-value>
```

Then run:

```powershell
npx.cmd wrangler types
npx.cmd wrangler d1 migrations apply geofix167_db --local
npm.cmd run dev
```

In another terminal, from `client/`, run `npm.cmd run dev`. Wrangler simulates R2 locally; local mode does not require creating a cloud bucket. These commands use `.cmd` on Windows to avoid PowerShell script execution-policy restrictions.

## Production rollout

From `server/` with the intended Cloudflare account selected:

```powershell
# Only if the bucket does not already exist:
npx.cmd wrangler r2 bucket create geofix167-uploads

# Paste a separately generated random production secret at the prompt:
npx.cmd wrangler secret put MEDIA_SIGNING_SECRET

# Review pending migrations before applying: this applies all outstanding files.
npx.cmd wrangler d1 migrations list geofix167_db --remote
npx.cmd wrangler d1 migrations apply geofix167_db --remote
npm.cmd run deploy
```

Build and deploy the frontend with the project's existing hosting process after the migration and Worker deployment. The implementation does not perform these remote operations automatically. Do not put the secret in Wrangler's public `vars` or any frontend `VITE_*` variable. Rotating it invalidates existing media links.

## API contract

`POST /api/reports/:id/attachments` requires the resident's `geofix_session` cookie and ownership of the report. Send exactly one file per request:

```javascript
const body = new FormData();
body.append("file", selectedFile, selectedFile.name);
body.append("upload_id", stableUuidForThisFile);
const response = await fetch(`/api/reports/${reportId}/attachments`, {
  method: "POST", credentials: "include", body,
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
```

Success is `201`, or `200` for a matching retry, with this shape:

```json
{
  "attachment": {
    "id": "attachment-uuid",
    "media_type": "VIDEO",
    "content_type": "video/mp4",
    "byte_size": 123456,
    "original_filename": "incident.mp4",
    "created_at": "ISO timestamp",
    "url": "/api/media/attachment-uuid?expires=...&signature=...",
    "expires_at": "ISO timestamp"
  },
  "idempotent_replay": false
}
```

`GET /api/reports/:id/attachments` returns `{ "attachments": [...] }` with newly signed URLs. It uses existing report read permissions: owner, admin/BDRRMO, or an authorized assigned responder. Guest upload/list support is outside this resident flow.

`GET /api/media/:id?expires=...&signature=...` serves content for one hour without needing a cookie; the signature is the access credential. Anyone given that URL can view it until expiry. The bucket remains private. These are application-signed Worker URLs, not S3 presigned URLs. Response headers include `private, no-store`, `nosniff`, MIME type, ETag, content length, and byte-range support. `HEAD`, open-ended ranges, and suffix ranges are supported. Refresh the report to renew expired links.

## Limits and failure behavior

- At most five attachments per report, including existing media. JPEG/PNG/WebP: up to 10 MiB each. MP4/WebM/MOV: up to 25 MiB each. These are application limits, not Cloudflare platform limits.
- The multipart envelope allows an extra 64 KiB. MIME allowlisting and basic container/file signatures reject unsupported types and obvious mismatches. This is not full media decoding or malware scanning.
- Videos are size-limited; there is no hard duration limit or transcoding. Playback depends on browser codec support, especially for MOV/HEVC. Prefer MP4 with H.264/AAC for compatibility. A strict duration requirement would need a trusted media processing step.
- The report is saved before uploads, so an emergency is received even if media fails. Progress identifies the current file; it is not a byte percentage. Retry preserves successful attachments and the report ID. Pending files are held in the current page; refresh/closing it does not resume unfinished uploads.
- A unique `(incident_id, upload_key)` and content hash make retries safe, including a lost success response. Reusing a key for different content returns `409`. The final count check and insert share one SQL statement to enforce the five-file cap under concurrency.
- R2 uploads precede D1 inserts. Failed inserts and losing concurrent retries delete their temporary R2 objects. If a D1 commit succeeded despite a lost response, the referenced object is retained. There is no distributed transaction across R2 and D1: process termination or a storage outage can leave an orphan. Reconcile unreferenced R2 keys before adding long-term retention/deletion jobs. Deleting a D1 report alone does not delete R2 files.

## Verification

From the repository root, with server dependencies installed and Node 24:

```powershell
node server/tests/attachments.integration.mjs
node server/tests/report.integration.mjs
node server/tests/admin-dispatch.integration.mjs
```

The attachment suite uses real local Miniflare R2 and an in-memory SQLite adapter for D1. It checks file bytes, metadata, ownership, validation, expired/tampered signatures, range requests, replay, concurrency limits, and cleanup on simulated D1/R2 failures. Video fixtures test container validation and storage, not actual codec decoding.

From `client/`, `npm.cmd run build` checks the production bundle. Manual acceptance: submit a resident report with a photo and a short video; confirm the saved report appears before upload completion, view both files after reopening details, and simulate an upload failure to exercise Retry failed uploads. Also test a camera capture with an existing draft and multiple selected files.

References: [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Hono body limit](https://hono.dev/docs/middleware/builtin/body-limit), [D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/).
