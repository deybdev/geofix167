import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { verifyMediaSignature, type Attachment } from "../services/attachment.service";

const mediaRoutes = new Hono<AppEnv>();
mediaRoutes.get("/:id", async c => {
  c.header("Cache-Control", "private, no-store");
  if (!await verifyMediaSignature(c.req.param("id"), c.req.query("expires") ?? "", c.req.query("signature") ?? "", c.env.MEDIA_SIGNING_SECRET)) {
    return c.json({ error: "Media link is invalid or expired. Refresh the report." }, 403);
  }
  const row = await c.env.geofix167_db.prepare("SELECT * FROM incident_media WHERE incident_media_id = ?")
    .bind(c.req.param("id")).first<Attachment>();
  if (!row) return c.notFound();
  const head = await c.env.geofix167_uploads.head(row.storage_key);
  if (!head) return c.notFound();
  const headers = new Headers({ "Content-Type": row.content_type, "Content-Length": String(head.size),
    "Cache-Control": "private, no-store", "Accept-Ranges": "bytes", "ETag": head.httpEtag,
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  let range: { offset: number; length: number } | undefined;
  const rangeHeader = c.req.header("Range");
  const ifRange = c.req.header("If-Range");
  if (rangeHeader && (!ifRange || ifRange === head.httpEtag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    const start = match?.[1] ? Number(match[1]) : Math.max(0, head.size - Number(match?.[2]));
    const end = match?.[1] && match[2] ? Math.min(Number(match[2]), head.size - 1) : head.size - 1;
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= head.size || end < start) {
      headers.set("Content-Range", `bytes */${head.size}`);
      headers.delete("Content-Length");
      return new Response(null, { status: 416, headers });
    }
    range = { offset: start, length: end - start + 1 };
    headers.set("Content-Range", `bytes ${start}-${end}/${head.size}`);
    headers.set("Content-Length", String(range.length));
  }
  if (c.req.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
  const object = await c.env.geofix167_uploads.get(row.storage_key, range ? { range } : undefined);
  if (!object) return c.notFound();
  return new Response(object.body, { status: range ? 206 : 200, headers });
});
export default mediaRoutes;
