import { prisma } from "./db";

// Carers say when they can't work, and no shift is assigned or offered to
// them then: the "conflict shield". Days are UK calendar days.

export interface UnavailabilityRule {
  startsOn: Date;
  endsOn: Date;
  /** 1 = Monday … 7 = Sunday; null for every day in the range. */
  weekday: number | null;
  reason: string | null;
}

const ukDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });
const ukWeekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export { WEEKDAY_NAMES } from "./availability-names";

/** "2026-11-03" for the UK day a moment falls on. */
export function ukDate(at: Date): string {
  return ukDay.format(at);
}

/** "2026-11-03" for a @db.Date value (stored as midnight UTC). */
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The UK days a shift touches, with their weekday (1 = Monday). */
function shiftDays(startAt: Date, endAt: Date): { date: string; weekday: number }[] {
  const days = new Map<string, number>();
  // Step hourly so a shift ending just after midnight counts its second day.
  for (let t = startAt.getTime(); t < endAt.getTime(); t += 3_600_000) {
    const at = new Date(t);
    days.set(ukDate(at), WEEKDAYS.indexOf(ukWeekday.format(at)) + 1);
  }
  const last = new Date(endAt.getTime() - 1);
  days.set(ukDate(last), WEEKDAYS.indexOf(ukWeekday.format(last)) + 1);
  return [...days].map(([date, weekday]) => ({ date, weekday }));
}

/** The first rule a shift falls in, and on which day, or null if it's clear. */
export function clashingRule<R extends UnavailabilityRule>(rules: R[], startAt: Date, endAt: Date): { rule: R; date: string } | null {
  for (const day of shiftDays(startAt, endAt)) {
    for (const rule of rules) {
      if (day.date < dateOnly(rule.startsOn) || day.date > dateOnly(rule.endsOn)) continue;
      if (rule.weekday !== null && rule.weekday !== day.weekday) continue;
      return { rule, date: day.date };
    }
  }
  return null;
}

function describe(name: string, clash: { rule: UnavailabilityRule; date: string }): string {
  const when = new Date(`${clash.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${name} said they can't work on ${when}${clash.rule.reason ? ` (${clash.rule.reason})` : ""}.`;
}

/**
 * Why this carer can't take this shift because of their availability, or
 * null if they can. Used everywhere a shift is assigned or offered.
 */
export async function unavailableReason(agencyId: string, staffId: string, startAt: Date, endAt: Date): Promise<string | null> {
  const rules = await prisma.staffUnavailability.findMany({
    where: { agencyId, staffId, startsOn: { lte: new Date(`${ukDate(endAt)}T00:00:00Z`) }, endsOn: { gte: new Date(`${ukDate(startAt)}T00:00:00Z`) } },
  });
  const clash = clashingRule(rules, startAt, endAt);
  if (!clash) return null;
  const staff = await prisma.staffProfile.findUnique({ where: { id: staffId }, select: { firstName: true, lastName: true } });
  return describe(staff ? `${staff.firstName} ${staff.lastName ?? ""}`.trim() : "This carer", clash);
}
