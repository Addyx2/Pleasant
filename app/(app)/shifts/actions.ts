"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createShiftSchema } from "@/lib/validation";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createShiftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const parsed = createShiftSchema.safeParse({
    title: formData.get("title"),
    role: formData.get("role"),
    clientId: formData.get("clientId"),
    siteId: formData.get("siteId"),
    staffId: formData.get("staffId"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    breakMins: formData.get("breakMins") || 0,
    chargeRate: formData.get("chargeRate") || 0,
    isSleepIn: formData.get("isSleepIn") === "on",
    sleepInRate: formData.get("sleepInRate") || 0,
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not create the shift" };
  }

  const data = parsed.data;
  if (data.endAt <= data.startAt) {
    return { error: "The shift must end after it starts" };
  }

  await prisma.shift.create({
    data: {
      agencyId: user.agencyId,
      createdById: user.id,
      title: data.title,
      role: data.role,
      clientId: data.clientId ?? null,
      siteId: data.siteId ?? null,
      staffId: data.staffId ?? null,
      startAt: data.startAt,
      endAt: data.endAt,
      breakMins: data.breakMins,
      chargeRate: data.chargeRate,
      isSleepIn: data.isSleepIn,
      sleepInRate: data.sleepInRate,
      notes: data.notes ?? null,
      status: data.staffId ? "ASSIGNED" : "OPEN",
    },
  });

  revalidatePath("/shifts");
  revalidatePath("/dashboard");
  return { success: "Shift created" };
}

export async function assignShiftFormAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const shiftId = String(formData.get("shiftId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");

  if (!shiftId || !staffId) return;

  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId },
  });
  if (!staff) return;

  await prisma.shift.updateMany({
    where: { id: shiftId, agencyId: user.agencyId },
    data: { staffId, status: "ASSIGNED" },
  });

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/dashboard");
}

export async function updateShiftStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const shiftId = String(formData.get("shiftId") ?? "");
  const status = String(formData.get("status") ?? "");

  const allowed = ["DRAFT", "OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];
  if (!shiftId || !allowed.includes(status)) return;

  await prisma.shift.updateMany({
    where: { id: shiftId, agencyId: user.agencyId },
    data: { status: status as never },
  });

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/dashboard");
}

export async function deleteShiftAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const shiftId = String(formData.get("shiftId") ?? "");
  if (!shiftId) return;

  await prisma.shift.deleteMany({
    where: { id: shiftId, agencyId: user.agencyId, status: { in: ["DRAFT", "OPEN", "CANCELLED"] } },
  });

  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}
