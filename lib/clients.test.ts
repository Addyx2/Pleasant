import assert from "node:assert/strict";
import { test } from "node:test";

import { clientName, findRate, resolveSleepInCharge, resolveChargeRate, shiftRateBand, siteNoun, type RateCardEntry } from "./clients";

const card: RateCardEntry[] = [
  { role: "Care Assistant", siteId: null, dayRate: 18, nightRate: 19.5, weekendRate: 20, bankHolidayRate: 27, sleepInCharge: 95 },
  { role: "Care Assistant", siteId: "dementia-unit", dayRate: 19, nightRate: null, weekendRate: null, bankHolidayRate: null, sleepInCharge: null },
  { role: "Registered Nurse", siteId: null, dayRate: 32, nightRate: null, weekendRate: null, bankHolidayRate: null, sleepInCharge: null },
];

// Local-time constructors, matching how the payroll engine reads hours.
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

test("clientName prefers the organisation name and falls back for legacy rows", () => {
  assert.equal(clientName({ name: "Meadow View Care Home" }), "Meadow View Care Home");
  assert.equal(clientName({ name: null, companyName: "Oak Lodge" }), "Oak Lodge");
  assert.equal(clientName({ name: null, firstName: "Margaret", lastName: "Hughes" }), "Margaret Hughes");
  assert.equal(clientName(null), "No client");
});

test("siteNoun uses branches for domiciliary providers", () => {
  assert.equal(siteNoun("CARE_HOME"), "unit");
  assert.equal(siteNoun("DOMICILIARY_PROVIDER", true), "branches");
});

test("findRate prefers a site-specific line and matches roles loosely", () => {
  assert.equal(findRate(card, "care  assistant", "dementia-unit")?.dayRate, 19);
  assert.equal(findRate(card, "Care Assistant", "other-unit")?.dayRate, 18);
  assert.equal(findRate(card, "Care Assistant", null)?.dayRate, 18);
  assert.equal(findRate(card, "Cook", null), null);
});

test("shiftRateBand picks the band covering most of the shift", () => {
  // Wednesday 21 Oct 2026
  assert.equal(shiftRateBand(at(2026, 10, 21, 8), at(2026, 10, 21, 20)), "DAY");
  assert.equal(shiftRateBand(at(2026, 10, 21, 20), at(2026, 10, 22, 8)), "NIGHT");
  // Saturday 24 Oct 2026
  assert.equal(shiftRateBand(at(2026, 10, 24, 8), at(2026, 10, 24, 20)), "WEEKEND");
  // Christmas Day 2026 (Friday)
  assert.equal(shiftRateBand(at(2026, 12, 25, 8), at(2026, 12, 25, 20)), "BANK_HOLIDAY");
});

test("resolveChargeRate applies the band with day-rate fallbacks", () => {
  assert.equal(resolveChargeRate(card, { role: "Care Assistant", startAt: at(2026, 10, 21, 20), endAt: at(2026, 10, 22, 8) })?.rate, 19.5);
  assert.equal(resolveChargeRate(card, { role: "Care Assistant", startAt: at(2026, 12, 25, 8), endAt: at(2026, 12, 25, 20) })?.rate, 27);
  // Nurse has no weekend rate: falls back to day.
  const nurse = resolveChargeRate(card, { role: "Registered Nurse", startAt: at(2026, 10, 24, 8), endAt: at(2026, 10, 24, 20) });
  assert.deepEqual([nurse?.rate, nurse?.band], [32, "WEEKEND"]);
  // Site line without a night rate falls back to its own day rate.
  assert.equal(
    resolveChargeRate(card, { role: "Care Assistant", siteId: "dementia-unit", startAt: at(2026, 10, 21, 20), endAt: at(2026, 10, 22, 8) })?.rate,
    19,
  );
});

test("roles missing from the card resolve to nothing", () => {
  assert.equal(resolveChargeRate(card, { role: "Cook", startAt: at(2026, 10, 21, 8), endAt: at(2026, 10, 21, 16) }), null);
});

test("resolveSleepInCharge reads the flat charge from the matching line", () => {
  assert.equal(resolveSleepInCharge(card, { role: "Care Assistant" }), 95);
  // The unit line has no sleep-in charge, so the client-wide one applies.
  assert.equal(resolveSleepInCharge(card, { role: "Care Assistant", siteId: "dementia-unit" }), 95);
  assert.equal(resolveSleepInCharge(card, { role: "Registered Nurse" }), null);
  assert.equal(resolveSleepInCharge(card, { role: "Cook" }), null);
});
