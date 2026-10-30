import { prisma } from "@/lib/db";

import { toE164 } from "./phone";
import { configOf, getIntegration, logIntegration, secretsOf } from "./store";
import { sendSms, type TwilioConfig, type TwilioSecrets } from "./twilio";
import type { SmsResult } from "./sms-offers";

/** The agency's connected texting, or null when SMS isn't set up. */
export async function smsSender(agencyId: string) {
  const integration = await getIntegration(agencyId, "twilio");
  const config = configOf<TwilioConfig>(integration);
  const secrets = secretsOf<TwilioSecrets>(integration);
  if (!integration || !secrets || !config.from) return null;
  return { integration, config, secrets, from: config.from };
}

/**
 * Texts one carer, unless they've texted STOP or have no mobile number.
 * Every text is kept in SmsMessage. Never throws.
 */
export async function textStaff(agencyId: string, staffId: string, body: string, what = "Text"): Promise<SmsResult> {
  try {
    const sender = await smsSender(agencyId);
    if (!sender) return { sent: false, reason: "SMS isn't connected" };
    const staff = await prisma.staffProfile.findFirst({ where: { id: staffId, agencyId }, select: { firstName: true, lastName: true, phone: true, smsOptOutAt: true } });
    if (!staff) return { sent: false, reason: "No such carer" };
    if (staff.smsOptOutAt) return { sent: false, reason: `${staff.firstName} has opted out of texts` };
    const phone = toE164(staff.phone);
    if (!phone) return { sent: false, reason: `${staff.firstName} has no mobile number on file` };
    return await sendAndKeep(agencyId, staffId, phone, body, `${what} to ${staff.firstName} ${staff.lastName}`);
  } catch (error) {
    console.error("text to carer failed", error);
    return { sent: false, reason: "Something went wrong sending the text" };
  }
}

/** Sends a text the agency writes to a number (a carer's), and keeps it. */
export async function sendAndKeep(agencyId: string, staffId: string | null, phone: string, body: string, label: string): Promise<SmsResult> {
  const sender = await smsSender(agencyId);
  if (!sender) return { sent: false, reason: "SMS isn't connected" };
  try {
    const { sid } = await sendSms(sender.secrets, sender.from, phone, body);
    await prisma.smsMessage.create({ data: { agencyId, staffId, direction: "OUT", phone, body, providerId: sid, status: "SENT" } });
    await logIntegration(sender.integration, "sms.out", true, label, { health: false });
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Twilio didn't accept the message";
    await prisma.smsMessage.create({ data: { agencyId, staffId, direction: "OUT", phone, body, status: "FAILED" } });
    const status = (error as { status?: number }).status;
    await logIntegration(sender.integration, "sms.out", false, `${label} failed: ${reason}`, { health: status === 401 || status === 403 });
    return { sent: false, reason };
  }
}

/** The agency's carer who has this mobile number, matched however it was typed in. */
export async function staffByPhone(agencyId: string, phone: string) {
  const want = toE164(phone) ?? phone;
  const staff = await prisma.staffProfile.findMany({
    where: { agencyId, phone: { not: null }, status: { not: "INACTIVE" } },
    select: { id: true, firstName: true, lastName: true, phone: true, smsOptOutAt: true },
  });
  return staff.find((s) => toE164(s.phone) === want) ?? null;
}

// Not CANCEL or END: a carer texting "cancel" about a shift mustn't silently lose their texts.
const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "QUIT", "OPTOUT"]);
const START_WORDS = new Set(["START", "UNSTOP", "SUBSCRIBE", "OPTIN"]);

/** STOP or START on its own: the opt-out it asks for, or null for any other text. */
export function optOutWord(body: string): "stop" | "start" | null {
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return STOP_WORDS.has(word) ? "stop" : START_WORDS.has(word) ? "start" : null;
}
