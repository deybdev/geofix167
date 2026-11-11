
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./types/env";
import authRoutes from "./routes/auth.route";
import communicationRoutes from "./routes/communication.route";
import reportRoutes from "./routes/report.route";

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
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
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

export default app;
