
import type { Context } from "hono";
import { z } from "zod";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "hono/cookie";

import type { AppEnv, UserRole } from "../types/env";
import { assertOrigin, sourceThrottle, throttle } from "../services/registration-security";
import {
  AuthError,
  createMobileSession,
  hashToken,
  login,
  logout,
} from "../services/auth.service";
import {
  deleteSession,
  findUserBySession,
} from "../repositories/session.repository";
import { loginSchema } from "../validators/auth.schema";

const MOBILE_ALLOWED_ROLES: readonly UserRole[] = [
  "resident",
  "tanod",
  "bdrrmo",
  "police",
  "fire",
];

export async function loginController(c: Context<AppEnv>) {
  return handleLoginRequest(c, "web");
}

// The mobile app is exclusive to residents and responders. Admin accounts
// continue to use the web client.
export async function mobileLoginController(c: Context<AppEnv>) {
  return handleLoginRequest(c, "mobile", MOBILE_ALLOWED_ROLES);
}

async function handleLoginRequest(
  c: Context<AppEnv>,
  client: "web" | "mobile",
  allowedRoles?: readonly UserRole[],
) {
  assertOrigin(c);
  await sourceThrottle(c, "login", 60);
  const startedAt = Date.now();
  const body = await c.req.json().catch(() => null);
  const validation = loginSchema.safeParse(body);

  if (!validation.success) {
    console.warn(`[auth] login rejected client=${client} — invalid payload`);
    return c.json(
      { error: "Please provide a valid mobile number and password." },
      400,
    );
  }

  const masked = maskMobileNumber(validation.data.mobile_number);
  console.log(`[auth] login attempt client=${client} mobile=${masked}`);

  await throttle(c, "login:mobile", validation.data.mobile_number, 10, 900);

  try {
    const result = await login(
      c.env.geofix167_db,
      validation.data.mobile_number,
      validation.data.password,
      allowedRoles,
    );

    console.log(
      `[auth] login success client=${client} mobile=${masked} role=${result.user.role} userId=${result.user.id} duration=${Date.now() - startedAt}ms`,
    );

    setCookie(c, "geofix_session", result.token, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/",
      expires: result.expiresAt,
    });

    // Native clients can't use HttpOnly cookies — also return bearer tokens.
    const refreshToken = await createMobileSession(
      c.env.geofix167_db,
      result.user.id,
      30,
    );

    return c.json({
      access_token: result.token,
      refresh_token: refreshToken,
      user: {
        id: result.user.id,
        full_name: result.user.full_name,
        mobile_number: result.user.mobile_number,
        role: result.user.role,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.warn(
        `[auth] login rejected client=${client} mobile=${masked} status=${error.status} reason="${error.message}" duration=${Date.now() - startedAt}ms`,
      );
      return c.json({ error: error.message }, error.status as 401 | 403);
    }

    console.error("Login failed:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}

function maskMobileNumber(mobileNumber: string): string {
  const digits = mobileNumber.replace(/\D/g, "");

  if (digits.length < 6) return "***";

  return `${digits.slice(0, 4)}*****${digits.slice(-2)}`;
}

export async function logoutController(c: Context<AppEnv>) {
  assertOrigin(c);
  try {
    const token = getCookie(c, "geofix_session");

    await logout(c.env.geofix167_db, token);

    deleteCookie(c, "geofix_session", {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/",
    });

    for (const kind of ["identity", "email", "oauth"]) {
      const value = getCookie(c, `geofix_${kind}`);
      if (value) {
        const { hash } = await import("../services/registration-security");
        await c.env.geofix167_db.prepare("DELETE FROM auth_flows WHERE token_hash = ?").bind(await hash(value)).run();
      }
      deleteCookie(c, `geofix_${kind}`, { path: "/" });
    }

    return c.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Logout failed:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}


const refreshSchema = z.object({
  refresh_token: z.string().min(20),
});

export async function mobileRefreshController(c: Context<AppEnv>) {
  await sourceThrottle(c, "mobile-refresh", 30);

  const body = await c.req.json().catch(() => null);
  const validation = refreshSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: "A valid refresh token is required." }, 400);
  }

  try {
    const tokenHash = await hashToken(validation.data.refresh_token);
    const user = await findUserBySession(c.env.geofix167_db, tokenHash);

    if (!user) {
      return c.json({ error: "Session expired. Please sign in again." }, 401);
    }

    const accessToken = await createMobileSession(c.env.geofix167_db, user.id, 7);

    console.log(`[auth] mobile session refreshed userId=${user.id}`);

    return c.json({
      access_token: accessToken,
      refresh_token: validation.data.refresh_token,
      user,
    });
  } catch (error) {
    console.error("Mobile session refresh failed:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}

export async function mobileLogoutController(c: Context<AppEnv>) {
  const authHeader = c.req.header("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const body = await c.req.json().catch(() => null);
  const refreshToken = body?.refresh_token;

  try {
    if (accessToken) {
      await deleteSession(c.env.geofix167_db, await hashToken(accessToken));
    }

    if (typeof refreshToken === "string" && refreshToken.length >= 20) {
      await deleteSession(c.env.geofix167_db, await hashToken(refreshToken));
    }

    console.log(`[auth] mobile logout (access token: ${accessToken ? "revoked" : "absent"})`);

    return c.json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("Mobile logout failed:", error);
    return c.json({ error: "An internal server error occurred." }, 500);
  }
}
