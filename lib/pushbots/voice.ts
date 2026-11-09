import { prisma } from "@/lib/db";
import { displayPhone, toE164 } from "@/lib/integrations/phone";
import { dialTwiml, say } from "@/lib/integrations/twilio";
import { absoluteUrl } from "@/lib/url";

import { chargeAllowance } from "./billing";

// Calls to a Pushbot number. Pushbots work by text, but carers ring the
// number that texts them. With an office phone on the agency, the call is
// put through to it (paid from the Allowance by the minute, at most 20
// minutes); otherwise, or when the Allowance is empty, a short message says
// it's a texting number and gives the office phone if there is one.

const MAX_CALL_SECS = 20 * 60;
export const pushbotCallDonePath = (pushbotId: string) => `/api/webhooks/twilio/pushbot/${pushbotId}/voice/done`;

/** Digits read out one by one in their groups, so a phone number is spoken clearly: "0 7 7 0 0, 9 0 0 1 2 3". */
export function spokenPhone(e164: string): string {
  return displayPhone(e164).split(" ").map((group) => group.split("").join(" ")).join(", ");
}

function textOnly(agencyName: string, botName: string, office: string | null): string {
  return say(`Hello, this is ${botName} for ${agencyName}. This number is for texts only, so please send a text instead.${office ? ` To speak to someone, call the office on ${spokenPhone(office)}.` : ""} Thank you.`) + "<Hangup/>";
}

export async function answerPushbotCall(pushbotId: string, callSid: string | undefined): Promise<string> {
  const pushbot = await prisma.pushbot.findUnique({ where: { id: pushbotId }, include: { agency: { select: { id: true, name: true, phone: true } } } });
  if (!pushbot) return say("Sorry, this number isn't in use.") + "<Hangup/>";
  const office = toE164(pushbot.agency.phone);
  if (!office || !pushbot.enabled) return textOnly(pushbot.agency.name, pushbot.name, office);
  const paid = await chargeAllowance(pushbot.agencyId, "call_minute", 1, callSid ? `call:${callSid}:0` : undefined);
  if (!paid.ok) return textOnly(pushbot.agency.name, pushbot.name, office);
  return say(`Hello, you've reached ${pushbot.agency.name}. Putting you through to the office.`) + dialTwiml(office, { action: await absoluteUrl(pushbotCallDonePath(pushbot.id)), timeLimitSecs: MAX_CALL_SECS });
}

/** After the office was rung: charge the minutes beyond the first, and tell the caller if nobody answered. */
export async function afterPushbotCall(pushbotId: string, fields: Record<string, string>): Promise<string> {
  const pushbot = await prisma.pushbot.findUnique({ where: { id: pushbotId }, include: { agency: { select: { name: true } } } });
  if (!pushbot) return "<Hangup/>";
  const secs = Number(fields.DialCallDuration ?? 0);
  const minutes = Math.ceil(secs / 60);
  if (minutes > 1 && fields.CallSid) await chargeAllowance(pushbot.agencyId, "call_minute", minutes - 1, `call:${fields.CallSid}:rest`);
  if (fields.DialCallStatus === "completed") return "<Hangup/>";
  return say(`Sorry, nobody at ${pushbot.agency.name} could answer just now. Please send a text to this number and they'll get back to you.`) + "<Hangup/>";
}

/** Calls to the shared Pushbots number, which texts for many agencies. */
export const sharedCallAnswer = () =>
  say("Hello. This number sends texts for care agencies using Pleasant, and it only handles texts. Please reply by text, or call your agency's office directly. Thank you.") + "<Hangup/>";
