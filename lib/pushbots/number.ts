import { prisma } from "@/lib/db";
import { sharedSender } from "@/lib/integrations/sms";
import { buyUkMobile, pointNumber } from "@/lib/integrations/twilio";
import { absoluteUrl } from "@/lib/url";

// Each agency's Pushbot gets a UK mobile number of its own, bought by Pleasant
// on Aultrum's Twilio account (the TWILIO_* settings in Vercel) the moment the
// agency creates it, with its replies already pointed back here. The agency
// never sees Twilio. UK numbers need a regulatory bundle on that account:
// TWILIO_BUNDLE_SID (and TWILIO_ADDRESS_SID if Twilio asks for one). Until a
// number is bought, the Pushbot texts from the shared Pushbots number.

export const pushbotWebhookPath = (pushbotId: string) => `/api/webhooks/twilio/pushbot/${pushbotId}`;

export async function provisionNumber(pushbotId: string): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const pushbot = await prisma.pushbot.findUnique({ where: { id: pushbotId }, include: { agency: { select: { name: true } } } });
  if (!pushbot) return { ok: false, error: "No such Pushbot" };
  const account = sharedSender();
  const smsUrl = await absoluteUrl(pushbotWebhookPath(pushbot.id));

  if (pushbot.numberSid && pushbot.number && account) {
    // Already has one: make sure it still points here (e.g. after a domain change).
    await pointNumber(account.secrets, pushbot.numberSid, smsUrl).catch(() => undefined);
    return { ok: true, number: pushbot.number };
  }
  if (!account) {
    // For Aultrum: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM aren't set on this deployment.
    console.error(JSON.stringify({ event: "pushbot_number_failed", agencyId: pushbot.agencyId, error: "Twilio settings missing" }));
    const error = "Aultrum hasn't finished setting up texting yet. Offers still reach carers' apps meanwhile.";
    await prisma.pushbot.update({ where: { id: pushbot.id }, data: { numberStatus: "failed", numberError: error } });
    return { ok: false, error };
  }
  try {
    const bought = await buyUkMobile(account.secrets, {
      friendlyName: `Pushbot · ${pushbot.agency.name}`,
      smsUrl,
      bundleSid: process.env.TWILIO_BUNDLE_SID?.trim() || undefined,
      addressSid: process.env.TWILIO_ADDRESS_SID?.trim() || undefined,
    });
    await prisma.pushbot.update({ where: { id: pushbot.id }, data: { number: bought.number, numberSid: bought.sid, numberStatus: "active", numberError: null } });
    await prisma.agentLog.create({ data: { agencyId: pushbot.agencyId, agentName: "PUSHBOTS", action: "NUMBER_BOUGHT", details: JSON.stringify({ number: bought.number }), status: "SUCCESS" } });
    return { ok: true, number: bought.number };
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Twilio didn't sell a number";
    // The agency sees a plain line; Aultrum's logs get Twilio's own words
    // (a missing UK regulatory bundle means setting TWILIO_BUNDLE_SID once it's approved).
    const error = /bundle|regulat|address/i.test(raw)
      ? "Its number is waiting on Aultrum's UK number approval with the phone network. It texts from Aultrum's shared Pushbots number meanwhile."
      : "Its number couldn't be set up just now. It texts from Aultrum's shared Pushbots number meanwhile; try again later.";
    await prisma.pushbot.update({ where: { id: pushbot.id }, data: { numberStatus: "failed", numberError: error.slice(0, 500) } });
    console.error(JSON.stringify({ event: "pushbot_number_failed", agencyId: pushbot.agencyId, error: raw }));
    return { ok: false, error };
  }
}
