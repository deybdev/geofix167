
export type UserRole = "admin" | "responder" | "resident";

export type AuthUser = {
  id: number;
  public_id: string;
  full_name: string;
  email: string;
  role: UserRole;
};

export type AppEnv = {
  Bindings: {
    geofix167_db: D1Database;
    FRONTEND_ORIGIN: string;
  };
  Variables: {
    user: AuthUser;
  };
};
