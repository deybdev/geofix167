
import type { Context } from "hono";
import type { AppEnv } from "../types/env";

export function meController(c: Context<AppEnv>) {
  const user = c.get("user");

  return c.json({
    user: {
      id: user.public_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  });
}
