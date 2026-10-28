"use server";

import { revalidatePath } from "next/cache";

import { requireUser, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftDurationMins } from "@/lib/utils";
import { clientAuthSchema, expensesSchema, signOffSchema } from "@/lib/validation";
import { after } from "next/server";
import { reportClockIn, reportShiftCompleted } from "@/lib/elements-sync";

function refreshTimesheetPaths() {
  revalidatePath("/timesheets");
  revalidatePath("/timesheets/sheet");
  revalidatePath("/workforce");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
  revalidatePath("/oversight");
}

/** Carers acting as staff may only touch their own shifts and timesheets. */
function ownStaffId(user: SessionUser): string | null {
  if (user.role !== "STAFF") return null;
  return user.staff?.id ?? "__none__";
}

function mayAccessShift(user: SessionUser, staffId: string | null): boolean {
  const own = ownStaffId(user);
  if (own === null) return true;
  return staffId === own;
}

export async function clockInFormAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const shiftId = String(formData.get("shiftId") ?? "");
  const breakMins = Number(formData.get("breakMins") ?? 0) || 0;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, agencyId: user.agencyId },
    include: { timesheet: true },
  });
  if (!shift || !shift.staffId || shift.timesheet) return;
  if (!mayAccessShift(user, shift.staffId)) return;

  const location = readLocation(formData);
  const timesheet = await prisma.timesheet.create({
    data: {
      agencyId: user.agencyId,
      shiftId: shift.id,
      staffId: shift.staffId,
      clockIn: new Date(),
      breakMins,
      status: "PENDING",
      ...location,
    },
  });

  await prisma.shift.update({ where: { id: shift.id }, data: { status: "IN_PROGRESS" } });
  after(() => reportClockIn(user.agencyId, timesheet.id));

  refreshTimesheetPaths();
  revalidatePath(`/shifts/${shiftId}`);
}

/** The phone's location sent with a clock-in, if the carer allowed it and it looks real. */
function readLocation(formData: FormData): { clockInLat?: number; clockInLng?: number; clockInAccuracyM?: number } {
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const accuracy = Number(formData.get("accuracy"));
  if (!formData.get("lat") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return {};
  return { clockInLat: lat, clockInLng: lng, clockInAccuracyM: Number.isFinite(accuracy) ? Math.round(Math.min(accuracy, 100_000)) : undefined };
}

async function ownOpenTimesheet(formData: FormData) {
  const user = await requireUser();
  const timesheet = await prisma.timesheet.findFirst({
    where: { id: String(formData.get("timesheetId") ?? ""), agencyId: user.agencyId, clockOut: null },
  });
  if (!timesheet || !mayAccessShift(user, timesheet.staffId)) return null;
  return timesheet;
}

export async function startBreakAction(formData: FormData): Promise<void> {
  const timesheet = await ownOpenTimesheet(formData);
  if (!timesheet || timesheet.breakStartedAt) return;
  await prisma.timesheet.update({ where: { id: timesheet.id }, data: { breakStartedAt: new Date() } });
  revalidatePath("/workforce");
}

export async function endBreakAction(formData: FormData): Promise<void> {
  const timesheet = await ownOpenTimesheet(formData);
  if (!timesheet?.breakStartedAt) return;
  const mins = Math.round((Date.now() - timesheet.breakStartedAt.getTime()) / 60000);
  await prisma.timesheet.update({ where: { id: timesheet.id }, data: { breakStartedAt: null, breakTakenMins: { increment: Math.max(0, mins) } } });
  revalidatePath("/workforce");
}

export async function clockOutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const timesheetId = String(formData.get("timesheetId") ?? "");

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: timesheetId, agencyId: user.agencyId },
  });
  if (!timesheet || timesheet.clockOut) return;
  if (!mayAccessShift(user, timesheet.staffId)) return;

  const clockOut = new Date();
  // A break still running ends at clock-out. Breaks the carer tracked replace the planned one.
  const running = timesheet.breakStartedAt ? Math.round((clockOut.getTime() - timesheet.breakStartedAt.getTime()) / 60000) : 0;
  const taken = timesheet.breakTakenMins + Math.max(0, running);
  const breakMins = taken > 0 ? taken : timesheet.breakMins;
  const workedMins = Math.max(0, Math.round((clockOut.getTime() - timesheet.clockIn.getTime()) / 60000) - breakMins);

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { clockOut, workedMins, breakMins, breakStartedAt: null, breakTakenMins: taken },
  });

  refreshTimesheetPaths();
}

