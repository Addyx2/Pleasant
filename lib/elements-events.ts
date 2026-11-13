import { Prisma } from "@prisma/client";

import { coverAbsence } from "@/lib/absence";
import { prisma } from "@/lib/db";

// What Pleasant does with each event the Elements console sends.

export interface ElementsWebhook {
  id: string;
  type: string;
  installation: { id: string; module: string; tenantId: string };
  data: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Events that need a person in the agency, shown on Qualifiers (the home page) until marked done. */
function attention(event: ElementsWebhook): { needsAttention: boolean; urgent: boolean } {
  switch (event.type) {
    case "gateway.enquiry.received":
    case "gateway.message.left":
    case "gateway.absence.reported":
      return { needsAttention: true, urgent: false };
    case "gateway.handover.requested":
      return { needsAttention: true, urgent: event.data.urgent === true };
    case "peak.reward.redeemed":
      // A cash-out is paid through payroll automatically; a perk must be given by hand.
      return { needsAttention: event.data.kind !== "cash_out", urgent: false };
    default:
      return { needsAttention: false, urgent: false };
  }
}

export type HandleResult = { ok: true; duplicate?: boolean } | { ok: false; status: number; error: string };

export async function handleElementsWebhook(event: ElementsWebhook): Promise<HandleResult> {
  const agencyId = event.installation.tenantId;
  const addon = await prisma.agencyAddon.findFirst({
    where: { agencyId, elementsInstallationId: event.installation.id },
    select: { id: true },
  });
  if (!addon) return { ok: false, status: 404, error: "Unknown installation" };

  const flags = attention(event);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.elementsEvent.create({
        data: { agencyId, eventId: event.id, type: event.type, data: event.data as Prisma.InputJsonValue, ...flags },
      });

      if (event.type === "peak.reward.redeemed" && event.data.kind === "cash_out") {
        const pence = typeof event.data.amountPence === "number" ? Math.round(event.data.amountPence) : 0;
        const staffId = str(event.data.personId);
        const staff = staffId ? await tx.staffProfile.findFirst({ where: { id: staffId, agencyId }, select: { id: true } }) : null;
        if (pence > 0 && staff) {
          await tx.payAddition.create({
            data: {
              agencyId,
              staffId: staff.id,
              label: `Peak reward: ${str(event.data.reward) ?? "cash out"}`,
              amount: new Prisma.Decimal(pence).div(100),
              sourceRef: `peak:${str(event.data.redemptionId) ?? event.id}`,
            },
          });
        }
      }

      // When a conversation is closed, its hand-over request no longer needs anyone.
      if (event.type === "gateway.call.completed" && str(event.data.conversationId)) {
        await tx.elementsEvent.updateMany({
          where: {
            agencyId,
            type: "gateway.handover.requested",
            resolvedAt: null,
            data: { path: ["conversationId"], equals: str(event.data.conversationId)! },
          },
          data: { resolvedAt: new Date(), resolvedBy: "Closed in Gateway" },
        });
      }
    });
  } catch (error) {
    // The same event delivered twice: already handled.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: true, duplicate: true };
    throw error;
  }

  // A carer can't make a shift: free it and start finding cover, then say what was done.
  if (event.type === "gateway.absence.reported") {
    try {
      const cover = await coverAbsence(agencyId, { staffId: str(event.data.personId) ?? null, date: str(event.data.date) ?? null });
      await prisma.elementsEvent.update({
        where: { eventId: event.id },
        data: { data: { ...event.data, cover: cover as unknown as Prisma.InputJsonValue }, urgent: cover.shifts.length === 0 || cover.shifts.some((s) => !s.covering) },
      });
    } catch (error) {
      console.error(JSON.stringify({ event: "absence_cover_failed", agencyId, error: error instanceof Error ? error.message : String(error) }));
      await prisma.elementsEvent.update({ where: { eventId: event.id }, data: { urgent: true } }).catch(() => undefined);
    }
  }
  return { ok: true };
}
