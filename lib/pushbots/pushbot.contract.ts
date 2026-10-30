import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, test } from "node:test";

import { prisma } from "@/lib/db";
import { smsSender } from "@/lib/integrations/sms";
import { twilioSignature } from "@/lib/integrations/twilio";

import { inboundToPushbot, inboundToShared } from "./inbound";
import { provisionNumber } from "./number";

// Each agency's Pushbot, on the seeded database, with stand-ins for Twilio
// and Claude: Pleasant buys it a number on Aultrum's account (or falls back to
// the shared number, saying why); offers go out from its number; carers'
// replies reach the right agency; office staff can ask it for jobs by text,
// which wait for YES and a code; money and compliance can't be touched by
// text; and Twilio's signature is checked.

const ROLE = `Pushbot Test ${Date.now()}`;
const texts: { from: string; to: string; body: string }[] = [];
const bought: Record<string, string>[] = [];
let failBuy = false;
/** The stand-in model's next tool calls, keyed by the texter's latest words. */
const script: Record<string, { name: string; input: Record<string, unknown> }[]> = {};
const toolResults: { name: string; content: string; isError: boolean }[] = [];
let twilio: Server;
let claude: Server;
let agencyId = "";
let otherAgencyId = "";
let pushbotId = "";
let carer = { id: "", phone: "" };
let manager = { id: "", mobile: "" };

const read = (req: IncomingMessage) => new Promise<string>((done) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => done(raw));
});

