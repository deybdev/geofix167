
export type UserRole = "admin" | "responder" | "resident";

export type AuthUser = {
  id: number;
  public_id: string;
  full_name: string;
  mobile_number: string;
  role: UserRole;
};

export type AppEnv = {
  Bindings: {
    geofix167_db: D1Database;
    FRONTEND_ORIGIN: string;
    BREVO_API_KEY: string;
    BREVO_API_URL: string;
    UNISMS_API_KEY: string;
    UNISMS_API_URL: string;
  };
  Variables: {
    user: AuthUser;
  };
};
