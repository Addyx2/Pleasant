import { addDays, differenceInCalendarDays } from "date-fns";
import { after } from "next/server";
import { z } from "zod";

import { ukDate } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { reportClockIn } from "@/lib/elements-sync";
import { clientAuthSchema, signOffSchema } from "@/lib/validation";

// What a carer does on a shift, shared by the Workers app (/workforce) and the
// Carer API the Aultrum carer app calls. `ownStaffId` is the carer acting, or
// null for office staff, who may act on any carer's shift in their agency.

export interface Actor {
  agencyId: string;
  ownStaffId: string | null;
}

export type WorkResult = { ok: true; message?: string } | { ok: false; error: string };

const done = (message?: string): WorkResult => ({ ok: true, message });
const fail = (error: string): WorkResult => ({ ok: false, error });

const mayAct = (actor: Actor, staffId: string | null) => actor.ownStaffId === null || staffId === actor.ownStaffId;

export interface Location {
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
}

/** The phone's location sent with a clock-in, if the carer allowed it and it looks real. */
export function cleanLocation(loc: Location): { clockInLat?: number; clockInLng?: number; clockInAccuracyM?: number } {
  const { lat, lng, accuracy } = loc;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return {};
  return {
    clockInLat: lat,
    clockInLng: lng,
    clockInAccuracyM: accuracy != null && Number.isFinite(accuracy) ? Math.round(Math.min(Math.max(accuracy, 0), 100_000)) : undefined,
  };
}

export async function clockIn(actor: Actor, shiftId: string, location: Location, breakMins?: number): Promise<WorkResult> {
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, agencyId: actor.agencyId }, include: { timesheet: true } });
  if (!shift || !shift.staffId || !mayAct(actor, shift.staffId)) return fail("That shift isn't yours.");
  if (shift.timesheet) return fail("You've already clocked in to this shift.");
  if (shift.status === "CANCELLED") return fail("This shift was cancelled.");

  const timesheet = await prisma.timesheet.create({
    data: {
      agencyId: actor.agencyId,
      shiftId: shift.id,
      staffId: shift.staffId,
      clockIn: new Date(),
      breakMins: breakMins ?? shift.breakMins,
      status: "PENDING",
      ...cleanLocation(location),
    },
  });
  await prisma.shift.update({ where: { id: shift.id }, data: { status: "IN_PROGRESS" } });
  after(() => reportClockIn(actor.agencyId, timesheet.id));
  return done("Clocked in.");
}

async function openTimesheet(actor: Actor, timesheetId: string) {
  const timesheet = await prisma.timesheet.findFirst({ where: { id: timesheetId, agencyId: actor.agencyId, clockOut: null } });
  return timesheet && mayAct(actor, timesheet.staffId) ? timesheet : null;
}

export async function startBreak(actor: Actor, timesheetId: string): Promise<WorkResult> {
  const timesheet = await openTimesheet(actor, timesheetId);
  if (!timesheet) return fail("You're not on this shift.");
  if (timesheet.breakStartedAt) return done();
  await prisma.timesheet.update({ where: { id: timesheet.id }, data: { breakStartedAt: new Date() } });
  return done("Break started.");
}

export async function endBreak(actor: Actor, timesheetId: string): Promise<WorkResult> {
  const timesheet = await openTimesheet(actor, timesheetId);
  if (!timesheet) return fail("You're not on this shift.");
  if (!timesheet.breakStartedAt) return done();
  const mins = Math.round((Date.now() - timesheet.breakStartedAt.getTime()) / 60000);
  await prisma.timesheet.update({ where: { id: timesheet.id }, data: { breakStartedAt: null, breakTakenMins: { increment: Math.max(0, mins) } } });
  return done("Break ended.");
}

export async function clockOut(actor: Actor, timesheetId: string): Promise<WorkResult> {
  const timesheet = await openTimesheet(actor, timesheetId);
  if (!timesheet) return fail("You're not on this shift.");

  const out = new Date();
  // A break still running ends at clock-out. Breaks the carer tracked replace the planned one.
  const running = timesheet.breakStartedAt ? Math.round((out.getTime() - timesheet.breakStartedAt.getTime()) / 60000) : 0;
  const taken = timesheet.breakTakenMins + Math.max(0, running);
  const breakMins = taken > 0 ? taken : timesheet.breakMins;
  const workedMins = Math.max(0, Math.round((out.getTime() - timesheet.clockIn.getTime()) / 60000) - breakMins);

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { clockOut: out, workedMins, breakMins, breakStartedAt: null, breakTakenMins: taken },
  });
  return done("Shift complete. Now sign it off.");
}

