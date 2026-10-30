import { addDays, startOfWeek } from "date-fns";

import { unavailableReason } from "@/lib/availability";
import { complianceGaps } from "@/lib/compliance";
import { prisma } from "@/lib/db";

// Who Pushbots may offer a shift to, and in what order. A carer is ruled out
// by any one of: not active, wrong role, a compliance gap, already booked
// then, less than 11 hours' rest either side (Working Time Regulations 1998),
// having said they can't work then, or already having been offered it. The
// rest are ordered by how reliably they answer offers, then by who has the
// fewest hours booked that week, so work is shared fairly.

export const MIN_REST_HOURS = 11;
const HOUR = 3_600_000;

export interface ShiftToFill {
  startAt: Date;
  endAt: Date;
  role: string;
}

export interface CandidateFacts {
  staffId: string;
  name: string;
  jobTitle: string;
  hasPhone: boolean;
  optedOut: boolean;
  complianceGaps: string[];
  /** Their other live shifts near this one. */
  nearby: { startAt: Date; endAt: Date }[];
  unavailable: string | null;
  alreadyOffered: boolean;
  /** Offers in the last 90 days, and how many they answered and took. */
  offers: { sent: number; answered: number; accepted: number };
  /** Hours already booked in the week of this shift. */
  weekHours: number;
}

export interface Ranked {
  staffId: string;
  name: string;
  /** Can be texted: has a mobile and hasn't opted out. Otherwise the offer is in the app only. */
  textable: boolean;
  reliability: number | null;
  weekHours: number;
  why: string;
}

export interface Excluded {
  staffId: string;
  name: string;
  reason: string;
}

/** Why this carer can't be offered the shift, or null if they can. */
export function ruledOut(shift: ShiftToFill, c: CandidateFacts): string | null {
  if (c.jobTitle.trim().toLowerCase() !== shift.role.trim().toLowerCase()) return `is a ${c.jobTitle}, not a ${shift.role}`;
  if (c.complianceGaps.length > 0) return c.complianceGaps.join("; ");
  if (c.alreadyOffered) return "has already been offered this shift";
  if (c.unavailable) return c.unavailable;
  for (const other of c.nearby) {
    if (other.startAt < shift.endAt && other.endAt > shift.startAt) return "is already booked then";
    const restBefore = (shift.startAt.getTime() - other.endAt.getTime()) / HOUR;
    const restAfter = (other.startAt.getTime() - shift.endAt.getTime()) / HOUR;
    if ((restBefore >= 0 && restBefore < MIN_REST_HOURS) || (restAfter >= 0 && restAfter < MIN_REST_HOURS)) {
      return `would have less than ${MIN_REST_HOURS} hours' rest between shifts`;
    }
  }
  return null;
}

/** Share of offers answered, from 0 to 1; null with fewer than 3 offers to judge by. */
export function reliability(offers: CandidateFacts["offers"]): number | null {
  return offers.sent >= 3 ? offers.answered / offers.sent : null;
}

export function rank(shift: ShiftToFill, candidates: CandidateFacts[]): { ranked: Ranked[]; excluded: Excluded[] } {
  const ranked: Ranked[] = [];
  const excluded: Excluded[] = [];
  for (const c of candidates) {
    const reason = ruledOut(shift, c);
    if (reason) {
      excluded.push({ staffId: c.staffId, name: c.name, reason });
      continue;
    }
    const r = reliability(c.offers);
    const why = [
      r === null ? "new to offers" : `answers ${Math.round(r * 100)}% of offers`,
      `${Math.round(c.weekHours)}h booked that week`,
      !c.hasPhone ? "no mobile, so in the app only" : c.optedOut ? "opted out of texts, so in the app only" : null,
    ]
      .filter(Boolean)
      .join(", ");
    ranked.push({ staffId: c.staffId, name: c.name, textable: c.hasPhone && !c.optedOut, reliability: r, weekHours: c.weekHours, why });
  }
  // Unknown reliability sits in the middle (0.5), so new carers get a fair chance.
  ranked.sort((a, b) => (b.reliability ?? 0.5) - (a.reliability ?? 0.5) || a.weekHours - b.weekHours || a.name.localeCompare(b.name));
  return { ranked, excluded };
}

/** Everyone in the agency, ranked for one shift. */
export async function rankForShift(agencyId: string, shiftId: string) {
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, agencyId }, select: { id: true, startAt: true, endAt: true, role: true } });
  if (!shift) return null;
  const weekStart = startOfWeek(shift.startAt, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const near = { start: new Date(shift.startAt.getTime() - 24 * HOUR), end: new Date(shift.endAt.getTime() + 24 * HOUR) };
  const since = new Date(Date.now() - 90 * 24 * HOUR);

  const staff = await prisma.staffProfile.findMany({
    where: { agencyId, status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      phone: true,
      smsOptOutAt: true,
      dbsNumber: true,
      dbsExpiry: true,
      rightToWork: { select: { status: true, expiryDate: true } },
      shifts: {
        where: { status: { notIn: ["CANCELLED"] }, id: { not: shift.id }, startAt: { lt: near.end > weekEnd ? near.end : weekEnd }, endAt: { gt: near.start < weekStart ? near.start : weekStart } },
        select: { startAt: true, endAt: true, breakMins: true },
      },
      shiftOffers: { where: { offeredAt: { gte: since } }, select: { shiftId: true, status: true, respondedAt: true } },
    },
  });
  const offeredThis = new Set((await prisma.shiftOffer.findMany({ where: { shiftId: shift.id }, select: { staffId: true } })).map((o) => o.staffId));

  const facts: CandidateFacts[] = await Promise.all(
    staff.map(async (s) => ({
      staffId: s.id,
      name: `${s.firstName} ${s.lastName}`.trim(),
      jobTitle: s.jobTitle,
      hasPhone: !!s.phone?.trim(),
      optedOut: !!s.smsOptOutAt,
      complianceGaps: complianceGaps(s),
      nearby: s.shifts.filter((x) => x.startAt < near.end && x.endAt > near.start),
      unavailable: await unavailableReason(agencyId, s.id, shift.startAt, shift.endAt),
      alreadyOffered: offeredThis.has(s.id),
      offers: {
        sent: s.shiftOffers.filter((o) => o.shiftId !== shift.id).length,
        answered: s.shiftOffers.filter((o) => o.shiftId !== shift.id && o.respondedAt).length,
        accepted: s.shiftOffers.filter((o) => o.shiftId !== shift.id && o.status === "ACCEPTED").length,
      },
      weekHours: s.shifts
        .filter((x) => x.startAt >= weekStart && x.startAt < weekEnd)
        .reduce((sum, x) => sum + Math.max(0, (x.endAt.getTime() - x.startAt.getTime()) / HOUR - x.breakMins / 60), 0),
    })),
  );
  return { shift, ...rank(shift, facts) };
}

/** The main reasons carers can't be offered a shift, most common first: "3 a different role, 2 no DBS…". */
export function whyNot(excluded: Excluded[], top = 3): string[] {
  const counts = new Map<string, number>();
  for (const e of excluded) {
    const reason = e.reason.startsWith("is a ") ? "a different role" : e.reason;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([reason, n]) => `${n} ${reason}`);
}
