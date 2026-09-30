import assert from "node:assert/strict";
import { test } from "node:test";

import { addDays, startOfDay } from "date-fns";

import { asLedgerRow, creditBand, creditHealth, type HomeLedgerRow } from "./credit";

const NOW = new Date(2026, 8, 30, 12, 0); // Wed 30 Sep 2026

function paid(p: Partial<HomeLedgerRow> = {}): HomeLedgerRow {
  return {
    id: "inv",
    status: "PAID",
    issueDate: new Date(2026, 8, 1),
    dueDate: new Date(2026, 8, 15),
    paidAt: new Date(2026, 8, 12),
    grandTotal: 1000,
    ...p,
  };
}

test("a home with no payment history is unproven, never scored high", () => {
  const health = creditHealth([asLedgerRow({ id: "a", status: "ISSUED", issueDate: NOW, dueDate: addDays(NOW, 20), paidAt: null, grandTotal: 500 })], NOW);
  assert.equal(health.paidCount, 0);
  assert.ok(health.score <= 49, `expected unproven score, got ${health.score}`);
  assert.ok(health.band === "D" || health.band === "E", `expected D/E, got ${health.band}`);
  assert.match(health.detail, /unproven/);
});

test("a long on-time payment history scores A", () => {
  const rows = [1, 2, 3, 4].map((i) =>
    paid({ id: `inv-${i}`, paidAt: startOfDay(addDays(new Date(2026, 7, 1), i * 10)) }),
  );
  const health = creditHealth(rows, NOW);
  assert.equal(health.paidCount, 4);
  assert.equal(health.paidOnTimeCount, 4);
  assert.ok(health.score >= 85, `expected A, got ${health.score}`);
  assert.equal(health.band, "A");
});

test("late payments drag the band down", () => {
  const rows = [
    paid({ id: "on-time", dueDate: new Date(2026, 8, 15), paidAt: new Date(2026, 8, 12) }),
    paid({ id: "late", dueDate: new Date(2026, 8, 15), paidAt: new Date(2026, 8, 30) }),
  ];
  const health = creditHealth(rows, NOW);
  assert.equal(health.paidOnTimeCount, 1);
  assert.ok(health.score < 70, `expected sub-B, got ${health.score}`);
  assert.notEqual(health.band, "A");
});

test("overdue unpaid work penalises the open position", () => {
  const rows = [
    paid({ id: "p1", dueDate: new Date(2026, 8, 15), paidAt: new Date(2026, 8, 12) }),
    paid({ id: "p2", dueDate: new Date(2026, 8, 15), paidAt: new Date(2026, 8, 12) }),
    asLedgerRow({ id: "o1", status: "ISSUED", issueDate: new Date(2026, 8, 20), dueDate: new Date(2026, 8, 25), paidAt: null, grandTotal: 2000 }),
  ];
  const health = creditHealth(rows, NOW);
  assert.equal(health.overdueAmount, 2000);
  assert.equal(health.openAmount, 2000);
  assert.ok(health.score < 70, `expected penalty applied, got ${health.score}`);
});

test("a current live book with no overdue earns a small bonus", () => {
  const rows = [
    paid({ id: "p1", dueDate: new Date(2026, 8, 15), paidAt: new Date(2026, 8, 12) }),
    asLedgerRow({ id: "o1", status: "ISSUED", issueDate: new Date(2026, 8, 20), dueDate: addDays(NOW, 10), paidAt: null, grandTotal: 800 }),
  ];
  const health = creditHealth(rows, NOW);
  assert.equal(health.overdueAmount, 0);
  assert.equal(health.band, "B");
  assert.ok(health.score >= 70, `expected B or better, got ${health.score}`);
});

test("bands are stable and monotonic", () => {
  assert.equal(creditBand(85), "A");
  assert.equal(creditBand(70), "B");
  assert.equal(creditBand(50), "C");
  assert.equal(creditBand(30), "D");
  assert.equal(creditBand(0), "E");
});