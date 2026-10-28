
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";

import type { AppEnv, UserRole } from "../types/env";
import { findUserBySession } from "../repositories/session.repository";

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export const requireAuth = createMiddleware<AppEnv>(
  async (c, next) => {
    const token = getCookie(c, "geofix_session");

    if (!token) {
      return c.json({ error: "Authentication required." }, 401);
    }

    try {
      const tokenHash = await hashToken(token);
      const user = await findUserBySession(
        c.env.geofix167_db,
        tokenHash,
      );

      if (!user) {
        return c.json(
          { error: "Session expired or invalid." },
          401,
        );
      }

      c.set("user", user);
      await next();
    } catch (error) {
      console.error("Session verification failed:", error);
      return c.json(
        { error: "Unable to verify your session." },
        500,
      );
    }
  },
);

export function requireRole(...allowedRoles: UserRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Authentication required." }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: "You do not have permission." }, 403);
    }

    await next();
  });
}
