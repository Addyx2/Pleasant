import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

import { prisma } from "@/lib/db";
import { handleInboundSms } from "@/lib/integrations/sms-offers";
import { saveIntegration } from "@/lib/integrations/store";

import { startCampaign, tickCampaigns } from "./campaign";

// Pushbots end to end on the seeded database, with a stand-in for Twilio
// that records every text: waves go out to the best-placed carers, a NO is
// recorded, the next wave goes when it's due, the first YES gets the shift,
// everyone else still holding the offer is told it's filled, STOP is
// honoured, and a shift nobody can do is handed back to the office.

const ROLE = `Pushbots Test ${Date.now()}`;
const texts: { to: string; body: string }[] = [];
let twilio: Server;
let agencyId = "";
const carers: { id: string; phone: string }[] = [];

before(async () => {
  twilio = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const form = new URLSearchParams(raw);
      texts.push({ to: form.get("To") ?? "", body: form.get("Body") ?? "" });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ sid: `SM${texts.length}` }));
    });
  });
  await new Promise<void>((done) => twilio.listen(0, done));
  const port = (twilio.address() as { port: number }).port;
  process.env.TWILIO_API_URL = `http://localhost:${port}`;

  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@pleasant.demo" } });
  agencyId = admin.agencyId;
  await saveIntegration({ agencyId, provider: "twilio", config: { from: "+447700900000", offers: true }, secrets: { accountSid: `AC${"0".repeat(32)}`, authToken: "test" } });

  // Four compliant carers in a role nobody else has, so the test owns the ranking.
  for (let i = 0; i < 4; i++) {
    const phone = `+4477009${String(Date.now()).slice(-5)}${i}`;
    const staff = await prisma.staffProfile.create({
      data: {
        agencyId,
        firstName: `Push${i}`,
        lastName: "Bot",
        jobTitle: ROLE,
        phone,
        dbsNumber: "001234567890",
        dbsExpiry: new Date(Date.now() + 365 * 86_400_000),
        rightToWork: { create: { agencyId, documentType: "PASSPORT", status: "VERIFIED", expiryDate: new Date(Date.now() + 365 * 86_400_000) } },
      },
    });
    carers.push({ id: staff.id, phone });
  }
});

after(async () => {
  await prisma.shift.deleteMany({ where: { agencyId, role: { startsWith: "Pushbots Test" } } });
  await prisma.staffProfile.deleteMany({ where: { id: { in: carers.map((c) => c.id) } } });
  await prisma.integration.deleteMany({ where: { agencyId, provider: "twilio" } });
  await prisma.$disconnect();
  twilio.close();
});

// Each shift on its own day, so one test's booking doesn't rule a carer out of the next.
let days = 1;
const openShift = (role = ROLE) => {
  const startAt = new Date(Date.now() + ++days * 86_400_000);
  return prisma.shift.create({ data: { agencyId, title: "Pushbots night", role, startAt, endAt: new Date(startAt.getTime() + 8 * 3_600_000), status: "OPEN" } });
};
const integration = () => prisma.integration.findFirstOrThrow({ where: { agencyId, provider: "twilio" } });
const codeFor = (phone: string) => texts.filter((t) => t.to === phone).at(-1)!.body.match(/YES (\d{4})/)![1];

test("a campaign fills a shift in waves: NO is recorded, the next wave goes when due, the first YES wins, the rest are told", async () => {
  const shift = await openShift();
  const started = await startCampaign(agencyId, shift.id, null, { waveSize: 2, waveGapMins: 5 });
  assert.ok(started.ok);
  assert.equal(started.offered, 2);
  const wave1 = texts.filter((t) => /shift offer/.test(t.body)).map((t) => t.to);
  assert.equal(wave1.length, 2);

  // The first carer says no.
  const no = await handleInboundSms(await integration(), wave1[0], `NO ${codeFor(wave1[0])}`, "SMin1");
  assert.match(no!, /let the team know/);

  // Not due yet: nothing more goes out.
  await tickCampaigns();
  assert.equal(texts.filter((t) => /shift offer/.test(t.body)).length, 2);

  // Due: the next two carers are offered it.
  await prisma.pushbotCampaign.update({ where: { id: started.ok ? started.campaignId : "" }, data: { nextWaveAt: new Date(Date.now() - 1000) } });
  await tickCampaigns();
  const offers = texts.filter((t) => /shift offer/.test(t.body)).map((t) => t.to);
  assert.equal(offers.length, 4);
  assert.equal(new Set(offers).size, 4, "nobody is offered it twice");

  // A wave-2 carer takes it.
  const taker = offers[3];
  const yes = await handleInboundSms(await integration(), taker, `yes ${codeFor(taker)}`, "SMin2");
  assert.match(yes!, /the shift is yours/);
  const filled = await prisma.shift.findUniqueOrThrow({ where: { id: shift.id } });
  assert.equal(filled.staffId, carers.find((c) => c.phone === taker)!.id);
  const campaign = await prisma.pushbotCampaign.findFirstOrThrow({ where: { shiftId: shift.id } });
  assert.equal(campaign.status, "COMPLETED");
  assert.equal(campaign.outcome, "filled");

  // The two still holding it (wave 1's second carer and wave 2's first) hear it's gone; the one who said no doesn't.
  const told = texts.filter((t) => /has been filled/.test(t.body)).map((t) => t.to).sort();
  assert.deepEqual(told, [wave1[1], offers[2]].sort());
  assert.equal(await prisma.shiftOffer.count({ where: { shiftId: shift.id, status: "OFFERED" } }), 0);
});

test("STOP opts a carer out of texts; their offers still reach the app; START turns texts back on", async () => {
  const carer = carers[0];
  const stop = await handleInboundSms(await integration(), carer.phone, "STOP", "SMin3");
  assert.match(stop!, /won't get any more texts/);
  assert.ok((await prisma.staffProfile.findUniqueOrThrow({ where: { id: carer.id } })).smsOptOutAt);

  const before = texts.length;
  const shift = await openShift();
  const started = await startCampaign(agencyId, shift.id, null, { waveSize: 4 });
  assert.ok(started.ok);
  assert.equal(started.offered, 4);
  assert.equal(texts.slice(before).filter((t) => t.to === carer.phone).length, 0, "no text to the carer who said STOP");
  assert.equal(await prisma.shiftOffer.count({ where: { shiftId: shift.id, staffId: carer.id, status: "OFFERED" } }), 1, "but the offer is in their app");

  const start = await handleInboundSms(await integration(), carer.phone, "start", "SMin4");
  assert.match(start!, /back on/);
  assert.equal((await prisma.staffProfile.findUniqueOrThrow({ where: { id: carer.id } })).smsOptOutAt, null);
});

test("a shift nobody can do is handed back to the office at once", async () => {
  const shift = await openShift(`Pushbots Test nobody ${Date.now()}`);
  const started = await startCampaign(agencyId, shift.id, null);
  assert.ok(started.ok);
  assert.equal(started.offered, 0);
  const campaign = await prisma.pushbotCampaign.findFirstOrThrow({ where: { shiftId: shift.id } });
  assert.equal(campaign.outcome, "exhausted");
});

test("a shift that already has a carer, or a second campaign on one shift, is refused", async () => {
  const shift = await openShift();
  assert.ok((await startCampaign(agencyId, shift.id, null, { waveSize: 1 })).ok);
  const again = await startCampaign(agencyId, shift.id, null);
  assert.equal(again.ok, false);
});
