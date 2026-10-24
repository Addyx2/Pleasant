export const SESSION_COOKIE = "pleasant_session";
export const APP_NAME = "Pleasant";

// Demo affordances (pre-filled credentials on the sign-in page). On in local
// development; in production only when explicitly enabled for a demo deploy.
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.NODE_ENV !== "production";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