export async function decideTimesheetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  // Only managers/admins approve — carers sign off, they don't approve.
  if (user.role === "STAFF") return;

  const timesheetId = String(formData.get("timesheetId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!timesheetId || !["APPROVED", "REJECTED", "DISPUTED"].includes(decision)) return;

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: timesheetId, agencyId: user.agencyId },
    include: { shift: true },
  });
  if (!timesheet) return;

  // No client authorisation, no approval — mirrors the paper form's
  // "to be completed by client" section.
  if (decision === "APPROVED" && !timesheet.clientAuthAt) return;

  const workedMins =
    timesheet.workedMins > 0
      ? timesheet.workedMins
      : shiftDurationMins(timesheet.shift.startAt, timesheet.shift.endAt) - timesheet.breakMins;

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: {
      status: decision as never,
      approvedById: user.id,
      approvedAt: new Date(),
      workedMins: Math.max(0, workedMins),
    },
  });

  if (decision === "APPROVED") {
    await prisma.shift.update({ where: { id: timesheet.shiftId }, data: { status: "COMPLETED" } });
    after(() => reportShiftCompleted(user.agencyId, timesheet.id));
  }

  refreshTimesheetPaths();
}

export async function saveCandidateSignatureAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = signOffSchema.safeParse({
    timesheetId: formData.get("timesheetId"),
    signature: formData.get("signature"),
  });
  if (!parsed.success) return;

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: parsed.data.timesheetId, agencyId: user.agencyId },
  });
  if (!timesheet) return;
  if (!mayAccessShift(user, timesheet.staffId)) return;

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { candidateSignature: parsed.data.signature, candidateSignedAt: new Date() },
  });

  refreshTimesheetPaths();
  revalidatePath(`/shifts/${timesheet.shiftId}`);
}

export async function saveClientAuthAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = clientAuthSchema.safeParse({
    timesheetId: formData.get("timesheetId"),
    signature: formData.get("signature"),
    name: formData.get("name"),
    position: formData.get("position"),
  });
  if (!parsed.success) return;

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: parsed.data.timesheetId, agencyId: user.agencyId },
  });
  if (!timesheet) return;
  // Only the carer who worked the shift (or office staff) can collect the client's signature.
  if (!mayAccessShift(user, timesheet.staffId)) return;
  if (!timesheet.clockOut || timesheet.clientAuthAt) return;

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: {
      clientAuthName: parsed.data.name,
      clientAuthPosition: parsed.data.position,
      clientAuthSignature: parsed.data.signature,
      clientAuthAt: new Date(),
    },
  });

  refreshTimesheetPaths();
  revalidatePath(`/shifts/${timesheet.shiftId}`);
}

export async function saveExpensesAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = expensesSchema.safeParse({
    timesheetId: formData.get("timesheetId"),
    expenses: formData.get("expenses"),
    expenseNotes: formData.get("expenseNotes"),
  });
  if (!parsed.success) return;

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: parsed.data.timesheetId, agencyId: user.agencyId },
  });
  if (!timesheet) return;
  if (!mayAccessShift(user, timesheet.staffId)) return;

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { expenses: parsed.data.expenses, expenseNotes: parsed.data.expenseNotes ?? null },
  });

  refreshTimesheetPaths();
  revalidatePath(`/shifts/${timesheet.shiftId}`);
}
