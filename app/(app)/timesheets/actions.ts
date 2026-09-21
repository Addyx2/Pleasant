"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftDurationMins } from "@/lib/utils";

export async function clockInFormAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const shiftId = String(formData.get("shiftId") ?? "");
  const breakMins = Number(formData.get("breakMins") ?? 0) || 0;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, agencyId: user.agencyId },
    include: { timesheet: true },
  });
  if (!shift || !shift.staffId || shift.timesheet) return;

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

  revalidatePath("/timesheets");
  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/dashboard");
}

export async function clockOutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const timesheetId = String(formData.get("timesheetId") ?? "");

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: timesheetId, agencyId: user.agencyId },
  });
  if (!timesheet || timesheet.clockOut) return;

  const clockOut = new Date();
  const workedMins = Math.max(
    0,
    Math.round((clockOut.getTime() - timesheet.clockIn.getTime()) / 60000) - timesheet.breakMins,
  );

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { clockOut, workedMins },
  });

  revalidatePath("/timesheets");
  revalidatePath("/dashboard");
}

export async function decideTimesheetAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const timesheetId = String(formData.get("timesheetId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!timesheetId || !["APPROVED", "REJECTED", "DISPUTED"].includes(decision)) return;

  const timesheet = await prisma.timesheet.findFirst({
    where: { id: timesheetId, agencyId: user.agencyId },
    include: { shift: true },
  });
  if (!timesheet) return;

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

  revalidatePath("/timesheets");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}
