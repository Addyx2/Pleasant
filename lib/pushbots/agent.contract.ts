import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { after, before, test } from "node:test";

import { prisma } from "@/lib/db";
import { handleInboundSms } from "@/lib/integrations/sms-offers";
import { saveIntegration } from "@/lib/integrations/store";

// Pushbots' text agent on the seeded database, with stand-ins for Twilio and
// for Claude. The stand-in model makes scripted tool calls, so this checks
// the plumbing and the limits, not the model's judgement: tools see only the
// texting carer's own shifts and offers, an offer accepted by text settles,
// another carer's offer code doesn't work, unknown tools are refused, the
// office hears about what Pushbots passes on, and the reply goes out by text.

const ROLE = `Pushbots Agent ${Date.now()}`;
const texts: { to: string; body: string }[] = [];
/** What the stand-in model does next, keyed by the carer's latest words. */
const script: Record<string, { name: string; input: Record<string, unknown> }[]> = {};
const toolResults: { name: string; content: string; isError: boolean }[] = [];
let twilio: Server;
let claude: Server;
let agencyId = "";
let me = { id: "", phone: "" };
let other = { id: "", phone: "" };

const body = (req: IncomingMessage) => new Promise<string>((done) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => done(raw));
});

before(async () => {
  twilio = createServer(async (req, res) => {
    const form = new URLSearchParams(await body(req));
    texts.push({ to: form.get("To") ?? "", body: form.get("Body") ?? "" });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ sid: `SM${texts.length}` }));
  });
  claude = createServer(async (req, res) => {
    const request = JSON.parse(await body(req)) as { messages: { role: string; content: unknown }[]; tools: { name: string }[] };
    const last = request.messages.at(-1)!;
    let content: unknown[];
    if (typeof last.content === "string") {
      const words = last.content.split("\n").at(-1)!;
      const calls = script[words] ?? [];
      content = calls.length ? calls.map((c, i) => ({ type: "tool_use", id: `tu_${Date.now()}_${i}`, name: c.name, input: c.input })) : [{ type: "text", text: "OK." }];
    } else {
      const results = last.content as { tool_use_id: string; content: string; is_error?: boolean }[];
      const prior = request.messages.at(-2)!.content as { id: string; name: string }[];
      for (const r of results) toolResults.push({ name: prior.find((p) => p.id === r.tool_use_id)?.name ?? "?", content: r.content, isError: !!r.is_error });
      content = [{ type: "text", text: `Done: ${results.map((r) => (r.is_error ? "error" : "ok")).join(",")}` }];
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "msg_test", type: "message", role: "assistant", model: "test", content, stop_reason: content.some((c) => (c as { type: string }).type === "tool_use") ? "tool_use" : "end_turn", usage: { input_tokens: 10, output_tokens: 5 } }));
  });
  await new Promise<void>((done) => twilio.listen(0, done));
  await new Promise<void>((done) => claude.listen(0, done));
  process.env.TWILIO_API_URL = `http://localhost:${(twilio.address() as { port: number }).port}`;
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${(claude.address() as { port: number }).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";

  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@pleasant.demo" } });
  agencyId = admin.agencyId;
  await saveIntegration({ agencyId, provider: "twilio", config: { from: "+447700900000", offers: true }, secrets: { accountSid: `AC${"0".repeat(32)}`, authToken: "test" } });
  const make = async (n: number) => {
    const phone = `+4477008${String(Date.now()).slice(-5)}${n}`;
    const s = await prisma.staffProfile.create({ data: { agencyId, firstName: `Agent${n}`, lastName: "Test", jobTitle: ROLE, phone } });
    return { id: s.id, phone };
  };
  me = await make(1);
  other = await make(2);
});

after(async () => {
  await prisma.shift.deleteMany({ where: { agencyId, role: ROLE } });
  await prisma.staffProfile.deleteMany({ where: { id: { in: [me.id, other.id] } } });
  await prisma.integration.deleteMany({ where: { agencyId, provider: "twilio" } });
  await prisma.$disconnect();
  twilio.close();
  claude.close();
});

