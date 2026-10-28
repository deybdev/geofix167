
import bcrypt from "bcryptjs";
import type { AppEnv, AuthUser } from "../types/env";
import {
  findUserByEmail,
  type UserRecord,
} from "../repositories/user.repository";
import {
  createSession,
  deleteSession,
} from "../repositories/session.repository";

type Database = AppEnv["Bindings"]["geofix167_db"];

type LoginResult = {
  token: string;
  expiresAt: Date;
  user: AuthUser;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function login(
  db: Database,
  email: string,
  password: string,
): Promise<LoginResult> {
  const user: UserRecord | null = await findUserByEmail(db, email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AuthError("Invalid email or password.", 401);
  }

  if (user.is_verified !== 1) {
    throw new AuthError(
      "Your account has not been verified.",
      403,
    );
  }

  const token = createToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  );

  await createSession(db, user.id, tokenHash, expiresAt);

  return {
    token,
    expiresAt,
    user: {
      id: user.id,
      public_id: user.public_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function logout(
  db: Database,
  token: string | undefined,
): Promise<void> {
  if (!token) return;

  await deleteSession(db, await hashToken(token));
}