export async function signAsCarer(actor: Actor, input: { timesheetId: unknown; signature: unknown }): Promise<WorkResult & { shiftId?: string }> {
  const parsed = signOffSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Sign in the box");
  const timesheet = await prisma.timesheet.findFirst({ where: { id: parsed.data.timesheetId, agencyId: actor.agencyId } });
  if (!timesheet || !mayAct(actor, timesheet.staffId)) return fail("That shift isn't yours.");
  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { candidateSignature: parsed.data.signature, candidateSignedAt: new Date() },
  });
  return { ok: true, message: "Signed. Now hand your phone to the person in charge.", shiftId: timesheet.shiftId };
}

export async function signAsClient(
  actor: Actor,
  input: { timesheetId: unknown; signature: unknown; name: unknown; position: unknown },
): Promise<WorkResult & { shiftId?: string }> {
  const parsed = clientAuthSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");
  const timesheet = await prisma.timesheet.findFirst({ where: { id: parsed.data.timesheetId, agencyId: actor.agencyId } });
  // Only the carer who worked the shift (or office staff) can collect the client's signature.
  if (!timesheet || !mayAct(actor, timesheet.staffId)) return fail("That shift isn't yours.");
  if (!timesheet.clockOut) return fail("Complete the shift first.");
  if (timesheet.clientAuthAt) return done("Already signed.");
  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: {
      clientAuthName: parsed.data.name,
      clientAuthPosition: parsed.data.position,
      clientAuthSignature: parsed.data.signature,
      clientAuthAt: new Date(),
    },
  });
  return { ok: true, message: "Signed off. It's with your agency to approve.", shiftId: timesheet.shiftId };
}

export type RequestOutcome = "requested" | "gone" | "overlap";

/** A carer asks for an open shift. Never one that clashes with a shift they already have. */
export async function requestShift(agencyId: string, staffId: string, shiftId: string, message?: string | null): Promise<RequestOutcome> {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, agencyId, status: "OPEN", staffId: null },
    select: { id: true, startAt: true, endAt: true },
  });
  if (!shift) return "gone";
  const clash = await prisma.shift.findFirst({
    where: { agencyId, staffId, status: { notIn: ["CANCELLED", "COMPLETED"] }, startAt: { lt: shift.endAt }, endAt: { gt: shift.startAt } },
    select: { id: true },
  });
  if (clash) return "overlap";
  const note = message?.trim().slice(0, 300) || null;
  await prisma.shiftRequest.upsert({
    where: { shiftId_staffId: { shiftId, staffId } },
    create: { agencyId, shiftId, staffId, message: note },
    update: { status: "PENDING", message: note },
  });
  return "requested";
}

const unavailabilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dates"), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a first day"), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a last day"), reason: z.string().trim().max(80) }),
  z.object({ kind: z.literal("weekly"), weekday: z.coerce.number().int().min(1).max(7), until: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/), reason: z.string().trim().max(80) }),
]);

/** A carer says when they can't work. Their agency then can't book or offer them shifts then. */
export async function addUnavailability(agencyId: string, staffId: string, input: Record<string, unknown>): Promise<WorkResult> {
  const fields = Object.fromEntries(["kind", "from", "to", "weekday", "until", "reason"].map((k) => [k, input[k] == null ? "" : String(input[k])]));
  const parsed = unavailabilitySchema.safeParse(fields);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details");
  const today = ukDate(new Date());
  const d = parsed.data;

  let startsOn: string;
  let endsOn: string;
  let weekday: number | null = null;
  if (d.kind === "dates") {
    if (d.to < d.from) return fail("The last day must be on or after the first day.");
    if (d.to < today) return fail("Those days have already passed.");
    if (differenceInCalendarDays(new Date(d.to), new Date(d.from)) > 365) return fail("Choose a range of up to a year.");
    startsOn = d.from < today ? today : d.from;
    endsOn = d.to;
  } else {
    startsOn = today;
    endsOn = d.until || ukDate(addDays(new Date(), 365));
    if (endsOn < today) return fail("Choose an end date in the future.");
    weekday = d.weekday;
  }
  await prisma.staffUnavailability.create({
    data: { agencyId, staffId, startsOn: new Date(`${startsOn}T00:00:00Z`), endsOn: new Date(`${endsOn}T00:00:00Z`), weekday, reason: d.reason || null },
  });
  return done("Saved. Your agency won't book you then.");
}

export async function removeUnavailability(agencyId: string, staffId: string, id: string): Promise<WorkResult> {
  await prisma.staffUnavailability.deleteMany({ where: { id, staffId, agencyId } });
  return done("Removed.");
}
