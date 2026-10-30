import assert from "node:assert/strict";
import { test } from "node:test";

import { optOutWord } from "@/lib/integrations/sms";

import { rank, reliability, ruledOut, type CandidateFacts } from "./eligibility";

const at = (h: number) => new Date(Date.UTC(2026, 10, 3, h));
const shift = { startAt: at(20), endAt: at(32), role: "Care Assistant" };

const carer = (over: Partial<CandidateFacts> = {}): CandidateFacts => ({
  staffId: over.name ?? "c",
  name: "Carer",
  jobTitle: "Care Assistant",
  hasPhone: true,
  optedOut: false,
  complianceGaps: [],
  nearby: [],
  unavailable: null,
  alreadyOffered: false,
  offers: { sent: 0, answered: 0, accepted: 0 },
  weekHours: 0,
  ...over,
});

test("ruledOut: each rule rules a carer out on its own, with the reason", () => {
  assert.equal(ruledOut(shift, carer()), null);
  assert.match(ruledOut(shift, carer({ jobTitle: "Registered Nurse" }))!, /not a Care Assistant/);
  assert.match(ruledOut(shift, carer({ complianceGaps: ["DBS certificate has expired"] }))!, /DBS/);
  assert.match(ruledOut(shift, carer({ alreadyOffered: true }))!, /already been offered/);
  assert.match(ruledOut(shift, carer({ unavailable: "They can't work Tuesdays" }))!, /Tuesdays/);
  assert.match(ruledOut(shift, carer({ nearby: [{ startAt: at(18), endAt: at(22) }] }))!, /already booked/);
});

test("ruledOut: under 11 hours' rest either side rules out; 11 hours is fine", () => {
  assert.match(ruledOut(shift, carer({ nearby: [{ startAt: at(2), endAt: at(10) }] }))!, /11 hours/); // ends 10h before
  assert.equal(ruledOut(shift, carer({ nearby: [{ startAt: at(1), endAt: at(9) }] })), null); // ends 11h before
  assert.match(ruledOut(shift, carer({ nearby: [{ startAt: at(42), endAt: at(50) }] }))!, /11 hours/); // starts 10h after
  assert.equal(ruledOut(shift, carer({ nearby: [{ startAt: at(43), endAt: at(51) }] })), null);
});

test("ruledOut: role matching ignores case and spacing", () => {
  assert.equal(ruledOut(shift, carer({ jobTitle: " care assistant " })), null);
});

test("reliability needs three offers to judge", () => {
  assert.equal(reliability({ sent: 2, answered: 2, accepted: 2 }), null);
  assert.equal(reliability({ sent: 4, answered: 3, accepted: 1 }), 0.75);
});

test("rank: reliable carers first, then fewest hours that week; new carers in between", () => {
  const { ranked, excluded } = rank(shift, [
    carer({ name: "Slow", staffId: "slow", offers: { sent: 10, answered: 2, accepted: 1 } }),
    carer({ name: "New", staffId: "new" }),
    carer({ name: "Busy", staffId: "busy", offers: { sent: 10, answered: 10, accepted: 5 }, weekHours: 40 }),
    carer({ name: "Fresh", staffId: "fresh", offers: { sent: 10, answered: 10, accepted: 5 }, weekHours: 8 }),
    carer({ name: "Nurse", staffId: "nurse", jobTitle: "Registered Nurse" }),
  ]);
  assert.deepEqual(ranked.map((r) => r.staffId), ["fresh", "busy", "new", "slow"]);
  assert.deepEqual(excluded.map((e) => e.staffId), ["nurse"]);
});

test("rank: no mobile or opted out still gets the offer in the app, not by text", () => {
  const { ranked } = rank(shift, [carer({ staffId: "a", hasPhone: false }), carer({ staffId: "b", optedOut: true }), carer({ staffId: "c" })]);
  assert.deepEqual(Object.fromEntries(ranked.map((r) => [r.staffId, r.textable])), { a: false, b: false, c: true });
  assert.match(ranked.find((r) => r.staffId === "b")!.why, /opted out/);
});

test("optOutWord: STOP and START on their own; never 'cancel' or a sentence", () => {
  assert.equal(optOutWord("STOP"), "stop");
  assert.equal(optOutWord(" stop. "), "stop");
  assert.equal(optOutWord("Start"), "start");
  assert.equal(optOutWord("cancel"), null);
  assert.equal(optOutWord("please stop sending me nights"), null);
  assert.equal(optOutWord("YES 1234"), null);
});