const shiftFor = (staffId: string | null, daysAhead: number) => {
  const startAt = new Date(Date.now() + daysAhead * 86_400_000);
  return prisma.shift.create({
    data: { agencyId, title: `Agent shift ${daysAhead}`, role: ROLE, startAt, endAt: new Date(startAt.getTime() + 8 * 3_600_000), staffId, status: staffId ? "ASSIGNED" : "OPEN" },
  });
};

async function text(from: string, words: string) {
  const integration = await prisma.integration.findFirstOrThrow({ where: { agencyId, provider: "twilio" } });
  let work: Promise<unknown> = Promise.resolve();
  const immediate = await handleInboundSms(integration, from, words, `SMin${Date.now()}`, (fn) => {
    work = fn();
  });
  await work;
  return { immediate, reply: texts.filter((t) => t.to === from).at(-1)?.body };
}

test("my_shifts shows only the texting carer's own shifts, and the answer goes back by text", async () => {
  const mine = await shiftFor(me.id, 3);
  const theirs = await shiftFor(other.id, 4);
  script["what am I on"] = [{ name: "my_shifts", input: {} }];
  const { immediate, reply } = await text(me.phone, "what am I on");
  assert.equal(immediate, null, "the webhook answers at once; the reply follows by text");
  assert.equal(reply, "Done: ok");
  const result = toolResults.findLast((r) => r.name === "my_shifts")!;
  assert.ok(result.content.includes(mine.id));
  assert.ok(!result.content.includes(theirs.id), "never another carer's shift");
});

test("an offer accepted by text is the carer's; another carer's code does nothing", async () => {
  const shift = await shiftFor(null, 5);
  const mine = await prisma.shiftOffer.create({ data: { agencyId, shiftId: shift.id, staffId: me.id } });
  const theirs = await prisma.shiftOffer.create({ data: { agencyId, shiftId: shift.id, staffId: other.id } });
  await prisma.smsMessage.createMany({
    data: [
      { agencyId, staffId: me.id, offerId: mine.id, direction: "OUT", phone: me.phone, body: "offer", code: "1111", status: "SENT" },
      { agencyId, staffId: other.id, offerId: theirs.id, direction: "OUT", phone: other.phone, body: "offer", code: "2222", status: "SENT" },
    ],
  });

  script["take the other one"] = [{ name: "answer_offer", input: { code: "2222", answer: "accept" } }];
  await text(me.phone, "take the other one");
  assert.match(toolResults.findLast((r) => r.name === "answer_offer")!.content, /No open offer with that code/);
  assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } })).staffId, null);

  script["yes please I'll do it"] = [{ name: "answer_offer", input: { code: "1111", answer: "accept" } }];
  await text(me.phone, "yes please I'll do it");
  assert.match(toolResults.findLast((r) => r.name === "answer_offer")!.content, /"outcome":"accepted"/);
  assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } })).staffId, me.id);
});

test("unknown tools and bad input are refused; tell_office is logged for the office", async () => {
  script["approve my timesheet"] = [
    { name: "approve_timesheet", input: { id: "x" } },
    { name: "cant_work", input: { from: "next week", to: "soon" } },
    { name: "tell_office", input: { kind: "question", message: "Can you approve my timesheet?" } },
  ];
  const { reply } = await text(me.phone, "approve my timesheet");
  assert.equal(reply, "Done: error,error,ok");
  const logged = await prisma.agentLog.findFirst({ where: { agencyId, agentName: "PUSHBOTS", action: "CARER_MESSAGE" }, orderBy: { createdAt: "desc" } });
  assert.match(logged!.details!, /Can you approve my timesheet/);
  assert.match(logged!.details!, new RegExp(me.id));
});

test("a number that isn't one of the agency's carers gets no AI reply", async () => {
  const before = texts.length;
  script["hello who is this"] = [{ name: "my_shifts", input: {} }];
  await text("+447700111222", "hello who is this");
  assert.equal(texts.length, before);
});
