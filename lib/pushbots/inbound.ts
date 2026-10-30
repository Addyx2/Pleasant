import { after } from "next/server";

import { prisma } from "@/lib/db";
import { toE164 } from "@/lib/integrations/phone";
import { optOutWord, staffAnywhereByPhone } from "@/lib/integrations/sms";
import { handleInboundSms } from "@/lib/integrations/sms-offers";
import { parseOfferReply } from "@/lib/integrations/twilio";

import { handleOfficeText, officeUserByMobile } from "./office";

// Where a text to a Pushbot number goes. An agency's own Pushbot number
// belongs to that agency: office staff's registered mobiles reach the office
// side, everyone else is a carer. A text to the shared Pushbots number is
// matched to an agency: by the offer code in it, else the agency that last
// texted that number, else any agency the sender works for.

type Later = (work: () => Promise<unknown>) => void;
const defaultLater: Later = (work) => after(work);

/** A text to one agency's Pushbot number. Returns the reply to send straight back, if any. */
export async function inboundToPushbot(pushbotId: string, from: string, body: string, providerId: string | null, later: Later = defaultLater): Promise<string | null> {
  const pushbot = await prisma.pushbot.findUnique({ where: { id: pushbotId } });
  if (!pushbot) return null;
  const phone = toE164(from) ?? from;
  const office = await officeUserByMobile(pushbot.agencyId, phone);
  if (office) {
    await handleOfficeText(office, pushbot, phone, body, providerId, later);
    return null;
  }
  return handleInboundSms({ agencyId: pushbot.agencyId, integration: null }, phone, body, providerId, later);
}

/** A text to the shared Pushbots number. */
export async function inboundToShared(from: string, body: string, providerId: string | null, later: Later = defaultLater): Promise<string | null> {
  const phone = toE164(from) ?? from;

  // STOP on the shared number stops texts from it for every agency.
  const opt = optOutWord(body);
  if (opt) {
    const staff = await staffAnywhereByPhone(phone);
    for (const s of staff) {
      await prisma.staffProfile.update({ where: { id: s.id }, data: { smsOptOutAt: opt === "stop" ? new Date() : null } });
      await prisma.smsMessage.create({ data: { agencyId: s.agencyId, staffId: s.id, direction: "IN", phone, body: body.slice(0, 1600), providerId, status: "RECEIVED" } });
    }
    return opt === "stop"
      ? "You won't get any more texts from this number. Offers still show in your app. Text START to turn texts back on."
      : "Texts from this number are back on. Text STOP at any time to stop them.";
  }

  const agencyId = await agencyFor(phone, body);
  if (!agencyId) return null; // not anyone we text
  const office = await officeUserByMobile(agencyId, phone);
  if (office) {
    const pushbot = await prisma.pushbot.findUnique({ where: { agencyId } });
    if (pushbot) {
      await handleOfficeText(office, pushbot, phone, body, providerId, later);
      return null;
    }
  }
  return handleInboundSms({ agencyId, integration: null }, phone, body, providerId, later);
}

async function agencyFor(phone: string, body: string): Promise<string | null> {
  const code = parseOfferReply(body)?.code;
  if (code) {
    const offer = await prisma.smsMessage.findFirst({ where: { phone, code, direction: "OUT" }, orderBy: { createdAt: "desc" }, select: { agencyId: true } });
    if (offer) return offer.agencyId;
  }
  const last = await prisma.smsMessage.findFirst({ where: { phone, direction: "OUT" }, orderBy: { createdAt: "desc" }, select: { agencyId: true } });
  if (last) return last.agencyId;
  const staff = await staffAnywhereByPhone(phone);
  if (staff[0]) return staff[0].agencyId;
  const users = await prisma.user.findMany({ where: { mobile: { not: null }, deactivatedAt: null }, select: { agencyId: true, mobile: true } });
  return users.find((u) => toE164(u.mobile) === phone)?.agencyId ?? null;
}
