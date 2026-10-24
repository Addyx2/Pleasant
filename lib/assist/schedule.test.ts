import assert from "node:assert/strict";
import { test } from "node:test";

import { describeSchedule, fromLondon, londonParts, nextRun, parseTime } from "./schedule";

// 2026 UK clocks: BST from 29 Mar 01:00 UTC to 25 Oct 01:00 UTC.
const iso = (d: Date) => d.toISOString();

test("fromLondon handles summer (BST) and winter (GMT)", () => {
  assert.equal(iso(fromLondon(2026, 7, 1, 7, 30)), "2026-07-01T06:30:00.000Z");
  assert.equal(iso(fromLondon(2026, 12, 1, 7, 30)), "2026-12-01T07:30:00.000Z");
});

test("a time skipped by the spring clock change runs an hour later", () => {
  // 01:30 on 29 Mar 2026 doesn't exist in London.
  assert.equal(londonParts(fromLondon(2026, 3, 29, 1, 30)).hour, 2);
});

test("daily runs later today if the time hasn't passed, otherwise tomorrow", () => {
  const morning = new Date("2026-07-01T05:00:00Z"); // 06:00 London
  assert.equal(iso(nextRun("DAILY", null, "07:30", morning)), "2026-07-01T06:30:00.000Z");
  const evening = new Date("2026-07-01T18:00:00Z");
  assert.equal(iso(nextRun("DAILY", null, "07:30", evening)), "2026-07-02T06:30:00.000Z");
});

test("weekdays skip the weekend", () => {
  const friday = new Date("2026-10-23T12:00:00Z"); // Fri afternoon
  // Next weekday run is Monday 26 Oct, after the clocks go back: 07:30 GMT.
  assert.equal(iso(nextRun("WEEKDAYS", null, "07:30", friday)), "2026-10-26T07:30:00.000Z");
});

test("weekly runs on the chosen day", () => {
  const wednesday = new Date("2026-10-21T12:00:00Z");
  const run = nextRun("WEEKLY", 1, "08:00", wednesday);
  assert.equal(londonParts(run).weekday, 1);
  assert.equal(iso(run), "2026-10-26T08:00:00.000Z");
});

test("a run exactly at the scheduled time moves to the next occurrence", () => {
  const at = new Date("2026-07-01T06:30:00Z");
  assert.equal(iso(nextRun("DAILY", null, "07:30", at)), "2026-07-02T06:30:00.000Z");
});

test("time parsing and schedule wording", () => {
  assert.deepEqual(parseTime("07:05"), { hour: 7, minute: 5 });
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("7:00"), null);
  assert.equal(describeSchedule("WEEKDAYS", null, "07:30"), "Weekdays at 07:30");
  assert.equal(describeSchedule("WEEKLY", 5, "16:00"), "Every Friday at 16:00");
});
