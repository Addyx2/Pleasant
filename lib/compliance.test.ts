import assert from "node:assert/strict";
import { test } from "node:test";

import { DUE_SOON_DAYS, daysUntil, expiryLabel, expiryState, severityRank, sortByUrgency } from "./compliance";

const NOW = new Date(2026, 2, 10, 9, 0); // Tue 10 Mar 2026

test("daysUntil counts whole calendar days ignoring time of day", () => {
  assert.equal(daysUntil(new Date(2026, 2, 11, 23, 0), new Date(2026, 2, 10, 1, 0)), 1);
});

test("daysUntil is zero on the same calendar day", () => {
  assert.equal(daysUntil(new Date(2026, 2, 10, 22, 0), NOW), 0);
});

test("daysUntil is negative for a past date", () => {
  assert.equal(daysUntil(new Date(2026, 2, 5), NOW), -5);
});

test("expiryState marks a missing date MISSING", () => {
  assert.equal(expiryState(null, NOW), "MISSING");
});

test("expiryState marks a past date EXPIRED", () => {
  assert.equal(expiryState(new Date(2026, 0, 1), NOW), "EXPIRED");
});

test("expiryState marks today DUE_SOON", () => {
  assert.equal(expiryState(new Date(2026, 2, 10), NOW), "DUE_SOON");
});

test("expiryState marks inside the due-soon window DUE_SOON", () => {
  assert.equal(expiryState(new Date(2026, 3, 15), NOW), "DUE_SOON");
});

test("expiryState marks beyond the window OK", () => {
  assert.equal(expiryState(new Date(2026, 8, 1), NOW), "OK");
});

test("expiryState respects a custom due-soon window", () => {
  assert.equal(expiryState(new Date(2026, 2, 30), NOW, 10), "OK");
  assert.equal(expiryState(new Date(2026, 2, 30), NOW, 30), "DUE_SOON");
});

test("expiryLabel reports not recorded when absent", () => {
  assert.equal(expiryLabel(null, NOW), "Not recorded");
});

test("expiryLabel uses singular for one day", () => {
  assert.equal(expiryLabel(new Date(2026, 2, 11), NOW), "Expires in 1 day");
});

test("expiryLabel pluralises overdue days", () => {
  assert.equal(expiryLabel(new Date(2026, 2, 8), NOW), "Expired 2 days ago");
});

test("expiryLabel reports today", () => {
  assert.equal(expiryLabel(new Date(2026, 2, 10), NOW), "Expires today");
});

test("severityRank orders expired, missing, due soon, ok", () => {
  assert.ok(severityRank("EXPIRED") < severityRank("MISSING"));
  assert.ok(severityRank("MISSING") < severityRank("DUE_SOON"));
  assert.ok(severityRank("DUE_SOON") < severityRank("OK"));
});

test("sortByUrgency puts nearest expiry first within a band", () => {
  const rows = [
    { state: "DUE_SOON" as const, days: 30 },
    { state: "EXPIRED" as const, days: -10 },
    { state: "DUE_SOON" as const, days: 5 },
    { state: "MISSING" as const, days: null },
  ];
  assert.deepEqual(
    sortByUrgency(rows).map((r) => r.days),
    [-10, null, 5, 30],
  );
});

test("sortByUrgency does not mutate its input", () => {
  const rows = [
    { state: "OK" as const, days: 100 },
    { state: "EXPIRED" as const, days: -1 },
  ];
  sortByUrgency(rows);
  assert.equal(rows[0].state, "OK");
});

test("the due-soon window is 60 days", () => {
  assert.equal(DUE_SOON_DAYS, 60);
});
