
import type { Context } from "hono";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "hono/cookie";

import type { AppEnv } from "../types/env";
import { loginSchema } from "../validators/auth.schema";
import {
  AuthError,
  login,
  logout,
} from "../services/auth.service";

export async function loginController(c: Context<AppEnv>) {
  const body = await c.req.json().catch(() => null);
  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    return c.json(
      { error: "Please provide a valid email and password." },
      400,
    );
  }

  try {
    const result = await login(
      c.env.geofix167_db,
      validation.data.email,
      validation.data.password,
    );

    setCookie(c, "geofix_session", result.token, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/",
      expires: result.expiresAt,
    });

    return c.json({
      user: {
        id: result.user.public_id,
        full_name: result.user.full_name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, error.status as 401 | 403);
    }

    console.error("Login failed:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}

export async function logoutController(c: Context<AppEnv>) {
  try {
    const token = getCookie(c, "geofix_session");

    await logout(c.env.geofix167_db, token);

    deleteCookie(c, "geofix_session", {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/",
    });

    return c.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout failed:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}
