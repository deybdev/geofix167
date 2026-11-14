
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./types/env";
import authRoutes from "./routes/auth.route";
import communicationRoutes from "./routes/communication.route";
import reportRoutes from "./routes/report.route";
import mediaRoutes from "./routes/media.route";
import adminDispatchRoutes from "./routes/admin-dispatch.route";

const app = new Hono<AppEnv>();

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
    allowHeaders: ["Content-Type", "X-Guest-Token", "Range", "If-Range"],
  }),
);

// Authentication routes:
// POST /api/auth/login
// GET  /api/auth/me
// POST /api/auth/logout
app.route("/api/auth", authRoutes);
app.route("/api/communication", communicationRoutes);

// Incident report routes:
// POST /api/reports
// GET  /api/reports
// GET  /api/reports/:id
app.route("/api/reports", reportRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/admin/dispatch", adminDispatchRoutes);

export default app;