before(async () => {
  twilio = createServer(async (req, res) => {
    const form = new URLSearchParams(await read(req));
    const url = req.url ?? "";
    res.setHeader("Content-Type", "application/json");
    if (url.includes("/AvailablePhoneNumbers/GB/Mobile.json")) return res.end(JSON.stringify({ available_phone_numbers: [{ phone_number: "+447700900555" }] }));
    if (req.method === "POST" && url.endsWith("/IncomingPhoneNumbers.json")) {
      if (failBuy) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ message: "Phone Number Requires a Bundle", code: 21649 }));
      }
      bought.push(Object.fromEntries(form));
      return res.end(JSON.stringify({ sid: "PNpushbot", phone_number: "+447700900555" }));
    }
    if (url.includes("/IncomingPhoneNumbers.json?")) return res.end(JSON.stringify({ incoming_phone_numbers: [{ sid: "PNshared" }] }));
    if (url.includes("/IncomingPhoneNumbers/")) return res.end("{}");
    if (url.endsWith("/Messages.json")) {
      texts.push({ from: form.get("From") ?? "", to: form.get("To") ?? "", body: form.get("Body") ?? "" });
      return res.end(JSON.stringify({ sid: `SM${texts.length}` }));
    }
    res.statusCode = 404;
    res.end("{}");
  });
  claude = createServer(async (req, res) => {
    const request = JSON.parse(await read(req)) as { messages: { role: string; content: unknown }[] };
    const last = request.messages.at(-1)!;
    let content: unknown[];
    if (typeof last.content === "string") {
      const calls = script[last.content.split("\n").at(-1)!] ?? [];
      content = calls.length ? calls.map((c, i) => ({ type: "tool_use", id: `tu_${Date.now()}_${i}`, name: c.name, input: c.input })) : [{ type: "text", text: "OK." }];
    } else {
      const results = last.content as { tool_use_id: string; content: string; is_error?: boolean }[];
      const prior = request.messages.at(-2)!.content as { id: string; name: string }[];
      for (const r of results) toolResults.push({ name: prior.find((p) => p.id === r.tool_use_id)?.name ?? "?", content: r.content, isError: !!r.is_error });
      content = [{ type: "text", text: "Will do." }];
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "test", content, stop_reason: content.some((c) => (c as { type: string }).type === "tool_use") ? "tool_use" : "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }));
  });
  await new Promise<void>((done) => twilio.listen(0, done));
  await new Promise<void>((done) => claude.listen(0, done));
  process.env.TWILIO_API_URL = `http://localhost:${(twilio.address() as { port: number }).port}`;
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${(claude.address() as { port: number }).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.TWILIO_ACCOUNT_SID = `AC${"1".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "aultrum-token";
  process.env.TWILIO_FROM = "+447700900000";
  process.env.APP_URL = "https://pleasant.test";

  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@pleasant.demo" } });
  agencyId = admin.agencyId;
  await prisma.integration.deleteMany({ where: { agencyId, provider: "twilio" } });
  await prisma.pushbot.deleteMany({ where: { agencyId } });
  const other = await prisma.agency.create({ data: { name: "Other Agency", slug: `other-${Date.now()}` } });
  otherAgencyId = other.id;

  const phone = `+4477007${String(Date.now()).slice(-5)}1`;
  const s = await prisma.staffProfile.create({
    data: {
      agencyId,
      firstName: "Ada",
      lastName: "Carer",
      jobTitle: ROLE,
      phone,
      dbsNumber: "001",
      dbsExpiry: new Date(Date.now() + 365 * 86_400_000),
      rightToWork: { create: { agencyId, documentType: "PASSPORT", status: "VERIFIED", expiryDate: new Date(Date.now() + 365 * 86_400_000) } },
    },
  });
  carer = { id: s.id, phone };
  // The same person also works for the other agency.
  await prisma.staffProfile.create({ data: { agencyId: otherAgencyId, firstName: "Ada", lastName: "Carer", jobTitle: ROLE, phone } });

  const m = await prisma.user.findFirstOrThrow({ where: { agencyId, role: { in: ["ADMIN", "MANAGER"] } } });
  manager = { id: m.id, mobile: `+4477006${String(Date.now()).slice(-5)}2` };
  await prisma.user.update({ where: { id: m.id }, data: { mobile: manager.mobile } });
});

after(async () => {
  await prisma.shift.deleteMany({ where: { role: ROLE } });
  await prisma.staffProfile.deleteMany({ where: { jobTitle: ROLE } });
  await prisma.pushbotAction.deleteMany({ where: { agencyId } });
  await prisma.pushbot.deleteMany({ where: { agencyId } });
  await prisma.user.update({ where: { id: manager.id }, data: { mobile: null } });
  await prisma.agency.delete({ where: { id: otherAgencyId } });
  await prisma.$disconnect();
  twilio.close();
  claude.close();
});

let day = 1;
const openShift = (agency = agencyId) => {
  const startAt = new Date(Date.now() + ++day * 86_400_000);
  return prisma.shift.create({ data: { agencyId: agency, title: "Pushbot test", role: ROLE, startAt, endAt: new Date(startAt.getTime() + 8 * 3_600_000), status: "OPEN" } });
};
async function run(fn: (later: (w: () => Promise<unknown>) => void) => Promise<string | null>) {
  const work: Promise<unknown>[] = [];
  const immediate = await fn((w) => work.push(w()));
  await Promise.all(work);
  return immediate;
}
const lastTo = (to: string) => texts.filter((t) => t.to === to).at(-1)?.body ?? "";

test("an agency without a Pushbot texts nobody", async () => {
  assert.equal(await smsSender(agencyId), null);
});

test("if Twilio won't sell a UK number yet, the Pushbot says why and texts from the shared number", async () => {
  const p = await prisma.pushbot.create({ data: { agencyId, name: "Bria" } });
  pushbotId = p.id;
  failBuy = true;
  const r = await provisionNumber(p.id);
  assert.equal(r.ok, false);
  const after1 = await prisma.pushbot.findUniqueOrThrow({ where: { id: p.id } });
  assert.equal(after1.numberStatus, "failed");
  assert.match(after1.numberError!, /UK number approval/);
  assert.doesNotMatch(after1.numberError!, /TWILIO_|Bundle/, "no internal setting names for the agency");
  const sender = await smsSender(agencyId);
  assert.equal(sender?.from, "+447700900000");
});

test("Pleasant buys the Pushbot a UK number, pointed back at it, and it texts from that number", async () => {
  failBuy = false;
  const r = await provisionNumber(pushbotId);
  assert.ok(r.ok);
  assert.equal(bought.at(-1)?.SmsUrl, `https://pleasant.test/api/webhooks/twilio/pushbot/${pushbotId}`);
  assert.equal(bought.at(-1)?.FriendlyName.startsWith("Pushbot · "), true);
  assert.equal((await smsSender(agencyId))?.from, "+447700900555");

  const { startCampaign } = await import("./campaign");
  const shift = await openShift();
  const started = await startCampaign(agencyId, shift.id, null, { waveSize: 1 });
  assert.ok(started.ok);
  const offer = texts.findLast((t) => t.to === carer.phone)!;
  assert.equal(offer.from, "+447700900555");

  const code = offer.body.match(/YES (\d{4})/)![1];
  const reply = await run((later) => inboundToPushbot(pushbotId, carer.phone, `YES ${code}`, "SMin1", later));
  assert.match(reply!, /the shift is yours/);
  assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } })).staffId, carer.id);
});

