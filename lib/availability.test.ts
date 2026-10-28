import assert from "node:assert/strict";
import test from "node:test";

import { clashingRule } from "./availability";

const day = (s: string) => new Date(`${s}T00:00:00Z`);
const at = (s: string) => new Date(s);

test("a weekly rule blocks only its weekday", () => {
  // Tuesdays, all of November 2026.
  const rules = [{ startsOn: day("2026-11-01"), endsOn: day("2026-11-30"), weekday: 2, reason: "Childcare" }];
  assert.ok(clashingRule(rules, at("2026-11-03T08:00:00Z"), at("2026-11-03T16:00:00Z")), "Tuesday 3 Nov is blocked");
  assert.equal(clashingRule(rules, at("2026-11-04T08:00:00Z"), at("2026-11-04T16:00:00Z")), null, "Wednesday is free");
});

test("a date range blocks every day in it, inclusive", () => {
  const rules = [{ startsOn: day("2026-12-24"), endsOn: day("2026-12-26"), weekday: null, reason: "Holiday" }];
  assert.ok(clashingRule(rules, at("2026-12-26T09:00:00Z"), at("2026-12-26T17:00:00Z")));
  assert.equal(clashingRule(rules, at("2026-12-27T09:00:00Z"), at("2026-12-27T17:00:00Z")), null);
});

test("a night shift counts both days it touches, in UK time", () => {
  // Monday night into Tuesday morning; the carer can't work Tuesdays.
  const rules = [{ startsOn: day("2026-11-01"), endsOn: day("2026-11-30"), weekday: 2, reason: null }];
  const clash = clashingRule(rules, at("2026-11-02T20:00:00Z"), at("2026-11-03T08:00:00Z"));
  assert.equal(clash?.date, "2026-11-03");
  // In British Summer Time, 23:30 UTC is already the next UK day.
  const summer = [{ startsOn: day("2026-07-01"), endsOn: day("2026-07-31"), weekday: 3, reason: null }];
  assert.ok(clashingRule(summer, at("2026-07-14T23:30:00Z"), at("2026-07-15T03:00:00Z")), "starts on Wednesday 15th UK time");
});
