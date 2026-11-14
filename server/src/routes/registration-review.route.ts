import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types/env";
import { requireAuth, requireRole } from "../middleware/auth";
import { assertOrigin, deliverNotification, sourceThrottle } from "../services/registration-security";

const route = new Hono<AppEnv>();
route.use("*", requireAuth, requireRole("admin"));
route.use("*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  if (c.req.method !== "GET") assertOrigin(c);
  await next();
});
route.get("/", async c => {
  const result = await c.env.geofix167_db.prepare(`SELECT q.request_id, q.date_of_birth, q.document_type, q.document_uploaded_at,
    u.first_name, u.last_name, u.mobile_number, u.email, v.status, v.review_reason, v.submitted_at,
    (SELECT status FROM auth_notifications n WHERE n.user_id = u.user_id ORDER BY created_at DESC LIMIT 1) AS email_status
    FROM registration_requests q JOIN users u ON u.user_id = q.user_id JOIN resident_verifications v ON v.verification_id = q.verification_id
    ORDER BY CASE WHEN v.status IN ('PENDING', 'NEEDS_CORRECTION') THEN 0 ELSE 1 END, v.submitted_at DESC LIMIT 200`).all();
  return c.json({ requests: result.results });
});
route.get("/:id/document", async c => {
  const request = await c.env.geofix167_db.prepare("SELECT document_key, document_type FROM registration_requests WHERE request_id = ?").bind(c.req.param("id")).first<{ document_key: string; document_type: string }>();
  if (!request?.document_key) return c.json({ error: "Document not available." }, 404);
  const object = await c.env.geofix167_uploads.get(request.document_key);
  if (!object) return c.json({ error: "Document not available." }, 404);
  c.header("Content-Type", request.document_type);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Content-Security-Policy", "sandbox");
  c.header("Content-Disposition", `attachment; filename="registration-id.${request.document_type === "application/pdf" ? "pdf" : request.document_type === "image/png" ? "png" : "jpg"}"`);
  return c.body(object.body);
});
route.post("/:id/review", async c => {
  const parsed = z.object({ decision: z.enum(["APPROVED", "REJECTED", "NEEDS_CORRECTION"]), reason: z.string().trim().max(500).default("") })
    .refine(v => v.decision === "APPROVED" || v.reason.length > 0).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Select a decision and provide a reason for rejection or correction." }, 400);
  const request = await c.env.geofix167_db.prepare("SELECT * FROM registration_requests WHERE request_id = ?").bind(c.req.param("id")).first<{ user_id: string; verification_id: string; document_key: string | null }>();
  if (!request?.document_key) return c.json({ error: "A submitted ID is required before review." }, 409);
  const { decision, reason } = parsed.data;
  const now = new Date().toISOString();
  const operationId = crypto.randomUUID();
  const notificationId = crypto.randomUUID();
  const message = decision === "APPROVED" ? "Your GeoFix registration is approved. You can now sign in."
    : decision === "NEEDS_CORRECTION" ? `Additional information is needed: ${reason}. Return to registration and verify your email or continue with Google to upload your document.`
    : `We could not approve your registration: ${reason}. Please contact the Barangay Front Desk for assistance.`;
  // Conditional writes ensure an already-reviewed request cannot be activated
  // twice or overwritten by a concurrent reviewer.
  const result = await c.env.geofix167_db.batch([
    c.env.geofix167_db.prepare(`UPDATE resident_verifications SET status = ?, review_reason = ?, reviewed_at = ?, reviewed_by_user_id = ?, review_operation_id = ?
      WHERE verification_id = ? AND status = 'PENDING'`).bind(decision, reason || null, now, c.get("user").id, operationId, request.verification_id),
    c.env.geofix167_db.prepare(`UPDATE users SET account_status_id = ?, approved_verification_id = ?, updated_at = ? WHERE user_id = ? AND email_verified_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM resident_verifications WHERE verification_id = ? AND review_operation_id = ? AND status = ?)`)
      .bind(decision === "APPROVED" ? 1 : 2, decision === "APPROVED" ? request.verification_id : null, now, request.user_id, request.verification_id, operationId, decision),
    c.env.geofix167_db.prepare(`UPDATE user_sessions_and_devices SET revoked_at = ?
      WHERE user_id = ? AND ? != 'APPROVED' AND revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM resident_verifications WHERE verification_id = ? AND review_operation_id = ? AND status = ?)`)
      .bind(now, request.user_id, decision, request.verification_id, operationId, decision),
    c.env.geofix167_db.prepare(`INSERT INTO auth_audit_events (auth_audit_event_id, user_id, action, outcome)
      SELECT ?, user_id, 'REGISTRATION_REVIEW', ? FROM resident_verifications WHERE verification_id = ? AND review_operation_id = ?`)
      .bind(crypto.randomUUID(), decision, request.verification_id, operationId),
    c.env.geofix167_db.prepare(`INSERT INTO auth_notifications (notification_id, user_id, subject, message)
      SELECT ?, user_id, 'GeoFix registration update', ? FROM resident_verifications WHERE verification_id = ? AND review_operation_id = ?`)
      .bind(notificationId, message, request.verification_id, operationId),
  ]);
  if (!result[0]?.meta.changes) return c.json({ error: "This request is no longer awaiting review." }, 409);
  c.executionCtx.waitUntil(deliverNotification(c, notificationId));
  return c.json({ status: decision });
});
route.post("/:id/retry-email", async c => {
  await sourceThrottle(c, "retry-email", 10);
  const pending = await c.env.geofix167_db.prepare(`SELECT n.notification_id FROM auth_notifications n JOIN registration_requests q ON q.user_id = n.user_id
    WHERE q.request_id = ? AND n.status IN ('FAILED', 'PENDING') ORDER BY n.created_at DESC LIMIT 10`).bind(c.req.param("id")).all<{ notification_id: string }>();
  for (const n of pending.results) await deliverNotification(c, n.notification_id);
  return c.json({ ok: true });
});
export default route;
