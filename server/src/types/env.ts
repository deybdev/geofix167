
export type UserRole =
  | "admin"
  | "resident"
  | "tanod"
  | "bdrrmo"
  | "police"
  | "fire";

export type AuthUser = {
  id: string;
  full_name: string;
  mobile_number: string;
  role: UserRole;
};

export type AppEnv = {
  Bindings: {
    geofix167_db: D1Database;
    geofix167_uploads: R2Bucket;
    MEDIA_SIGNING_SECRET: string;
    FRONTEND_ORIGIN: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
    AUTH_HASH_SECRET?: string;
    BREVO_API_KEY: string;
    BREVO_API_URL: string;
    UNISMS_API_KEY: string;
    UNISMS_API_URL: string;
  };
  Variables: {
    user: AuthUser;
  };
};
