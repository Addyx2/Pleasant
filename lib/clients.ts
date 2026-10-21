import { isBankHoliday, isWeekend } from "./payroll/bank-holidays";

// Clients are the organisations an agency supplies workers to and invoices:
// care homes, nursing homes and domiciliary care providers.

export const CLIENT_TYPES = [
  "CARE_HOME",
  "NURSING_HOME",
  "DOMICILIARY_PROVIDER",
  "SUPPORTED_LIVING",
  "NHS",
  "LOCAL_AUTHORITY",
  "OTHER",
] as const;

export type ClientTypeKey = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientTypeKey, string> = {
  CARE_HOME: "Care home",
  NURSING_HOME: "Nursing home",
  DOMICILIARY_PROVIDER: "Domiciliary care provider",
  SUPPORTED_LIVING: "Supported living",
  NHS: "NHS trust",
  LOCAL_AUTHORITY: "Local authority",
  OTHER: "Other",
};

// ClientStatus values predate clients being organisations; label them for B2B.
export const CLIENT_STATUS: Record<string, { label: string; tone: "green" | "amber" | "slate" }> = {
  ACTIVE: { label: "Active", tone: "green" },
  PAUSED: { label: "On hold", tone: "amber" },
  DISCHARGED: { label: "Former", tone: "slate" },
};

/** What a client calls its sites: wards/units in a home, branches for dom care. */
export function siteNoun(type: string, plural = false): string {
  const branch = type === "DOMICILIARY_PROVIDER" || type === "LOCAL_AUTHORITY";
  if (branch) return plural ? "branches" : "branch";
  return plural ? "units" : "unit";
}

export interface NamedClient {
  name?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/** Display name for a client, tolerating rows not yet backfilled. */
export function clientName(client: NamedClient | null | undefined, fallback = "No client"): string {
  if (!client) return fallback;
  const legacyPerson = [client.firstName, client.lastName].filter(Boolean).join(" ");
  return client.name?.trim() || client.companyName?.trim() || legacyPerson || "Unnamed client";
}

/** Prisma select covering everything clientName() reads. */
export const CLIENT_NAME_SELECT = {
  name: true,
  companyName: true,
  firstName: true,
  lastName: true,
} as const;

// ---------------------------------------------------------------------------
// Rate card

export interface RateCardEntry {
  role: string;
  siteId: string | null;
  dayRate: number;
  nightRate: number | null;
  weekendRate: number | null;
  bankHolidayRate: number | null;
  sleepInCharge: number | null;
}

export type RateBand = "DAY" | "NIGHT" | "WEEKEND" | "BANK_HOLIDAY";

export interface ResolvedRate {
  rate: number;
  band: RateBand;
  entry: RateCardEntry;
}

const normaliseRole = (role: string) => role.trim().toLowerCase().replace(/\s+/g, " ");

/** The rate-card line for a role, preferring a site-specific line over the client-wide one. */
export function findRate(
  rates: RateCardEntry[],
  role: string,
  siteId: string | null | undefined,
): RateCardEntry | null {
  const wanted = normaliseRole(role);
  const forRole = rates.filter((r) => normaliseRole(r.role) === wanted);
  return (siteId ? forRole.find((r) => r.siteId === siteId) : undefined) ?? forRole.find((r) => !r.siteId) ?? null;
}

/**
 * Band a shift falls into for charging: whichever of bank holiday, weekend,
 * night (20:00–06:00) or day covers most of its minutes, with the same
 * precedence the payroll engine uses for pay premiums.
 */
export function shiftRateBand(startAt: Date, endAt: Date): RateBand {
  const totals = { DAY: 0, NIGHT: 0, WEEKEND: 0, BANK_HOLIDAY: 0 };
  const cursor = new Date(startAt);
  // Sample every 5 minutes: precise enough to pick a majority band.
  while (cursor < endAt) {
    const hour = cursor.getHours();
    if (isBankHoliday(cursor)) totals.BANK_HOLIDAY += 1;
    else if (isWeekend(cursor)) totals.WEEKEND += 1;
    else if (hour >= 20 || hour < 6) totals.NIGHT += 1;
    else totals.DAY += 1;
    cursor.setMinutes(cursor.getMinutes() + 5);
  }
  const order = ["BANK_HOLIDAY", "WEEKEND", "NIGHT", "DAY"] as const;
  return order.reduce((best, band) => (totals[band] > totals[best] ? band : best), "DAY" as (typeof order)[number]);
}

export function resolveChargeRate(
  rates: RateCardEntry[],
  shift: { role: string; siteId?: string | null; startAt: Date; endAt: Date },
): ResolvedRate | null {
  // Sleep-ins are billed flat (see resolveSleepInCharge), not hourly.
  const entry = findRate(rates, shift.role, shift.siteId);
  if (!entry) return null;
  const band = shiftRateBand(shift.startAt, shift.endAt);
  const rate =
    band === "BANK_HOLIDAY"
      ? (entry.bankHolidayRate ?? entry.weekendRate ?? entry.dayRate)
      : band === "WEEKEND"
        ? (entry.weekendRate ?? entry.dayRate)
        : band === "NIGHT"
          ? (entry.nightRate ?? entry.dayRate)
          : entry.dayRate;
  return { rate, band, entry };
}

/**
 * Flat client charge for a sleep-in in this role, if the card sets one. A
 * unit-specific line without one falls back to the client-wide line.
 */
export function resolveSleepInCharge(
  rates: RateCardEntry[],
  shift: { role: string; siteId?: string | null },
): number | null {
  return (
    findRate(rates, shift.role, shift.siteId)?.sleepInCharge ?? findRate(rates, shift.role, null)?.sleepInCharge ?? null
  );
}

export function toRateCardEntry(row: {
  role: string;
  siteId: string | null;
  dayRate: { toString(): string };
  nightRate: { toString(): string } | null;
  weekendRate: { toString(): string } | null;
  bankHolidayRate: { toString(): string } | null;
  sleepInCharge: { toString(): string } | null;
}): RateCardEntry {
  const n = (v: { toString(): string } | null) => (v == null ? null : Number(v.toString()));
  return {
    role: row.role,
    siteId: row.siteId,
    dayRate: Number(row.dayRate.toString()),
    nightRate: n(row.nightRate),
    weekendRate: n(row.weekendRate),
    bankHolidayRate: n(row.bankHolidayRate),
    sleepInCharge: n(row.sleepInCharge),
  };
}
