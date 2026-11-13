import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { prisma } from "@/lib/db";
import { handleElementsWebhook } from "@/lib/elements-events";

// A carer tells Gateway they can't make a shift. On the seeded database:
// Pleasant frees the shift on the date they gave and, with a Pushbot, starts
// texting other carers to cover it; without one, it goes to Unattended. The
// office sees what was done. Someone Pleasant doesn't know frees nothing.

const ROLE = `Absence Test ${Date.now()}`;
let agencyId = "";
let staffId = "";
const INSTALLATION = `inst_abs_${Date.now()}`;
let n = 0;
let addonBefore: { id: string; elementsInstallationId: string | null } | null = null;

const londonDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const event = (data: Record<string, unknown>) => ({
  id: `evt_abs_${Date.now()}_${++n}`,
  type: "gateway.absence.reported",
  installation: { id: INSTALLATION, module: "gateway", tenantId: agencyId },
  data: { conversationId: `c${n}`, channel: "sms", contact: "+447700900101", contactName: "Ada Carer", ...data },
});
const shiftAt = (startAt: Date) =>
  prisma.shift.create({ data: { agencyId, staffId, title: "Absence test shift", role: ROLE, startAt, endAt: new Date(startAt.getTime() + 8 * 3_600_000), status: "ASSIGNED" } });

before(async () => {
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "admin@pleasant.demo" } });
  agencyId = admin.agencyId;
  addonBefore = await prisma.agencyAddon.findUnique({ where: { agencyId_key: { agencyId, key: "GATEWAY" } }, select: { id: true, elementsInstallationId: true } });
  await prisma.agencyAddon.upsert({ where: { agencyId_key: { agencyId, key: "GATEWAY" } }, create: { agencyId, key: "GATEWAY", installed: true, elementsInstallationId: INSTALLATION }, update: { elementsInstallationId: INSTALLATION } });
  staffId = (await prisma.staffProfile.create({ data: { agencyId, firstName: "Ada", lastName: "Absent", jobTitle: ROLE, phone: "+447700900101" } })).id;
});

after(async () => {
  await prisma.pushbotCampaign.deleteMany({ where: { targetRole: ROLE } });
  await prisma.shift.deleteMany({ where: { role: ROLE } });
  await prisma.staffProfile.deleteMany({ where: { jobTitle: ROLE } });
  if (addonBefore) await prisma.agencyAddon.update({ where: { id: addonBefore.id }, data: { elementsInstallationId: addonBefore.elementsInstallationId } });
  else await prisma.agencyAddon.deleteMany({ where: { elementsInstallationId: INSTALLATION } });
  await prisma.elementsEvent.deleteMany({ where: { agencyId, type: "gateway.absence.reported" } });
  await prisma.$disconnect();
});

test("without a Pushbot, the shift on the date they gave is freed and flagged for the office", async () => {
  await prisma.pushbot.deleteMany({ where: { agencyId } });
  const day = new Date(Date.now() + 3 * 86_400_000);
  const theirs = await shiftAt(day);
  const other = await shiftAt(new Date(day.getTime() + 2 * 86_400_000));
  const e = event({ personId: staffId, date: londonDate(day), when: "Thursday morning", reason: "unwell" });
  assert.deepEqual(await handleElementsWebhook(e), { ok: true });

  const freed = await prisma.shift.findUniqueOrThrow({ where: { id: theirs.id } });
  assert.deepEqual([freed.status, freed.staffId], ["UNATTENDED", null]);
  assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: other.id } })).staffId, staffId, "their other shifts are untouched");
  const row = await prisma.elementsEvent.findUniqueOrThrow({ where: { eventId: e.id } });
  assert.equal(row.needsAttention, true);
  assert.equal(row.urgent, true, "nobody is covering it yet");
  assert.match(JSON.stringify(row.data), /Unattended shifts/);
});

test("with a Pushbot, cover starts straight away; a redelivered event changes nothing more", async () => {
  await prisma.pushbot.create({ data: { agencyId, name: "Bria", enabled: true } });
  // Another carer with the same role, cleared to work, who can be offered the shift.
  const cover = await prisma.staffProfile.create({
    data: {
      agencyId, firstName: "Cole", lastName: "Cover", jobTitle: ROLE, phone: "+447700900111", dbsNumber: "002",
      dbsExpiry: new Date(Date.now() + 365 * 86_400_000),
      rightToWork: { create: { agencyId, documentType: "PASSPORT", status: "VERIFIED", expiryDate: new Date(Date.now() + 365 * 86_400_000) } },
    },
  });
  try {
    const theirs = await shiftAt(new Date(Date.now() + 20 * 3_600_000));
    const e = event({ personId: staffId, date: null, when: "tomorrow", reason: "" });
    await handleElementsWebhook(e);
    assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: theirs.id } })).staffId, null);
    assert.equal(await prisma.pushbotCampaign.count({ where: { shiftId: theirs.id, status: "RUNNING" } }), 1);
    const offers = await prisma.shiftOffer.findMany({ where: { shiftId: theirs.id }, select: { staffId: true, status: true } });
    assert.ok(offers.some((o) => o.staffId === cover.id && o.status === "OFFERED"), "another carer is offered it");
    assert.ok(offers.some((o) => o.staffId === staffId && o.status === "DECLINED"), "not offered back to the carer who can't make it");
    const row = await prisma.elementsEvent.findUniqueOrThrow({ where: { eventId: e.id } });
    assert.equal(row.urgent, false);
    assert.match(JSON.stringify(row.data), /Pushbots is texting carers/);

    assert.deepEqual(await handleElementsWebhook(e), { ok: true, duplicate: true });
    assert.equal(await prisma.pushbotCampaign.count({ where: { shiftId: theirs.id } }), 1);
  } finally {
    await prisma.pushbot.deleteMany({ where: { agencyId } });
  }
});

test("someone Pleasant doesn't know frees nothing, and the office is asked to check", async () => {
  const mine = await shiftAt(new Date(Date.now() + 10 * 3_600_000));
  const e = event({ personId: "not-a-carer", date: null, when: "today", reason: "" });
  await handleElementsWebhook(e);
  assert.equal((await prisma.shift.findUniqueOrThrow({ where: { id: mine.id } })).staffId, staffId);
  assert.match(JSON.stringify((await prisma.elementsEvent.findUniqueOrThrow({ where: { eventId: e.id } })).data), /Not matched to a carer/);
});
