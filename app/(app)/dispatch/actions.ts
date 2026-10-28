"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOps } from "@/lib/auth";
import { unavailableReason } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { sendOfferSms } from "@/lib/integrations/sms-offers";

export async function offerShiftAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const shiftId = String(formData.get("shiftId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  if (!shiftId || !staffId) return;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, agencyId: user.agencyId },
    select: { id: true, startAt: true, endAt: true },
  });
  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!shift || !staff) return;
  // The conflict shield: don't offer shifts to carers when they've said they can't work.
  if (await unavailableReason(user.agencyId, staffId, shift.startAt, shift.endAt)) redirect("/dispatch?result=unavailable");

  const offer = await prisma.shiftOffer.upsert({
    where: { shiftId_staffId: { shiftId, staffId } },
    create: { agencyId: user.agencyId, shiftId, staffId },
    update: { status: "OFFERED", respondedAt: null },
  });
  // Also by text, if the agency has SMS connected. The offer stands either way.
  await sendOfferSms(user.agencyId, offer.id);

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
  revalidatePath("/shifts");
  revalidatePath("/shifts/calendar");
  revalidatePath("/workforce");
}

export async function withdrawOfferAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const offerId = String(formData.get("offerId") ?? "");
  if (!offerId) return;

  await prisma.shiftOffer.deleteMany({
    where: { id: offerId, agencyId: user.agencyId, status: "OFFERED" },
  });

  revalidatePath("/dispatch");
  revalidatePath("/workforce");
}