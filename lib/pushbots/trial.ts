import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";

import { ASSIST_MODEL } from "@/lib/assist/agent";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { toE164 } from "@/lib/integrations/phone";
import { aultrumTwilio, optOutWord } from "@/lib/integrations/sms";
import { sendSms } from "@/lib/integrations/twilio";

import { pushbotsAiAvailable } from "./agent";

// "Request a text from our Pushbot" on aultrum.co.uk/pleasant. A visitor gives
// a UK mobile and the trial Pushbot texts them straight away; they can text
// back and it answers questions about Pushbots. It has no tools and sees none
// of the agency's data: its only knowledge is the description below. Texts are
// on Aultrum, not the agency's Allowance, and limited per number, per visitor
// and per day so the form can't be used to run up a bill.

const TRIAL_DAYS = 7;
const MAX_REPLIES = 12;
const PER_IP_PER_DAY = 3;
const PER_DAY = 200;
const DAY = 86_400_000;
const MAX_REPLY = 459; // three text segments
export const TRIAL_TEAM_EMAIL = "Wisdom@aultrum.co.uk";

export const TRIAL_OPENING =
  "Hi, this is a Pushbot from Pleasant by Aultrum. You asked to try me on aultrum.co.uk. Agencies use me to text carers open shifts, answer their questions and take jobs from the office by text. Ask me anything about how I work. Reply STOP to stop.";

const SYSTEM_PROMPT = `You are a Pushbot, texting someone who asked to try one on aultrum.co.uk. Answer their questions about Pushbots by text message: plain words, no markdown, at most 3 short sentences, British English.

What Pushbots are (use only these facts; if asked something not covered, say the team can answer it and suggest booking a demo at aultrum.co.uk/pleasant/book-a-demo):
- A Pushbot is a care staffing agency's own texting agent, built into Pleasant, the operating system for care staffing agencies. Each agency's Pushbot gets its own UK mobile number automatically.
- It texts open shifts to carers who are cleared and suitable for them, a few at a time in waves, and the first carer to reply YES with the code gets the shift.
- Carers can text it like a person: ask about their shifts, offers and timesheets, ask for open shifts, or leave a message for the office. It answers as that carer only, with only what they're allowed to see.
- Office staff can text it from registered mobiles to ask who is working or to set up jobs, such as filling a shift. Changes wait for a YES code. Timesheets, pay, invoices and compliance are never changed by text.
- Calls to a Pushbot's number are put through to the agency's office phone.
- Every text in and out is kept in Pleasant for the office to see.
- Pricing: the Pushbots plan is £39 a month with 1,500 credits, where 1 credit is 1p. A text sent is 5 credits, a text received 1, an AI reply 3. Extra credits can be bought any time.

You are a demonstration: you can't see any agency's carers, shifts or data, and you can't book, change or send anything. Never invent features, prices or customers. Don't ask for personal details. If they want to sign up or talk to someone, point them to aultrum.co.uk/pleasant/book-a-demo.`;

export type TrialRequest = { ok: true; message: string } | { ok: false; status: number; message: string };

const hashIp = (ip: string) => createHash("sha256").update(`pushbot-trial:${ip}`).digest("hex");

/** The Pushbot that texts visitors: PUSHBOTS_TRIAL_AGENCY_ID's if set, else the first Pushbot that got a number. */
async function trialPushbot() {
  const agencyId = process.env.PUSHBOTS_TRIAL_AGENCY_ID?.trim();
  return prisma.pushbot.findFirst({
    where: { ...(agencyId ? { agencyId } : {}), enabled: true, numberStatus: "active", number: { not: null } },
    orderBy: { createdAt: "asc" },
  });
}

