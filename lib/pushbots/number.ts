import { prisma } from "@/lib/db";
import { aultrumTwilio } from "@/lib/integrations/sms";
import { buyUkMobile, pointNumber, ukMobileBundle } from "@/lib/integrations/twilio";
import { absoluteUrl } from "@/lib/url";

import { chargeAllowance } from "./billing";

// Each agency's Pushbot gets a UK mobile number of its own, bought by Pleasant
// on Aultrum's Twilio account (the TWILIO_* settings in Vercel) the moment the
// agency creates it, with its replies already pointed back here. The agency
// never sees Twilio, and nobody buys numbers by hand. UK numbers need an
// approved UK mobile regulatory bundle on that account; Pleasant finds it
// through Twilio's API. Until a number is bought, the Pushbot texts from the
// shared Pushbots number if TWILIO_FROM is set, and otherwise waits.

export const pushbotWebhookPath = (pushbotId: string) => `/api/webhooks/twilio/pushbot/${pushbotId}`;
export const pushbotVoicePath = (pushbotId: string) => `/api/webhooks/twilio/pushbot/${pushbotId}/voice`;

export async function provisionNumber(pushbotId: string): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const pushbot = await prisma.pushbot.findUnique({ where: { id: pushbotId }, include: { agency: { select: { name: true } } } });
  if (!pushbot) return { ok: false, error: "No such Pushbot" };
  const secrets = aultrumTwilio();
  const smsUrl = await absoluteUrl(pushbotWebhookPath(pushbot.id));
  const voiceUrl = await absoluteUrl(pushbotVoicePath(pushbot.id));

  if (pushbot.numberSid && pushbot.number && secrets) {
    // Already has one: make sure it still points here (e.g. after a domain change).
    await pointNumber(secrets, pushbot.numberSid, smsUrl, voiceUrl).catch(() => undefined);
    return { ok: true, number: pushbot.number };
  }
  if (!secrets) {
    // For Aultrum: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN aren't set on this deployment.
    console.error(JSON.stringify({ event: "pushbot_number_failed", agencyId: pushbot.agencyId, error: "Twilio settings missing" }));
    const error = "Aultrum hasn't finished setting up texting yet. Offers still reach carers' apps meanwhile.";
    await prisma.pushbot.update({ where: { id: pushbot.id }, data: { numberStatus: "failed", numberError: error } });
    return { ok: false, error };
  }
  try {
    const bundle = await ukMobileBundle(secrets);
    if (!bundle) throw new Error("No approved UK mobile regulatory bundle on the account");
    const bought = await buyUkMobile(secrets, { friendlyName: `Pushbot · ${pushbot.agency.name}`, smsUrl, voiceUrl, ...bundle });
    await prisma.pushbot.update({ where: { id: pushbot.id }, data: { number: bought.number, numberSid: bought.sid, numberStatus: "active", numberError: null } });
    await prisma.agentLog.create({ data: { agencyId: pushbot.agencyId, agentName: "PUSHBOTS", action: "NUMBER_BOUGHT", details: JSON.stringify({ number: bought.number }), status: "SUCCESS" } });
    await chargeAllowance(pushbot.agencyId, "number_month", 1, numberMonthKey(bought.sid));
    return { ok: true, number: bought.number };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Twilio didn't sell a number";
    // The agency sees a plain line; Aultrum's logs get Twilio's own words
    // (a missing bundle means Twilio hasn't approved Aultrum's UK mobile bundle yet).
    const meanwhile = process.env.TWILIO_FROM?.trim() ? " It texts from Aultrum's shared Pushbots number meanwhile." : " Offers still reach carers' apps meanwhile.";
    const error = /bundle|regulat|address/i.test(raw)
      ? `Its number is waiting on Aultrum's UK number approval with the phone network.${meanwhile}`
      : `Its number couldn't be set up just now.${meanwhile} Try again later.`;
    await prisma.pushbot.update({ where: { id: pushbot.id }, data: { numberStatus: "failed", numberError: error.slice(0, 500) } });
    console.error(JSON.stringify({ event: "pushbot_number_failed", agencyId: pushbot.agencyId, error: raw }));
    return { ok: false, error };
  }
}

/**
 * Pushbots still waiting for a number (e.g. created before Twilio approved
 * Aultrum's UK bundle) try again by themselves, each at most once an hour,
 * so nobody has to press "Try again" once approval comes through.
 */
export async function retryWaitingNumbers(now = new Date()): Promise<number> {
  if (!aultrumTwilio()) return 0;
  const waiting = await prisma.pushbot.findMany({ where: { enabled: true, numberStatus: "failed", updatedAt: { lt: new Date(now.getTime() - 3_600_000) } }, select: { id: true }, take: 20 });
  let got = 0;
  for (const p of waiting) if ((await provisionNumber(p.id)).ok) got++;
  return got;
}

const month = (now = new Date()) => now.toISOString().slice(0, 7);
const numberMonthKey = (numberSid: string, now = new Date()) => `number:${numberSid}:${month(now)}`;
const NUMBER_CHARGE = "pushbots-number-charge";

/** Each Pushbot's number costs its Allowance once a month: run on the first tick of each month. */
export async function chargeNumbersMonthly(now = new Date()): Promise<number> {
  const done = await prisma.serviceKey.findUnique({ where: { name: NUMBER_CHARGE } });
  if (done?.value === month(now)) return 0;
  await prisma.serviceKey.upsert({ where: { name: NUMBER_CHARGE }, create: { name: NUMBER_CHARGE, value: month(now) }, update: { value: month(now) } });
  const bots = await prisma.pushbot.findMany({ where: { numberStatus: "active", numberSid: { not: null } }, select: { agencyId: true, numberSid: true } });
  for (const b of bots) await chargeAllowance(b.agencyId, "number_month", 1, numberMonthKey(b.numberSid!, now));
  return bots.length;
}
