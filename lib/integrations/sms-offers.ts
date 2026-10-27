import { randomInt } from "node:crypto";

import type { Integration } from "@prisma/client";

import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { respondToOffer, type OfferOutcome } from "@/lib/offers";

import { toE164 } from "./phone";
import { configOf, getIntegration, logIntegration, secretsOf } from "./store";
import { parseOfferReply, sendSms, type TwilioConfig, type TwilioSecrets } from "./twilio";

const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });

/** Offers stay answerable by text for this long after they were sent. */
const REPLY_WINDOW_MS = 7 * 86_400_000;

export function offerText(input: {
  agencyName: string;
  startAt: Date;
  endAt: Date;
  role: string;
  place: string;
  code: string;
}): string {
  const when = `${day.format(input.startAt)}, ${time.format(input.startAt)}–${time.format(input.endAt)}`;
  return `${input.agencyName}: shift offer, ${when}, ${input.role} at ${input.place}. Reply YES ${input.code} to take it or NO ${input.code} to pass. First to accept gets it.`;
}

export interface SmsResult {
  sent: boolean;
  reason?: string;
}

/**
 * Texts a shift offer to the carer, if the agency has SMS connected with
 * offers switched on and the carer has a mobile number. Never throws: the
 * offer still stands in the Workers app if the text can't be sent.
 */
export async function sendOfferSms(agencyId: string, offerId: string): Promise<SmsResult> {
  try {
    const integration = await getIntegration(agencyId, "twilio");
    const config = configOf<TwilioConfig>(integration);
    const secrets = secretsOf<TwilioSecrets>(integration);
    if (!integration || !secrets || !config.from || config.offers === false) return { sent: false, reason: "SMS isn't connected" };

    const offer = await prisma.shiftOffer.findFirst({
      where: { id: offerId, agencyId, status: "OFFERED" },
      include: { staff: true, shift: { include: { client: true, site: true } }, agency: { select: { name: true } } },
    });
    if (!offer) return { sent: false, reason: "The offer is no longer open" };
    const phone = toE164(offer.staff.phone);
    if (!phone) return { sent: false, reason: `${offer.staff.firstName} has no mobile number on file` };

    const code = String(randomInt(1000, 10000));
    const place = [clientName(offer.shift.client, ""), offer.shift.site?.name].filter(Boolean).join(", ") || offer.shift.title;
    const body = offerText({
      agencyName: offer.agency.name,
      startAt: offer.shift.startAt,
      endAt: offer.shift.endAt,
      role: offer.shift.role,
      place,
      code,
    });

    try {
      const { sid } = await sendSms(secrets, config.from, phone, body);
      await prisma.smsMessage.create({
        data: { agencyId, staffId: offer.staffId, offerId, direction: "OUT", phone, body, code, providerId: sid, status: "SENT" },
      });
      await logIntegration(integration, "sms.out", true, `Offer texted to ${offer.staff.firstName} ${offer.staff.lastName}`, { health: false });
      return { sent: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Twilio didn't accept the message";
      await prisma.smsMessage.create({
        data: { agencyId, staffId: offer.staffId, offerId, direction: "OUT", phone, body, code, status: "FAILED" },
      });
      // A bad number is one carer's problem; rejected credentials are the connection's.
      const status = (error as { status?: number }).status;
      await logIntegration(integration, "sms.out", false, `Couldn't text ${offer.staff.firstName} ${offer.staff.lastName}: ${reason}`, {
        health: status === 401 || status === 403,
      });
      return { sent: false, reason };
    }
  } catch (error) {
    console.error("offer sms failed", error);
    return { sent: false, reason: "Something went wrong sending the text" };
  }
}

const REPLIES: Record<OfferOutcome, string> = {
  accepted: "Thanks, the shift is yours. You'll find the details in the Pleasant Workers app.",
  declined: "Thanks, we've let the team know you can't do it.",
  overlap: "That shift overlaps one you're already booked on, so we couldn't give it to you.",
  taken: "Sorry, someone else accepted that shift first.",
  gone: "That offer has closed.",
};

/**
 * Handles a text from a carer. Answers to shift offers update the offer;
 * anything else is logged for the team. Returns the reply to send, if any.
 */
export async function handleInboundSms(integration: Integration, from: string, body: string, providerId: string | null): Promise<string | null> {
  const agencyId = integration.agencyId;
  const phone = toE164(from) ?? from;
  const reply = parseOfferReply(body);

  // Offers texted to this number recently, newest first, still open.
  const sent = await prisma.smsMessage.findMany({
    where: { agencyId, phone, direction: "OUT", status: "SENT", offerId: { not: null }, createdAt: { gte: new Date(Date.now() - REPLY_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const openIds = new Set(
    (await prisma.shiftOffer.findMany({ where: { id: { in: sent.map((m) => m.offerId!) }, status: "OFFERED" }, select: { id: true } })).map((o) => o.id),
  );
  const open = sent.filter((m) => openIds.has(m.offerId!));

  await prisma.smsMessage.create({
    data: { agencyId, staffId: sent[0]?.staffId ?? null, direction: "IN", phone, body: body.slice(0, 1600), providerId, status: "RECEIVED" },
  });

  if (!reply) {
    await logIntegration(integration, "sms.in", true, `Text from ${phone}: "${body.slice(0, 120)}"`, { health: false });
    return open.length > 0 ? `To answer the shift offer, reply YES ${open[0].code} or NO ${open[0].code}.` : null;
  }

  const target = reply.code ? open.find((m) => m.code === reply.code) : open.length === 1 ? open[0] : undefined;
  if (!target && reply.code) {
    // A code for an offer that has since closed.
    const closed = sent.find((m) => m.code === reply.code);
    if (closed) return REPLIES.gone;
  }
  if (!target) {
    if (open.length === 0) return "There's no open shift offer to answer.";
    return `You have ${open.length} open offers. Reply YES or NO with the 4-digit code from the offer, e.g. YES ${open[0].code}.`;
  }

  const outcome = await respondToOffer({ agencyId, staffId: target.staffId!, offerId: target.offerId!, accept: reply.accept });
  await logIntegration(integration, "sms.in", true, `Reply ${reply.accept ? "YES" : "NO"} from ${phone}: offer ${outcome}`, { health: false });
  return REPLIES[outcome];
}