/** A visitor asks for a text. */
export async function requestTrial(input: { phone: string; ip: string }): Promise<TrialRequest> {
  const phone = toE164(input.phone);
  if (!phone || !/^\+447\d{9}$/.test(phone)) return { ok: false, status: 422, message: "Enter a UK mobile number, like 07700 900123." };
  const secrets = aultrumTwilio();
  const pushbot = await trialPushbot();
  if (!secrets || !pushbot?.number || !pushbotsAiAvailable()) return { ok: false, status: 503, message: "Our Pushbot can't text just now. Please book a demo instead." };

  const since = new Date(Date.now() - DAY);
  const ipHash = hashIp(input.ip);
  if (await prisma.pushbotTrial.findFirst({ where: { phone, createdAt: { gte: since } } })) {
    return { ok: true, message: "We've already texted that number today. Reply to that text to carry on." };
  }
  const [fromVisitor, today] = await Promise.all([
    prisma.pushbotTrial.count({ where: { ipHash, createdAt: { gte: since } } }),
    prisma.pushbotTrial.count({ where: { createdAt: { gte: since } } }),
  ]);
  if (fromVisitor >= PER_IP_PER_DAY || today >= PER_DAY) return { ok: false, status: 429, message: "Too many requests today. Please try again tomorrow, or book a demo." };

  await prisma.pushbotTrial.create({ data: { pushbotId: pushbot.id, phone, ipHash } });
  try {
    const { sid } = await sendSms(secrets, pushbot.number, phone, TRIAL_OPENING);
    await prisma.smsMessage.create({ data: { agencyId: pushbot.agencyId, direction: "OUT", phone, body: TRIAL_OPENING, providerId: sid, status: "SENT" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "pushbot_trial_text_failed", error: error instanceof Error ? error.message : String(error) }));
    return { ok: false, status: 502, message: "The text didn't go through. Check the number and try again." };
  }
  await sendEmail({
    to: TRIAL_TEAM_EMAIL,
    subject: "Someone is trying a Pushbot",
    text: `${phone} asked for a text from our Pushbot on aultrum.co.uk/pleasant and has been sent one from ${pushbot.number}. Their replies appear under Pushbots → Texts.`,
  }).catch(() => undefined);
  return { ok: true, message: "Sent. Check your phone and text back to try it." };
}

/** The visitor's live trial for a text to this Pushbot's number, if there is one. */
export async function activeTrial(pushbotId: string, phone: string) {
  return prisma.pushbotTrial.findFirst({
    where: { pushbotId, phone, stoppedAt: null, createdAt: { gte: new Date(Date.now() - TRIAL_DAYS * DAY) } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * A text from a visitor trying the Pushbot. The text is kept; the reply comes
 * back here to send in the webhook's answer, or later (the AI reply) through
 * `send`. Returns the immediate reply, if any.
 */
export async function trialText(
  trial: { id: string; replies: number },
  pushbot: { agencyId: string; number: string | null },
  phone: string,
  body: string,
  providerId: string | null,
  later: (work: () => Promise<unknown>) => void,
): Promise<string | null> {
  await prisma.smsMessage.create({ data: { agencyId: pushbot.agencyId, direction: "IN", phone, body: body.slice(0, 1600), providerId, status: "RECEIVED" } });
  if (optOutWord(body) === "stop") {
    await prisma.pushbotTrial.update({ where: { id: trial.id }, data: { stoppedAt: new Date() } });
    return "You won't get any more texts from this trial.";
  }
  // Counted before the reply is written, so two texts at once can't pass the limit.
  const counted = await prisma.pushbotTrial.updateMany({ where: { id: trial.id, replies: { lt: MAX_REPLIES } }, data: { replies: { increment: 1 } } });
  if (counted.count === 0) return null;
  if (trial.replies + 1 >= MAX_REPLIES) return "That's the end of the trial. To see Pushbots with your own carers and shifts, book a demo at aultrum.co.uk/pleasant/book-a-demo";

  later(async () => {
    const secrets = aultrumTwilio();
    if (!secrets || !pushbot.number) return;
    const reply = (await composeTrialReply(pushbot.agencyId, phone).catch((error) => {
      console.error(JSON.stringify({ event: "pushbot_trial_reply_failed", error: String(error) }));
      return null;
    })) ?? "Sorry, I couldn't answer that just now. The team can: book a demo at aultrum.co.uk/pleasant/book-a-demo";
    const text = reply.slice(0, MAX_REPLY);
    try {
      const { sid } = await sendSms(secrets, pushbot.number, phone, text);
      await prisma.smsMessage.create({ data: { agencyId: pushbot.agencyId, direction: "OUT", phone, body: text, providerId: sid, status: "SENT" } });
    } catch (error) {
      console.error(JSON.stringify({ event: "pushbot_trial_text_failed", error: error instanceof Error ? error.message : String(error) }));
    }
  });
  return null;
}

async function composeTrialReply(agencyId: string, phone: string): Promise<string | null> {
  const since = new Date(Date.now() - TRIAL_DAYS * DAY);
  const thread = await prisma.smsMessage.findMany({ where: { agencyId, phone, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 40, select: { direction: true, body: true } });
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const t of thread) {
    const role = t.direction === "IN" ? "user" : "assistant";
    const last = messages.at(-1);
    if (last?.role === role) last.content += `\n${t.body}`;
    else messages.push({ role, content: t.body });
  }
  while (messages[0]?.role === "assistant") messages.shift();
  if (messages.at(-1)?.role !== "user") return null;

  const client = new Anthropic({ maxRetries: 2, timeout: 25_000 });
  const message = await client.messages.create({
    model: ASSIST_MODEL,
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages,
  });
  if (message.stop_reason === "refusal") return null;
  const text = message.content.flatMap((b) => (b.type === "text" && b.text.trim() ? [b.text.trim()] : [])).join(" ");
  return text || null;
}
