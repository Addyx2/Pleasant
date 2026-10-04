export const SESSION_COOKIE = "pleasant_session";
export const APP_NAME = "Pleasant";

export interface SessionTokenPayload {
  userId: string;
  agencyId: string;
  role: "ADMIN" | "STAFF";
  staffId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  agencyName: string;
  roundingMins?: number | null;
  cutoffWeekday?: string | null;
  cutoffTime?: string | null;
  payWeekday?: string | null;
}
