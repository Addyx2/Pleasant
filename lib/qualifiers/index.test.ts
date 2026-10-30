import assert from "node:assert/strict";
import { test } from "node:test";

import { score, summarise, type Record90 } from "./index";

const now = new Date(Date.UTC(2026, 10, 15, 12));
const daysAgo = (d: number, h = 8) => new Date(now.getTime() - d * 86_400_000 + (h - 12) * 3_600_000);
const year = new Date(now.getTime() + 365 * 86_400_000);

/** A shift d days ago, 8 hours from 08:00, clocked in `late` minutes after the start and signed off by the home. */
const shift = (d: number, over: { status?: string; late?: number; signed?: boolean; ts?: string | null } = {}) => {
  const startAt = daysAgo(d, 8);
  return {
    startAt,
    endAt: new Date(startAt.getTime() + 8 * 3_600_000),
    breakMins: 30,
    status: over.status ?? "COMPLETED",
    timesheet: over.status === "NO_SHOW" || over.ts === null ? null : { clockIn: new Date(startAt.getTime() + (over.late ?? 0) * 60_000), status: over.ts ?? "APPROVED", clientAuthAt: over.signed === false ? null : startAt },
  };
};

const carer = (over: Partial<Record90> = {}): Record90 => ({
  staffId: "s1",
  name: "Grace Mensah",
  jobTitle: "Care Assistant",
  compliance: { dbsNumber: "001", dbsExpiry: year, rightToWork: { status: "VERIFIED", expiryDate: year } },
  training: [{ courseName: "Moving and handling", expiryDate: year, status: "COMPLETED" }],
  shifts: [shift(2), shift(4), shift(6), shift(8), shift(10)],
  offers: { sent: 5, answered: 5 },
  complaints: [],
  ...over,
});

test("a carer who turns up on time, answers offers and gets signed off is excellent, with the facts shown", () => {
  const q = score(carer(), now);
  assert.equal(q.band, "excellent");
  assert.equal(q.index, 100);
  assert.ok(q.layers.reliability.facts.includes("turned up for all 5 shifts"));
  assert.ok(q.layers.quality.facts.includes("homes signed off 5 of 5 timesheets"));
});

test("compliance is a gate: an expired DBS means not ready, whatever the scores", () => {
  const q = score(carer({ compliance: { dbsNumber: "001", dbsExpiry: daysAgo(1), rightToWork: { status: "VERIFIED", expiryDate: year } } }), now);
  assert.equal(q.band, "blocked");
  assert.equal(q.gate.clear, false);
  assert.deepEqual(q.gate.gaps, ["DBS certificate has expired"]);
  assert.equal(q.index, 100, "the score is still shown, it just doesn't count");
});

test("no-shows count double and lateness counts, in reliability", () => {
  const q = score(carer({ shifts: [shift(2), shift(4, { status: "NO_SHOW" }), shift(6, { late: 25 }), shift(8), shift(10)], offers: { sent: 0, answered: 0 } }), now);
  // attendance 1 - 2/5 = 0.6; on time 3 of 4 = 0.75 → 68
  assert.equal(q.layers.reliability.score, 68);
  assert.ok(q.layers.reliability.facts.includes("1 no-show in 5 shifts"));
  assert.ok(q.layers.reliability.facts.includes("on time for 3 of 4"));
});

test("homes not signing, disputes and complaints bring quality down", () => {
  const q = score(carer({ shifts: [shift(2), shift(4, { signed: false }), shift(6, { ts: "DISPUTED", signed: false }), shift(8), shift(10)], complaints: [{ severity: "HIGH", status: "OPEN" }, { severity: "LOW", status: "DISMISSED" }] }), now);
  // signed 3 of 5 = 60, minus 20 for the dispute, minus 20 for the HIGH complaint; the dismissed one doesn't count
  assert.equal(q.layers.quality.score, 20);
  assert.ok(q.layers.quality.facts.includes("1 complaint not dismissed"));
});

test("short rest between shifts lowers readiness", () => {
  const close = { ...shift(3), startAt: new Date(daysAgo(2, 8).getTime() - 7 * 3_600_000), endAt: new Date(daysAgo(2, 8).getTime() - 3_600_000) }; // ends 1 hour before the next starts
  const q = score(carer({ shifts: [shift(2), close, shift(6), shift(8), shift(10)] }), now);
  assert.equal(q.layers.readiness.score, 75);
  assert.ok(q.layers.readiness.facts.includes("1 gap under 11 hours between shifts"));
});

test("a carer with too little history is New, with no index, not a low score", () => {
  const q = score(carer({ shifts: [shift(2)], offers: { sent: 1, answered: 0 }, training: [] }), now);
  assert.equal(q.band, "new");
  assert.equal(q.index, null);
  assert.equal(q.layers.competence.score, null);
});

test("summarise averages only scored, ready carers and lists who to review", () => {
  const all = [
    score(carer({ staffId: "a" }), now),
    score(carer({ staffId: "b", shifts: [shift(2), shift(4, { status: "NO_SHOW" }), shift(6, { status: "NO_SHOW" }), shift(8, { signed: false }), shift(10, { signed: false })] }), now),
    score(carer({ staffId: "c", compliance: { dbsNumber: null, dbsExpiry: null, rightToWork: null } }), now),
    score(carer({ staffId: "d", shifts: [] }), now),
  ];
  const s = summarise(all);
  assert.equal(s.total, 4);
  assert.equal(s.counts.blocked, 1);
  assert.equal(s.counts.new, 1);
  assert.deepEqual(s.toReview.map((q) => q.staffId).sort(), ["b", "c"]);
  // b averages 70, but a quality score of 33 holds them at Watch.
  assert.equal(all[1].index, 70);
  assert.equal(all[1].band, "watch");
  assert.deepEqual(all[1].weak, ["Quality"]);
  assert.equal(s.index, Math.round((all[0].index! + all[1].index!) / 2));
});
