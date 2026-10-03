"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function offerShiftAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const shiftId = String(formData.get("shiftId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  if (!shiftId || !staffId) return;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, agencyId: user.agencyId },
    select: { id: true },
  });
  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!shift || !staff) return;

  await prisma.shiftOffer.upsert({
    where: { shiftId_staffId: { shiftId, staffId } },
    create: { agencyId: user.agencyId, shiftId, staffId },
    update: { status: "OFFERED", respondedAt: null },
  });

  await prisma.agentLog.create({
    data: {
      agencyId: user.agencyId,
      agentName: "DISPATCH",
      action: "SHIFT_OFFERED",
      details: `Offered shift ${shiftId.slice(0, 8)} to staff ${staffId.slice(0, 8)}`,
      status: "SUCCESS",
    },
  });

  revalidatePath("/dispatch");
  revalidatePath("/workforce");
}

export async function withdrawOfferAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const offerId = String(formData.get("offerId") ?? "");
  if (!offerId) return;

  await prisma.shiftOffer.deleteMany({
    where: { id: offerId, agencyId: user.agencyId, status: "OFFERED" },
  });

  revalidatePath("/dispatch");
  revalidatePath("/workforce");
}