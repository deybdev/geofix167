import { getCookie } from "hono/cookie";
import { requireAuth } from "../middleware/auth";
import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { bodyLimit } from "hono/body-limit";
import { listAttachments, uploadAttachment } from "../controllers/attachment.controller";
import { MAX_UPLOAD_BYTES } from "../services/attachment.service";
import {
  createReportController,
  updateReportStatusController, updateReportDetailsController,
  getReportByIdController,
  listReportsController,
} from "../controllers/report.controller";

const reportRoutes = new Hono<AppEnv>();

reportRoutes.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  if (getCookie(c, "geofix_session")) return requireAuth(c, next);
  await next();
});
reportRoutes.get("/public", async (c) => {
  const result = await c.env.geofix167_db.prepare(
    "SELECT community_feed_post_id AS id, title, body AS description, published_at FROM community_feed_posts WHERE published_at IS NOT NULL AND datetime(published_at) <= datetime('now') AND archived_at IS NULL ORDER BY published_at DESC LIMIT 100"
  ).all();
  return c.json({ reports: result.results, count: result.results.length });
});
reportRoutes.post("/", createReportController);
reportRoutes.get("/:id/attachments", requireAuth, listAttachments);
reportRoutes.post("/:id/attachments", requireAuth, bodyLimit({
  maxSize: MAX_UPLOAD_BYTES,
  onError: c => c.json({ error: "Upload exceeds the 25 MiB video limit." }, 413),
}), uploadAttachment);
reportRoutes.patch("/:id/status", updateReportStatusController);
reportRoutes.patch("/:id", updateReportDetailsController);
reportRoutes.get("/", listReportsController);
reportRoutes.get("/:id", getReportByIdController);

export default reportRoutes;

