import { addDays, addHours, endOfMonth, startOfMonth } from "date-fns";

import { clashingRule, ukDate } from "@/lib/availability";
import { expectedPay } from "@/lib/carer-pay";
import { clientName, type NamedClient } from "@/lib/clients";
import { daysUntil, expiryState, type ExpiryState } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { ElementsError, elementScreenUrl, installationFor } from "@/lib/elements";
import { nextCutoff, payDayForCutoff } from "@/lib/week";

// What the Aultrum carer app shows, as plain JSON (Carer API v1). Dates are
// ISO strings; money is pounds as numbers. The Workers app's home screen uses
// the same "current shift" rule.

export interface Carer {
  agencyId: string;
  staffId: string;
  userId: string;
}

type Rates = Parameters<typeof expectedPay>[0];

interface ShiftLike {
  id: string;
  title: string;
  role: string | null;
  startAt: Date;
  endAt: Date;
  breakMins: number;
  isSleepIn: boolean;
  sleepInRate: unknown;
  notes: string | null;
  client: NamedClient | null;
  site: { name: string; address: string | null; postcode: string | null; notes: string | null } | null;
}

export const placeOf = (s: { client: NamedClient | null; site: { name: string } | null }) =>
  s.client ? clientName(s.client) : (s.site?.name ?? "Location to be confirmed");

const isNight = (at: Date) => {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", hourCycle: "h23" }).format(at));
  return h >= 18 || h < 4;
};
const isWeekend = (at: Date) => ["Sat", "Sun"].includes(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" }).format(at));

function card(s: ShiftLike, rates: Rates) {
  const pay = expectedPay(rates, s);
  return {
    id: s.id,
    title: s.title,
    place: placeOf(s),
    detail: [s.site && s.client ? s.site.name : null, s.role].filter(Boolean).join(" · "),
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    day: ukDate(s.startAt),
    night: isNight(s.startAt) && !s.isSleepIn,
    weekend: isWeekend(s.startAt),
    sleepIn: s.isSleepIn,
    pay: { rate: pay.rate, total: pay.total, hours: Math.round(pay.hours * 10) / 10 },
  };
}
export type ShiftCard = ReturnType<typeof card>;

interface WithTimesheet {
  startAt: Date;
  endAt: Date;
  timesheet: { clockOut: Date | null; status: string; clientAuthAt: Date | null; candidateSignedAt?: Date | null } | null;
  client?: { aultrumBuyerId?: string | null } | null;
}

export const needsSignOff = (s: WithTimesheet) => Boolean(s.timesheet?.clockOut && s.timesheet.status === "PENDING" && !s.timesheet.clientAuthAt);

/**
 * Whether the home signs this client's timesheets in Aultrum Workspace. Then
 * the carer signs their part on the phone and the home signs in Workspace;
 * the carer can't collect the home's signature on their phone.
 */
export const signsInWorkspace = (client: { aultrumBuyerId?: string | null } | null | undefined) => Boolean(client?.aultrumBuyerId);

/** A shift the carer can do something about: their own signature, or collecting the home's on their phone. */
export const carerCanSign = (s: WithTimesheet) => needsSignOff(s) && (!s.timesheet?.candidateSignedAt || !signsInWorkspace(s.client));

/**
 * The shift that needs the carer now: one they're on, one starting within two
 * hours, one waiting for their signatures, or the next one within the day.
 */
export function currentShift<S extends WithTimesheet>(shifts: S[], now: Date): S | null {
  const notStarted = (s: S) => !s.timesheet && s.endAt > now;
  return (
    shifts.find((s) => s.timesheet && !s.timesheet.clockOut) ??
    shifts.find((s) => notStarted(s) && s.startAt < addHours(now, 2)) ??
    // The shift they've just finished, before older ones still waiting.
    shifts.filter(carerCanSign).sort((a, b) => (b.timesheet?.clockOut?.getTime() ?? 0) - (a.timesheet?.clockOut?.getTime() ?? 0))[0] ??
    shifts.find((s) => notStarted(s) && s.startAt < addHours(now, 18)) ??
    null
  );
}

async function profileOf(c: Carer) {
  return prisma.staffProfile.findFirstOrThrow({ where: { id: c.staffId, agencyId: c.agencyId }, include: { agency: true } });
}

export async function homeScreen(c: Carer) {
  const now = new Date();
  const profile = await profileOf(c);
  const [shifts, offers] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId: c.agencyId, staffId: c.staffId, startAt: { gte: addDays(now, -2), lt: addDays(now, 8) }, status: { notIn: ["CANCELLED"] } },
      include: { client: true, site: true, timesheet: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.shiftOffer.findMany({
      where: { agencyId: c.agencyId, staffId: c.staffId, status: "OFFERED", shift: { startAt: { gte: now } } },
      include: { shift: { include: { client: true, site: true } } },
      orderBy: { offeredAt: "desc" },
      take: 10,
    }),
  ]);
  const current = currentShift(shifts, now);
  const agency = profile.agency;
  const schedule = { cutoffWeekday: agency.cutoffWeekday, cutoffTime: agency.cutoffTime, payWeekday: agency.payWeekday };
  const cutoff = nextCutoff(schedule);

  let hero = null;
  if (current) {
    const ts = current.timesheet;
    const address = [current.site?.address, current.site?.postcode].filter(Boolean).join(", ");
    const state: "on_shift" | "on_break" | "to_sign" | "starting" | "next" = ts && !ts.clockOut ? (ts.breakStartedAt ? "on_break" : "on_shift") : ts?.clockOut ? "to_sign" : current.startAt <= now ? "starting" : "next";
    hero = {
      ...card(current, profile),
      state,
      address: address || null,
      mapsQuery: address ? `${current.site?.name ?? placeOf(current)}, ${address}` : null,
      siteNotes: current.site?.notes ?? null,
      notes: current.notes,
      timesheet: ts
        ? {
            id: ts.id,
            clockIn: ts.clockIn.toISOString(),
            clockOut: ts.clockOut?.toISOString() ?? null,
            breakStartedAt: ts.breakStartedAt?.toISOString() ?? null,
            breakTakenMins: ts.breakTakenMins,
            workedMins: ts.workedMins,
            locationRecorded: ts.clockInLat != null,
            carerSigned: Boolean(ts.candidateSignedAt),
            clientSigned: Boolean(ts.clientAuthAt),
            homeSignsInWorkspace: signsInWorkspace(current.client),
          }
        : null,
    };
  }

  return {
    firstName: profile.firstName,
    org: agency.name,
    current: hero,
    offers: offers.map((o) => ({ id: o.id, shift: card(o.shift, profile) })),
    toSign: shifts
      .filter((s) => s.id !== current?.id && needsSignOff(s))
      .map((s) => ({
        ...card(s, profile),
        timesheetId: s.timesheet?.id ?? "",
        needs: s.timesheet?.candidateSignedAt ? ("theirs" as const) : ("yours" as const),
        homeSignsInWorkspace: signsInWorkspace(s.client),
      })),
    upcoming: shifts.filter((s) => s.id !== current?.id && s.endAt > now && !s.timesheet).map((s) => card(s, profile)),
    payCutoff: cutoff.toISOString(),
    payDay: payDayForCutoff(schedule, cutoff).toISOString(),
  };
}

