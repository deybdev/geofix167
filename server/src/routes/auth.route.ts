
import { Hono } from "hono";

import type { AppEnv } from "../types/env";
import {
  loginController,
  logoutController,
  mobileLoginController,
  mobileLogoutController,
  mobileRefreshController,
} from "../controllers/auth.controller";
import { meController } from "../controllers/me.controller";
import { requireAuth } from "../middleware/auth";
import { verifyRegistrationOtp } from "../controllers/resident-auth.controller";
import { registerResident } from "./resident-registration.route";
import registrationIdentityRoutes from "./registration-identity.route";
import registrationRoutes from "./resident-registration.route";

const authRoutes = new Hono<AppEnv>();
authRoutes.route("/", registrationIdentityRoutes);
authRoutes.route("/registration", registrationRoutes);

authRoutes.post("/login", loginController);
authRoutes.post("/mobile/login", mobileLoginController);
authRoutes.post("/mobile/refresh", mobileRefreshController);
authRoutes.post("/mobile/logout", mobileLogoutController);
authRoutes.post("/register", registerResident);
authRoutes.post("/otp/verify-registration", verifyRegistrationOtp);
authRoutes.get("/me", requireAuth, meController);
authRoutes.post("/logout", logoutController);

export default authRoutes;
