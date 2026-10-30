import { prisma } from "@/lib/db";

export type OfferOutcome = "accepted" | "declined" | "overlap" | "taken" | "gone";

/**
 * A carer's answer to a shift offer, from the Workers app or a text reply.
 * The first carer to accept gets the shift; later acceptances are told it's
 * taken, and an offer that clashes with the carer's other shifts is declined.
 */
export async function respondToOffer(input: {
  agencyId: string;
  staffId: string;
  offerId: string;
  accept: boolean;
}): Promise<OfferOutcome> {
  const { agencyId, staffId, offerId } = input;
  const offer = await prisma.shiftOffer.findFirst({
    where: { id: offerId, agencyId, staffId, status: "OFFERED" },
    include: { shift: { select: { id: true, startAt: true, endAt: true } } },
  });
  if (!offer) return "gone";

  const close = (status: "DECLINED" | "ACCEPTED") =>
    prisma.shiftOffer.update({ where: { id: offerId }, data: { status, respondedAt: new Date() } });

  if (!input.accept) {
    await close("DECLINED");
    return "declined";
  }

  // Conflict guard: accepting an overlapping shift is never allowed.
  const clash = await prisma.shift.findFirst({
    where: {
      agencyId,
      staffId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      startAt: { lt: offer.shift.endAt },
      endAt: { gt: offer.shift.startAt },
      id: { not: offer.shift.id },
    },
    select: { id: true },
  });
  if (clash) {
    await close("DECLINED");
    return "overlap";
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // Only an open, unassigned shift can be taken, so two carers accepting at
    // once can't both get it.
    const taken = await tx.shift.updateMany({
      where: { id: offer.shift.id, agencyId, staffId: null, status: "OPEN" },
      data: { staffId, status: "ASSIGNED" },
    });
    if (taken.count === 0) {
      await tx.shiftOffer.update({ where: { id: offerId }, data: { status: "DECLINED", respondedAt: new Date() } });
      return "taken" as const;
    }
    await tx.shiftOffer.update({ where: { id: offerId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
    return "accepted" as const;
  });
  // Filled: if Pushbots was filling it, end the campaign and tell the others.
  // (Imported here, as campaigns themselves make offers.)
  if (outcome === "accepted") {
    const { settleShift } = await import("@/lib/pushbots/campaign");
    await settleShift(offer.shift.id).catch((error) => console.error("pushbots settle failed", error));
  }
  return outcome;
}
