import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, test } from "node:test";

import { prisma } from "@/lib/db";
import { sendAndKeep } from "@/lib/integrations/sms";

import { allowanceView } from "./billing";
import { inboundToPushbot } from "./inbound";
import { chargeNumbersMonthly } from "./number";

// Pushbots paying from the agency's Allowance, against stand-ins for Aultrum
// ID and Twilio: every text sent on Aultrum's account is charged first (long
// texts by part), a text received costs a credit but is always handled, a
// refused charge means no text goes out, the number is charged once a month,
// and an unreachable Aultrum ID never stops a Pushbot.

const read = (req: IncomingMessage) => new Promise<string>((done) => { let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => done(raw)); });

let aid: Server;
let twilio: Server;
let refuse = false;
const spends: { orgId: string; action: string; quantity: number; key: string }[] = [];
const texts: { to: string; body: string }[] = [];
let agencyId = "";
let pushbotId = "";
let carerPhone = "";

before(async () => {
  aid = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST" && req.url === "/api/v1/allowance/spend") {
      const body = JSON.parse(await read(req));
      spends.push(body);
      if (refuse) {
        res.statusCode = 402;
        return res.end(JSON.stringify({ ok: false, reason: "empty", message: "Your Allowance has run out of credits." }));
      }
      return res.end(JSON.stringify({ ok: true, enforced: true, charged: 5, balance: 100 }));
    }
    if (req.method === "GET" && req.url?.startsWith("/api/v1/allowance?")) return res.end(JSON.stringify({ enforced: true, balance: 100, plan: "pushbots", planStatus: "active", covered: true, autoTopUp: false, manageUrl: "https://workspace.test/allowance", prices: [], packs: [], plans: [] }));
    res.statusCode = 404;
    res.end("{}");
  });
  twilio = createServer(async (req, res) => {
    const form = new URLSearchParams(await read(req));
    res.setHeader("Content-Type", "application/json");
    if (req.url?.endsWith("/Messages.json")) texts.push({ to: form.get("To") ?? "", body: form.get("Body") ?? "" });
    res.end(JSON.stringify({ sid: `SM${texts.length}` }));
  });
  await new Promise<void>((d) => aid.listen(0, d));
  await new Promise<void>((d) => twilio.listen(0, d));
  process.env.AULTRUM_ID_URL = `http://localhost:${(aid.address() as { port: number }).port}`;
  process.env.TWILIO_API_URL = `http://localhost:${(twilio.address() as { port: number }).port}`;
  process.env.TWILIO_ACCOUNT_SID = `AC${"3".repeat(32)}`;
  process.env.TWILIO_AUTH_TOKEN = "t";
  delete process.env.ANTHROPIC_API_KEY;

  agencyId = (await prisma.agency.create({ data: { name: "Billing Care", slug: `billing-${Date.now()}` } })).id;
  pushbotId = (await prisma.pushbot.create({ data: { agencyId, number: "+447700900111", numberSid: "PNbilling", numberStatus: "active" } })).id;
  carerPhone = `+4477009${String(Date.now()).slice(-5)}7`;
  await prisma.staffProfile.create({ data: { agencyId, firstName: "Bea", lastName: "Carer", jobTitle: "Billing Test", phone: carerPhone } });
});

after(async () => {
  await prisma.agency.delete({ where: { id: agencyId } });
  await prisma.$disconnect();
  aid.close();
  twilio.close();
});

test("a text on Aultrum's account is charged before it's sent, long texts by part", async () => {
  const r = await sendAndKeep(agencyId, null, carerPhone, "x".repeat(200), "test");
  assert.ok(r.sent);
  const spend = spends.at(-1)!;
  assert.deepEqual([spend.orgId, spend.action, spend.quantity], [agencyId, "sms_out", 2]);
  assert.ok(spend.key.startsWith(`${agencyId}:`));
});

test("when the Allowance says no, no text goes out, and the reason is plain", async () => {
  refuse = true;
  const before = texts.length;
  const r = await sendAndKeep(agencyId, null, carerPhone, "hello", "test");
  assert.equal(r.sent, false);
  assert.match(r.sent ? "" : r.reason ?? "", /run out of credits/);
  assert.equal(texts.length, before);
});

test("a text received is charged but always handled; the reply straight back needs credits", async () => {
  refuse = true;
  spends.length = 0;
  const reply = await inboundToPushbot(pushbotId, carerPhone, "STOP", "SMin-billing-1", () => undefined);
  assert.equal(reply, null, "no reply text without credits");
  assert.ok((await prisma.staffProfile.findFirstOrThrow({ where: { agencyId, phone: carerPhone } })).smsOptOutAt, "the STOP was still honoured");
  assert.deepEqual(spends.map((s) => s.action), ["sms_in", "sms_out"]);
  assert.ok(spends[0].key.endsWith("in:SMin-billing-1"));

  refuse = false;
  const back = await inboundToPushbot(pushbotId, carerPhone, "START", "SMin-billing-2", () => undefined);
  assert.match(back ?? "", /back on/);
});

test("the Pushbot's number is charged once a month", async () => {
  await prisma.serviceKey.deleteMany({ where: { name: "pushbots-number-charge" } });
  spends.length = 0;
  const now = new Date("2026-12-01T09:00:00Z");
  await chargeNumbersMonthly(now);
  await chargeNumbersMonthly(now);
  const mine = spends.filter((s) => s.orgId === agencyId && s.action === "number_month");
  assert.equal(mine.length, 1);
  assert.ok(mine[0].key.endsWith("number:PNbilling:2026-12"));
});

test("the settings page reads the Allowance, and an unreachable Aultrum ID never stops texting", async () => {
  assert.equal((await allowanceView(agencyId))?.balance, 100);
  process.env.AULTRUM_ID_URL = "http://localhost:9"; // nothing listens there
  refuse = false;
  const r = await sendAndKeep(agencyId, null, carerPhone, "still works", "test");
  assert.ok(r.sent);
});
