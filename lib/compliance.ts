export type ExpiryState = "EXPIRED" | "DUE_SOON" | "OK" | "MISSING";

export type ExpirySubject = {
  staffId: string;
  staffName: string;
  jobTitle: string | null;
  item: string;
  kind: "DBS" | "RIGHT_TO_WORK" | "TRAINING";
  expiryDate: Date | null;
  detail: string | null;
};

export const DUE_SOON_DAYS = 60;

export function daysUntil(date: Date, now: Date = new Date()): number {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.ceil((startOfDay(date) - startOfDay(now)) / 86_400_000);
}

export function expiryState(
  expiryDate: Date | null,
  now: Date = new Date(),
  dueSoonDays: number = DUE_SOON_DAYS,
): ExpiryState {
  if (!expiryDate) return "MISSING";
  const days = daysUntil(expiryDate, now);
  if (days < 0) return "EXPIRED";
  if (days <= dueSoonDays) return "DUE_SOON";
  return "OK";
}

export function expiryLabel(expiryDate: Date | null, now: Date = new Date()): string {
  if (!expiryDate) return "Not recorded";
  const days = daysUntil(expiryDate, now);
  if (days < 0) {
    const overdue = Math.abs(days);
    return `Expired ${overdue} day${overdue === 1 ? "" : "s"} ago`;
  }
  if (days === 0) return "Expires today";
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

export function severityRank(state: ExpiryState): number {
  switch (state) {
    case "EXPIRED":
      return 0;
    case "MISSING":
      return 1;
    case "DUE_SOON":
      return 2;
    default:
      return 3;
  }
}

export function sortByUrgency<T extends { state: ExpiryState; days: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const rank = severityRank(a.state) - severityRank(b.state);
    if (rank !== 0) return rank;
    const left = a.days ?? Number.MAX_SAFE_INTEGER;
    const right = b.days ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
}

/**
 * What stops a carer being placed: missing or expired DBS, and right to work
 * that's missing, unverified or expired. Empty means clear. Used by Assist
 * and Pushbots alike, so both apply the same gate.
 */
export function complianceGaps(
  s: { dbsNumber: string | null; dbsExpiry: Date | null; rightToWork: { status: string; expiryDate: Date | null } | null },
  now: Date = new Date(),
): string[] {
  const gaps: string[] = [];
  if (!s.dbsNumber) gaps.push("no DBS certificate on file");
  else if (expiryState(s.dbsExpiry, now) === "EXPIRED") gaps.push("DBS certificate has expired");
  if (!s.rightToWork) gaps.push("no right-to-work check recorded");
  else if (s.rightToWork.status !== "VERIFIED") gaps.push("right to work not yet verified");
  else if (s.rightToWork.expiryDate && expiryState(s.rightToWork.expiryDate, now) === "EXPIRED") gaps.push("right to work has expired");
  return gaps;
}
