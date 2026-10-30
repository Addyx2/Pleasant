import type { Integration } from "@prisma/client";

import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/url";

import { toE164 } from "./phone";
import { configOf, getIntegration, logIntegration, secretsOf } from "./store";
import { sendSms, setIncomingWebhook, type TwilioConfig, type TwilioSecrets } from "./twilio";
import type { SmsResult } from "./sms-offers";

// Who texts an agency's carers. Each agency's Pushbot texts from a number of
// its own, bought on Aultrum's Twilio account (lib/pushbots/number.ts); until
// that's done, from the shared Pushbots number (TWILIO_FROM). An agency that
// connected its own Twilio in Settings keeps using that. A Pushbot switched
// off, or an agency without one, texts nobody: offers still reach the app.

export interface Sender {
  secrets: TwilioSecrets;
  /** E.164 number or a Messaging Service SID ("MG..."). */
  from: string;
  /** The agency's own connection, or null for Aultrum's account. */
  integration: Integration | null;
  shared: boolean;
}

/** Aultrum's Twilio account and shared Pushbots number, from the deployment's settings, or null if they aren't set. */
export function sharedSender(): Omit<Sender, "integration"> | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = (process.env.TWILIO_FROM ?? process.env.TWILIO_PHONE_NUMBER ?? process.env.TWILIO_MESSAGING_SERVICE_SID)?.trim();
  if (!accountSid || !authToken || !from) return null;
  return { secrets: { accountSid, authToken }, from, shared: true };
}

export const SHARED_WEBHOOK_PATH = "/api/webhooks/twilio/shared";
const SHARED_WEBHOOK_KEY = "twilio-shared-webhook";

/**
 * Points the shared number's incoming texts at Pleasant, once per address,
 * so carers' replies arrive with nobody setting it up in Twilio.
 */
async function ensureSharedWebhook(sender: Omit<Sender, "integration">): Promise<void> {
  if (!sender.from.startsWith("+")) return; // a Messaging Service is pointed in Twilio's console
  const url = await absoluteUrl(SHARED_WEBHOOK_PATH);
  const done = await prisma.serviceKey.findUnique({ where: { name: SHARED_WEBHOOK_KEY } });
  if (done?.value === `${sender.from} ${url}`) return;
  if (await setIncomingWebhook(sender.secrets, sender.from, url).catch(() => false)) {
    await prisma.serviceKey.upsert({ where: { name: SHARED_WEBHOOK_KEY }, create: { name: SHARED_WEBHOOK_KEY, value: `${sender.from} ${url}` }, update: { value: `${sender.from} ${url}` } });
  }
}

/** How this agency texts right now, or null when it doesn't. */
export async function smsSender(agencyId: string): Promise<Sender | null> {
  const integration = await getIntegration(agencyId, "twilio");
  const config = configOf<TwilioConfig>(integration);
  const secrets = secretsOf<TwilioSecrets>(integration);
  if (integration && secrets && config.from) return config.offers === false ? null : { integration, secrets, from: config.from, shared: false };

  const pushbot = await prisma.pushbot.findUnique({ where: { agencyId }, select: { enabled: true, number: true, numberStatus: true } });
  if (!pushbot?.enabled) return null;
  const account = sharedSender();
  if (!account) return null;
  if (pushbot.numberStatus === "active" && pushbot.number) return { secrets: account.secrets, from: pushbot.number, integration: null, shared: false };
  await ensureSharedWebhook(account).catch((error) => console.error("shared Twilio webhook not set", error));
  return { ...account, integration: null };
}

/** Logs a text against the agency's own connection, or as a JSON line for the shared number. */
export async function logSms(sender: Pick<Sender, "integration"> & { agencyId: string }, event: string, ok: boolean, summary: string, health = false): Promise<void> {
  if (sender.integration) await logIntegration(sender.integration, event, ok, summary, { health });
  else console.log(JSON.stringify({ event: `pushbots_${event.replace(".", "_")}`, agencyId: sender.agencyId, ok, summary }));
}

/**
 * Texts one carer, unless they've texted STOP or have no mobile number.
 * Every text is kept in SmsMessage. Never throws.
 */
export async function textStaff(agencyId: string, staffId: string, body: string, what = "Text"): Promise<SmsResult> {
  try {
    const sender = await smsSender(agencyId);
    if (!sender) return { sent: false, reason: "Texting is off or isn't set up" };
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

/** Sends a text the agency writes to a number (a carer's, or an office member's: userId), and keeps it. */
export async function sendAndKeep(agencyId: string, staffId: string | null, phone: string, body: string, label: string, userId?: string): Promise<SmsResult> {
  const sender = await smsSender(agencyId);
  if (!sender) return { sent: false, reason: "Texting is off or isn't set up" };
  try {
    const { sid } = await sendSms(sender.secrets, sender.from, phone, body);
    await prisma.smsMessage.create({ data: { agencyId, staffId, userId, direction: "OUT", phone, body, providerId: sid, status: "SENT" } });
    await logSms({ integration: sender.integration, agencyId }, "sms.out", true, label);
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Twilio didn't accept the message";
    await prisma.smsMessage.create({ data: { agencyId, staffId, userId, direction: "OUT", phone, body, status: "FAILED" } });
    const status = (error as { status?: number }).status;
    await logSms({ integration: sender.integration, agencyId }, "sms.out", false, `${label} failed: ${reason}`, status === 401 || status === 403);
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

/** Every carer, in any agency, with this mobile number: for texts to the shared Pushbots number. */
export async function staffAnywhereByPhone(phone: string) {
  const want = toE164(phone) ?? phone;
  // Numbers are stored as typed ("07700 900123", "+44 7700…"), so compare them normalised.
  const staff = await prisma.staffProfile.findMany({
    where: { phone: { not: null }, status: { not: "INACTIVE" } },
    select: { id: true, agencyId: true, firstName: true, lastName: true, phone: true, smsOptOutAt: true },
  });
  return staff.filter((s) => toE164(s.phone) === want);
}
