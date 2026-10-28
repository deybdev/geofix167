
import { Hono } from "hono";

import type { AppEnv } from "../types/env";
import {
  loginController,
  logoutController,
} from "../controllers/auth.controller";
import { meController } from "../controllers/me.controller";
import { requireAuth } from "../middleware/auth";

const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", loginController);
authRoutes.get("/me", requireAuth, meController);
authRoutes.post("/logout", logoutController);

export default authRoutes;
