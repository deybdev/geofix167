
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./types/env";
import authRoutes from "./routes/auth.route";
import communicationRoutes from "./routes/communication.route";
import reportRoutes from "./routes/report.route";
import mediaRoutes from "./routes/media.route";
import adminDispatchRoutes from "./routes/admin-dispatch.route";
import registrationReviewRoutes from "./routes/registration-review.route";
import adminMaintenanceRoutes from "./routes/admin-maintenance.route";
import notificationRoutes from "./routes/notification.route";
import announcementRoutes, { publicAnnouncementRoutes } from "./routes/announcement.route";
import responderMessagesRoutes from "./routes/responder-messages.route";
import responderDispatchesRoutes from "./routes/responder-dispatches.route";
import trackingRoutes from "./routes/tracking.route";
import responderLocationRoutes from "./routes/responder-location.route";

const app = new Hono<AppEnv>();

app.get("/", (c) => c.redirect("/cdn-cgi/local/explorer/"));

app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      return origin === c.env.FRONTEND_ORIGIN
        ? origin
        : "";
    },
    credentials: true,
    allowMethods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Guest-Token", "X-Registration-Token", "Range", "If-Range"],
  }),
);

// Authentication routes:
// POST /api/auth/login
// GET  /api/auth/me
// POST /api/auth/logout
app.route("/api/auth", authRoutes);
app.route("/api/communication", communicationRoutes);
app.route("/api/responder/messages", responderMessagesRoutes);
app.route("/api/responder/dispatches", responderDispatchesRoutes);
app.route("/api/responder/location", responderLocationRoutes);
app.route("/api/track", trackingRoutes);

// Incident report routes:
// POST /api/reports
// GET  /api/reports
// GET  /api/reports/:id
app.route("/api/reports", reportRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/admin/dispatch", adminDispatchRoutes);
app.route("/api/admin/maintenance", adminMaintenanceRoutes);
app.route("/api/admin/registrations", registrationReviewRoutes);
app.route("/api/admin/announcements", announcementRoutes);
app.route("/api/announcements", publicAnnouncementRoutes);

export default app;