export async function poolScreen(c: Carer) {
  const now = new Date();
  const profile = await profileOf(c);
  const [shifts, requests, rules] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId: c.agencyId, staffId: null, status: "OPEN", startAt: { gte: now, lte: addDays(now, 30) } },
      include: { client: true, site: true },
      orderBy: { startAt: "asc" },
      take: 60,
    }),
    prisma.shiftRequest.findMany({ where: { staffId: c.staffId, shift: { status: "OPEN", staffId: null } }, select: { shiftId: true, status: true } }),
    prisma.staffUnavailability.findMany({ where: { staffId: c.staffId, endsOn: { gte: new Date(`${ukDate(now)}T00:00:00Z`) } } }),
  ]);
  const requestBy = new Map(requests.map((r) => [r.shiftId, r.status]));
  return {
    org: profile.agency.name,
    shifts: shifts.map((s) => ({
      ...card(s, profile),
      request: (requestBy.get(s.id) ?? null) as "PENDING" | "ACCEPTED" | "REJECTED" | null,
      unavailable: Boolean(clashingRule(rules, s.startAt, s.endAt)),
    })),
  };
}

export async function calendarScreen(c: Carer, monthKey: string | null) {
  const today = ukDate(new Date());
  const key = monthKey && /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : today.slice(0, 7);
  const month = new Date(`${key}-01T12:00:00Z`);
  const from = startOfMonth(month);
  const to = endOfMonth(month);
  const profile = await profileOf(c);
  const [shifts, requests, rules] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId: c.agencyId, staffId: c.staffId, startAt: { gte: from, lte: to }, status: { notIn: ["CANCELLED"] } },
      include: { client: true, site: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.shiftRequest.findMany({
      where: { staffId: c.staffId, status: "PENDING", shift: { startAt: { gte: from, lte: to } } },
      include: { shift: { include: { client: true, site: true } } },
    }),
    prisma.staffUnavailability.findMany({ where: { staffId: c.staffId, agencyId: c.agencyId, endsOn: { gte: new Date(`${today}T00:00:00Z`) } }, orderBy: { startsOn: "asc" } }),
  ]);
  const days = Array.from({ length: to.getDate() }, (_, i) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i + 1, 12)));
  return {
    org: profile.agency.name,
    month: key,
    today,
    shifts: shifts.map((s) => card(s, profile)),
    requests: requests.map((r) => card(r.shift, profile)),
    blockedDays: days.filter((d) => clashingRule(rules, new Date(d.getTime() - 3_600_000 * 11), new Date(d.getTime() + 3_600_000 * 11))).map((d) => d.toISOString().slice(0, 10)),
    rules: rules.map((r) => ({
      id: r.id,
      startsOn: r.startsOn.toISOString().slice(0, 10),
      endsOn: r.endsOn.toISOString().slice(0, 10),
      weekday: r.weekday,
      reason: r.reason,
    })),
  };
}

