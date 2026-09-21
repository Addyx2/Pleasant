"use server";

import { revalidatePath } from "next/cache";

import { requireUser, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftDurationMins } from "@/lib/utils";
import { clientAuthSchema, expensesSchema, signOffSchema } from "@/lib/validation";

function refreshTimesheetPaths() {
  revalidatePath("/timesheets");
  revalidatePath("/timesheets/sheet");
  revalidatePath("/my-shifts");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
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

  await prisma.timesheet.create({
    data: {
      agencyId: user.agencyId,
      shiftId: shift.id,
      staffId: shift.staffId,
      clockIn: new Date(),
      breakMins,
      status: "PENDING",
    },
  });

  await prisma.shift.update({ where: { id: shift.id }, data: { status: "IN_PROGRESS" } });

  refreshTimesheetPaths();
  revalidatePath(`/shifts/${shiftId}`);
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
  const workedMins = Math.max(
    0,
    Math.round((clockOut.getTime() - timesheet.clockIn.getTime()) / 60000) - timesheet.breakMins,
  );

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { clockOut, workedMins },
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
