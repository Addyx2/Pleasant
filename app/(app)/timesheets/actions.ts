"use server";

import { revalidatePath } from "next/cache";

import { requireUser, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shiftDurationMins } from "@/lib/utils";
import { expensesSchema } from "@/lib/validation";
import { after } from "next/server";
import { reportShiftCompleted } from "@/lib/elements-sync";
import { clockIn, clockOut, endBreak, signAsCarer, signAsClient, startBreak, type Actor } from "@/lib/carer/work";

function refreshTimesheetPaths() {
  revalidatePath("/timesheets");
  revalidatePath("/timesheets/sheet");
  revalidatePath("/workforce");
  revalidatePath("/shifts");
  revalidatePath("/dashboard");
  revalidatePath("/oversight");
}

/** Carers acting as staff may only touch their own shifts and timesheets. */
function actorFor(user: SessionUser): Actor {
  return { agencyId: user.agencyId, ownStaffId: user.role === "STAFF" ? (user.staff?.id ?? "__none__") : null };
}

export async function clockInFormAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const shiftId = String(formData.get("shiftId") ?? "");
  const breakMins = formData.has("breakMins") ? Number(formData.get("breakMins")) || 0 : undefined;
  const coord = (k: string) => (formData.get(k) ? Number(formData.get(k)) : null);
  const result = await clockIn(actorFor(user), shiftId, { lat: coord("lat"), lng: coord("lng"), accuracy: coord("accuracy") }, breakMins);
  if (!result.ok) return;
  refreshTimesheetPaths();
  revalidatePath(`/shifts/${shiftId}`);
}

export async function startBreakAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await startBreak(actorFor(user), String(formData.get("timesheetId") ?? ""));
  revalidatePath("/workforce");
}

export async function endBreakAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await endBreak(actorFor(user), String(formData.get("timesheetId") ?? ""));
  revalidatePath("/workforce");
}

export async function clockOutAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await clockOut(actorFor(user), String(formData.get("timesheetId") ?? ""));
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
  const result = await signAsCarer(actorFor(user), { timesheetId: formData.get("timesheetId"), signature: formData.get("signature") });
  if (!result.ok) return;
  refreshTimesheetPaths();
  revalidatePath(`/shifts/${result.shiftId}`);
}

export async function saveClientAuthAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const result = await signAsClient(actorFor(user), {
    timesheetId: formData.get("timesheetId"),
    signature: formData.get("signature"),
    name: formData.get("name"),
    position: formData.get("position"),
  });
  if (!result.ok) return;
  refreshTimesheetPaths();
  revalidatePath(`/shifts/${result.shiftId}`);
}

function mayAccess(user: SessionUser, staffId: string | null): boolean {
  const { ownStaffId } = actorFor(user);
  return ownStaffId === null || staffId === ownStaffId;
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
  if (!mayAccess(user, timesheet.staffId)) return;

  await prisma.timesheet.update({
    where: { id: timesheet.id },
    data: { expenses: parsed.data.expenses, expenseNotes: parsed.data.expenseNotes ?? null },
  });

  refreshTimesheetPaths();
  revalidatePath(`/shifts/${timesheet.shiftId}`);
}