export async function passportScreen(c: Carer) {
  const now = new Date();
  const profile = await prisma.staffProfile.findFirstOrThrow({
    where: { id: c.staffId, agencyId: c.agencyId },
    include: { agency: true, rightToWork: true, trainingRecords: { orderBy: { expiryDate: "asc" } } },
  });
  const rtw = profile.rightToWork;
  const row = (group: "statutory" | "training", title: string, detail: string | null, state: ExpiryState, expires: Date | null) => ({
    group,
    title,
    detail,
    state,
    expiresAt: expires?.toISOString() ?? null,
    daysLeft: expires ? daysUntil(expires) : null,
  });
  return {
    org: profile.agency.name,
    rows: [
      row("statutory", "DBS check", profile.dbsNumber ? `Certificate ${profile.dbsNumber}` : null, expiryState(profile.dbsExpiry, now), profile.dbsExpiry),
      row(
        "statutory",
        "Right to work",
        rtw ? [rtw.documentType.replace(/_/g, " ").toLowerCase(), rtw.status === "VERIFIED" ? "checked by your agency" : null].filter(Boolean).join(" · ") : null,
        rtw ? (rtw.expiryDate ? expiryState(rtw.expiryDate, now) : rtw.status === "VERIFIED" ? "OK" : "MISSING") : "MISSING",
        rtw?.expiryDate ?? null,
      ),
      ...profile.trainingRecords.map((t) => row("training", t.courseName, t.provider, t.completedAt ? expiryState(t.expiryDate, now) : "MISSING", t.expiryDate)),
    ],
  };
}

/** Peak, if the agency has switched it on: a five-minute address for the carer's own Peak screen. */
export async function peakScreen(c: Carer) {
  const profile = await profileOf(c);
  const installationId = await installationFor(c.agencyId, "PEAK");
  if (!installationId) return { org: profile.agency.name, on: false as const };
  try {
    const url = await elementScreenUrl(installationId, {
      id: c.userId,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      role: "member",
      personId: profile.id,
    });
    return { org: profile.agency.name, on: true as const, url };
  } catch (error) {
    if (!(error instanceof ElementsError)) console.error("carer api peak failed", error);
    return { org: profile.agency.name, on: true as const, problem: error instanceof ElementsError ? error.message : "Peak couldn't be loaded. Try again in a minute." };
  }
}

/** Whole days since a shift finished: the clock for sign-off reminders. */
export function daysWaiting(clockOut: Date | null, now = new Date()): number | null {
  return clockOut ? Math.max(0, Math.floor((now.getTime() - clockOut.getTime()) / 86_400_000)) : null;
}

/**
 * The carer's timesheets for the last 60 days, each with where its sign-off
 * stands: theirs to sign, waiting for the home, or signed off.
 */
export async function timesheetsScreen(c: Carer) {
  const now = new Date();
  const profile = await profileOf(c);
  const rows = await prisma.timesheet.findMany({
    where: { agencyId: c.agencyId, staffId: c.staffId, clockOut: { not: null, gte: addDays(now, -60) } },
    include: { shift: { include: { client: true, site: true } } },
    orderBy: { clockIn: "desc" },
    take: 200,
  });
  return {
    org: profile.agency.name,
    timesheets: rows.map((t) => {
      const shift = { ...t.shift, timesheet: t };
      const signed = Boolean(t.clientAuthAt) || t.status === "APPROVED";
      const stage = signed ? "signed" : t.status !== "PENDING" ? "closed" : carerCanSign(shift) ? "to_sign" : "waiting";
      return {
        id: t.id,
        title: t.shift.title,
        place: placeOf(t.shift),
        clockIn: t.clockIn.toISOString(),
        clockOut: t.clockOut!.toISOString(),
        workedMins: t.workedMins,
        status: t.status,
        stage: stage as "to_sign" | "waiting" | "signed" | "closed",
        carerSigned: Boolean(t.candidateSignedAt),
        homeSignsInWorkspace: signsInWorkspace(t.shift.client),
        signedBy: t.clientAuthName,
        signedPosition: t.clientAuthPosition,
        signedAt: t.clientAuthAt?.toISOString() ?? null,
        daysWaiting: signed ? null : daysWaiting(t.clockOut, now),
      };
    }),
  };
}
