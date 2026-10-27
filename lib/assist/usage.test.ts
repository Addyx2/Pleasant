import assert from "node:assert/strict";
import { test } from "node:test";

import { allowanceFrom, costMicros, monthlyCapUsd, usageMonth } from "./usage";

test("costMicros prices each kind of token", () => {
  // 1M input ($4) + 100k output ($2) + 1M cache read ($0.20) + 200k cache write ($1).
  assert.equal(
    costMicros({ input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 200_000 }),
    7_200_000,
  );
  assert.equal(costMicros({ input_tokens: 10, output_tokens: 0, cache_read_input_tokens: null }), 40);
});

test("usageMonth uses the UK calendar month", () => {
  // 23:30 UTC on 31 Oct is still October in the UK (GMT); 23:30 UTC on 31 Aug is 1 Sep (BST).
  assert.equal(usageMonth(new Date("2026-10-31T23:30:00Z")), "2026-10");
  assert.equal(usageMonth(new Date("2026-08-31T23:30:00Z")), "2026-09");
});

test("monthlyCapUsd prefers the agency override, then the environment, then the default", () => {
  assert.equal(monthlyCapUsd(120, "80"), 120);
  assert.equal(monthlyCapUsd(0, "80"), 0);
  assert.equal(monthlyCapUsd(null, "80"), 80);
  assert.equal(monthlyCapUsd(null, "junk"), 50);
  assert.equal(monthlyCapUsd(undefined, undefined), 50);
});

test("allowanceFrom reports progress and when the cap is reached", () => {
  assert.deepEqual(allowanceFrom("2026-10", 24_990_000, 50), {
    month: "2026-10",
    usedMicros: 24_990_000,
    capMicros: 50_000_000,
    percent: 49,
    exhausted: false,
  });
  assert.equal(allowanceFrom("2026-10", 50_000_000, 50).exhausted, true);
  assert.equal(allowanceFrom("2026-10", 90_000_000, 50).percent, 100);
  assert.equal(allowanceFrom("2026-10", 0, 0).exhausted, true);
});
