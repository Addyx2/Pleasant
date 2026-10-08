import assert from "node:assert/strict";
import { test } from "node:test";

import { buildWeek, formatHhMm, isValidLine, lineEndFor, lineDateFor, matchesWeekday, parseHhMm } from "./rota";

const MON = new Date(2026, 2, 9); // Mon 9 Mar 2026
const SUN = new Date(2026, 2, 15); // Sun 15 Mar 2026

test("parseHhMm reads a 24-hour time", () => {
  assert.equal(parseHhMm("07:00"), 420);
  assert.equal(parseHhMm("22:30"), 1350);
  assert.equal(parseHhMm("7:05"), 425);
});

test("parseHhMm rejects malformed or out-of-range values", () => {
  assert.equal(parseHhMm("25:00"), null);
  assert.equal(parseHhMm("07:99"), null);
  assert.equal(parseHhMm("0700"), null);
  assert.equal(parseHhMm(""), null);
});

test("formatHhMm zero-pads and round-trips", () => {
  assert.equal(formatHhMm(420), "07:00");
  assert.equal(formatHhMm(0), "00:00");
  assert.equal(parseHhMm(formatHhMm(1385)), 1385);
});

test("buildWeek snaps any day to the Monday of its week", () => {
  assert.equal(buildWeek(MON).start.getDate(), 9);
  assert.equal(buildWeek(SUN).start.getDate(), 9);
  assert.equal(buildWeek(new Date(2026, 2, 11)).start.getDate(), 9);
});

test("buildWeek returns seven days Monday first, 0=Sunday weekday keys", () => {
  const week = buildWeek(SUN);
  assert.equal(week.days.length, 7);
  assert.deepEqual(
    week.days.map((d) => d.weekday),
    [1, 2, 3, 4, 5, 6, 0],
  );
  assert.equal(week.days[0].date.getDate(), 9);
  assert.equal(week.days[6].date.getDate(), 15);
});

test("matchesWeekday lines up a template line with its day", () => {
  assert.ok(matchesWeekday({ weekday: 1 }, MON));
  assert.ok(matchesWeekday({ weekday: 0 }, SUN));
  assert.ok(!matchesWeekday({ weekday: 1 }, SUN));
});

test("lineDateFor applies the start time to the generated date", () => {
  const d = lineDateFor({ weekday: 1, startMins: 7 * 60 }, MON);
  assert.equal(d.getDate(), 9);
  assert.equal(d.getHours(), 7);
  assert.equal(d.getMinutes(), 0);
});

test("lineEndFor uses the same day when the end clock is later", () => {
  const start = lineDateFor({ weekday: 1, startMins: 7 * 60 }, MON);
  const end = lineEndFor({ startMins: 7 * 60, endMins: 15 * 60 }, start);
  assert.equal(end.getDate(), 9);
  assert.equal(end.getHours(), 15);
});

test("lineEndFor rolls overnight shifts to the next day", () => {
  const start = lineDateFor({ weekday: 1, startMins: 22 * 60 }, MON);
  const end = lineEndFor({ startMins: 22 * 60, endMins: 7 * 60 }, start);
  assert.equal(end.getDate(), 10);
  assert.equal(end.getHours(), 7);
});

test("isValidLine requires a role, title and a positive duration", () => {
  assert.ok(isValidLine({ startMins: 420, endMins: 900, role: "Care Assistant", title: "Day shift" }));
  assert.ok(!isValidLine({ startMins: 420, endMins: 420, role: "Care Assistant", title: "Day shift" }));
});

test("isValidLine accepts overnight shifts measured across midnight", () => {
  assert.ok(isValidLine({ startMins: 22 * 60, endMins: 7 * 60, role: "Night", title: "Night shift" }));
  assert.ok(isValidLine({ startMins: 900, endMins: 420, role: "Night", title: "Night shift" }));
});

test("isValidLine rejects an overnight shift longer than 16 hours", () => {
  assert.ok(!isValidLine({ startMins: 8 * 60, endMins: 7 * 60, role: "Night", title: "Night shift" }));
});

test("isValidLine rejects blank role or title", () => {
  assert.ok(!isValidLine({ startMins: 420, endMins: 900, role: "  ", title: "Day shift" }));
  assert.ok(!isValidLine({ startMins: 420, endMins: 900, role: "Care Assistant", title: "" }));
});

test("isValidLine rejects implausibly long shifts", () => {
  assert.ok(!isValidLine({ startMins: 0, endMins: 23 * 60, role: "Night", title: "Night shift" }));
});