test("an office member's job waits for YES and its code, runs once, and NO cancels", async () => {
  const shift = await openShift();
  script["fill the night"] = [{ name: "fill_shift", input: { shiftId: shift.id } }];
  await run((later) => inboundToPushbot(pushbotId, manager.mobile, "fill the night", "SMin2", later));
  const asked = lastTo(manager.mobile);
  const code = asked.match(/Reply YES (\d{4}) to fill /)?.[1];
  assert.ok(code, `the reply carries the code: ${asked}`);
  assert.equal(await prisma.pushbotCampaign.count({ where: { shiftId: shift.id } }), 0, "nothing happens before YES");

  await run((later) => inboundToPushbot(pushbotId, manager.mobile, `yes ${code}`, "SMin3", later));
  assert.match(lastTo(manager.mobile), /Filling it/);
  assert.equal(await prisma.pushbotCampaign.count({ where: { shiftId: shift.id } }), 1);

  await run((later) => inboundToPushbot(pushbotId, manager.mobile, `YES ${code}`, "SMin4", later));
  assert.match(lastTo(manager.mobile), /No job is waiting|already dealt with/);
  assert.equal(await prisma.pushbotCampaign.count({ where: { shiftId: shift.id } }), 1, "a repeated YES doesn't run it twice");

  const second = await openShift();
  script["fill another"] = [{ name: "fill_shift", input: { shiftId: second.id } }];
  await run((later) => inboundToPushbot(pushbotId, manager.mobile, "fill another", "SMin5", later));
  const code2 = lastTo(manager.mobile).match(/YES (\d{4})/)![1];
  await run((later) => inboundToPushbot(pushbotId, manager.mobile, `NO ${code2}`, "SMin6", later));
  assert.match(lastTo(manager.mobile), /I won't/);
  assert.equal(await prisma.pushbotCampaign.count({ where: { shiftId: second.id } }), 0);
});

test("money and compliance can't be touched by text, not even read", async () => {
  script["approve timesheets and show invoices"] = [
    { name: "decide_timesheet", input: { timesheetId: "x", decision: "approve" } },
    { name: "list_invoices", input: {} },
    { name: "record_dbs", input: { staffId: carer.id, number: "1", expiry: "2030-01-01" } },
  ];
  const before = await prisma.pushbotAction.count({ where: { agencyId } });
  await run((later) => inboundToPushbot(pushbotId, manager.mobile, "approve timesheets and show invoices", "SMin7", later));
  const last3 = toolResults.slice(-3);
  assert.deepEqual(last3.map((r) => r.isError), [true, true, true]);
  for (const r of last3) assert.match(r.content, /can't be used by text/);
  assert.equal(await prisma.pushbotAction.count({ where: { agencyId } }), before, "nothing held either");
});

test("a stranger's text to the Pushbot is treated as nobody's: no AI turn, no office powers", async () => {
  const before = texts.length;
  script["fill everything"] = [{ name: "fill_shift", input: { shiftId: "x" } }];
  await run((later) => inboundToPushbot(pushbotId, "+447700111999", "fill everything", "SMin8", later));
  assert.equal(texts.length, before);
});

test("office texting switched off: the office is told, and nothing is done", async () => {
  await prisma.pushbot.update({ where: { id: pushbotId }, data: { officeTexts: false } });
  await run((later) => inboundToPushbot(pushbotId, manager.mobile, "fill the night", "SMin9", later));
  assert.match(lastTo(manager.mobile), /office texting is switched off/);
  await prisma.pushbot.update({ where: { id: pushbotId }, data: { officeTexts: true } });
});

test("on the shared number, a reply goes to the agency whose offer code it carries", async () => {
  // The other agency texts the same carer from the shared number, after this agency did.
  const otherShift = await openShift(otherAgencyId);
  const otherStaff = await prisma.staffProfile.findFirstOrThrow({ where: { agencyId: otherAgencyId, phone: carer.phone } });
  const offer = await prisma.shiftOffer.create({ data: { agencyId: otherAgencyId, shiftId: otherShift.id, staffId: otherStaff.id } });
  await prisma.smsMessage.create({ data: { agencyId: otherAgencyId, staffId: otherStaff.id, offerId: offer.id, direction: "OUT", phone: carer.phone, body: "offer", code: "7777", status: "SENT" } });
  const mine = await openShift();
  const myOffer = await prisma.shiftOffer.create({ data: { agencyId, shiftId: mine.id, staffId: carer.id } });
  await prisma.smsMessage.create({ data: { agencyId, staffId: carer.id, offerId: myOffer.id, direction: "OUT", phone: carer.phone, body: "offer", code: "1212", status: "SENT", createdAt: new Date(Date.now() - 60_000) } });

  const reply = await run((later) => inboundToShared(carer.phone, "YES 1212", "SMin10", later));
  assert.match(reply!, /the shift is yours/);
  assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: mine.id } })).staffId, carer.id);
  assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: otherShift.id } })).staffId, null);
});

test("the Pushbot's webhook refuses a text without Twilio's signature, and takes one with it", async () => {
  const { POST } = await import("@/app/api/webhooks/twilio/pushbot/[id]/route");
  const url = `https://pleasant.test/api/webhooks/twilio/pushbot/${pushbotId}`;
  const fields = { AccountSid: process.env.TWILIO_ACCOUNT_SID!, From: "+447700111999", Body: "hello", MessageSid: "SMx" };
  const post = (signature: string) =>
    POST(new Request(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Twilio-Signature": signature }, body: new URLSearchParams(fields) }), { params: Promise.resolve({ id: pushbotId }) });
  assert.equal((await post("forged")).status, 403);
  assert.equal((await post(twilioSignature("aultrum-token", url, fields))).status, 200);
});
