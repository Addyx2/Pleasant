import { prisma } from "@/lib/db";
import { BUILT_IN_BANK_HOLIDAYS } from "@/lib/payroll/bank-holidays";

export const DIVISIONS = {
  "england-and-wales": "England and Wales",
  scotland: "Scotland",
  "northern-ireland": "Northern Ireland",
} as const;
export type Division = keyof typeof DIVISIONS;

export function isDivision(value: unknown): value is Division {
  return typeof value === "string" && value in DIVISIONS;
}

const FEED_URL = () => process.env.BANK_HOLIDAYS_URL ?? "https://www.gov.uk/bank-holidays.json";

export interface FeedHoliday {
  division: Division;
  date: string;
  title: string;
}

/** Reads GOV.UK's bank-holidays.json, keeping only well-formed events. */
export function parseFeed(json: unknown): FeedHoliday[] {
  if (!json || typeof json !== "object") return [];
  const out: FeedHoliday[] = [];
  for (const division of Object.keys(DIVISIONS) as Division[]) {
    const events = (json as Record<string, { events?: unknown }>)[division]?.events;
    if (!Array.isArray(events)) continue;
    for (const e of events) {
      if (e && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.title === "string") {
        out.push({ division, date: e.date, title: e.title.slice(0, 120) });
      }
    }
  }
  return out;
}

/** Fetches the GOV.UK feed and stores it. Returns how many dates were stored. */
export async function refreshBankHolidays(): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const res = await fetch(FEED_URL(), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, count: 0, error: `GOV.UK answered ${res.status}` };
    const holidays = parseFeed(await res.json());
    if (holidays.length === 0) return { ok: false, count: 0, error: "The GOV.UK feed had no bank holidays in it" };
    await prisma.$transaction([
      prisma.bankHoliday.deleteMany({}),
      prisma.bankHoliday.createMany({ data: holidays, skipDuplicates: true }),
    ]);
    await prisma.systemHeartbeat.upsert({
      where: { key: "bank-holidays" },
      create: { key: "bank-holidays", at: new Date(), detail: `${holidays.length} dates` },
      update: { at: new Date(), detail: `${holidays.length} dates` },
    });
    return { ok: true, count: holidays.length };
  } catch (error) {
    return { ok: false, count: 0, error: error instanceof Error ? error.message : "Couldn't reach GOV.UK" };
  }
}

/**
 * The bank holidays for a nation as "YYYY-MM-DD" dates: the GOV.UK feed when
 * it has been fetched, plus the built-in England and Wales list as a fallback.
 */
export async function getBankHolidays(division: string): Promise<Set<string>> {
  const rows = await prisma.bankHoliday.findMany({ where: { division }, select: { date: true } }).catch(() => []);
  if (rows.length > 0) return new Set(rows.map((r) => r.date));
  return new Set(BUILT_IN_BANK_HOLIDAYS);
}

/** Bank holidays for an agency's nation. */
export async function agencyBankHolidays(agencyId: string): Promise<Set<string>> {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { bankHolidayDivision: true } });
  return getBankHolidays(agency?.bankHolidayDivision ?? "england-and-wales");
}
