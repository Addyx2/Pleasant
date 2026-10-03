"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function respondToOfferAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (user.role !== "STAFF" || !staffId) redirect("/workforce");

  const offerId = String(formData.get("offerId") ?? "");
  const accept = formData.get("accept") === "1";

  const offer = await prisma.shiftOffer.findFirst({
    where: { id: offerId, agencyId: user.agencyId, staffId, status: "OFFERED" },
    include: { shift: { select: { id: true, startAt: true, endAt: true, title: true } } },
  });
  if (!offer) redirect("/workforce?result=gone");

  if (!accept) {
    await prisma.shiftOffer.update({
      where: { id: offerId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    revalidatePath("/workforce");
    redirect("/workforce?result=declined");
  }

  // Conflict guard: accepting an overlapping shift is never allowed.
  const clash = await prisma.shift.findFirst({
    where: {
      agencyId: user.agencyId,
      staffId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      startAt: { lt: offer.shift.endAt },
      endAt: { gt: offer.shift.startAt },
      id: { not: offer.shift.id },
    },
    select: { id: true },
  });
  if (clash) {
    await prisma.shiftOffer.update({
      where: { id: offerId },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    revalidatePath("/workforce");
    redirect("/workforce?result=overlap");
  }

  await prisma.$transaction([
    prisma.shift.update({
      where: { id: offer.shift.id },
      data: { staffId, status: "ASSIGNED" },
    }),
    prisma.shiftOffer.update({
      where: { id: offerId },
      data: { status: "ACCEPTED", respondedAt: new Date() },
    }),
  ]);

  revalidatePath("/workforce");
  redirect("/workforce?result=accepted");
}