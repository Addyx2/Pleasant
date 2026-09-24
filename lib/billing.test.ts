import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeInvoiceLine,
  defaultInvoiceReference,
  invoiceTotals,
  type BillableTimesheet,
} from "./billing";

const TUE_0900_1700 = () => {
  const start = new Date(2026, 8, 22, 9, 0); // Tue 22 Sep 2026
  const end = new Date(2026, 8, 22, 17, 0);
  return { startAt: start, endAt: end };
};

function baseTimesheet(overrides: Partial<BillableTimesheet> = {}): BillableTimesheet {
  const { startAt, endAt } = TUE_0900_1700();
  return {
    id: "ts-1",
    breakMins: 30,
    expenses: 0,
    shift: { id: "s-1", title: "Day support — Arthur", startAt, endAt, chargeRate: 24.5, isSleepIn: false, sleepInRate: 0 },
    staff: { id: "p-1", baseRate: 13.9, nightRate: 16.68, weekendRate: 18.07, bankHolidayRate: 22.24, holidayAccrualPct: 12.07 },
    ...overrides,
  };
}

test("normal shift: charge is rate x hours, margin is charge minus pay", () => {
  const line = computeInvoiceLine(baseTimesheet());
  // 7.5 paid hours after rounding a 30-min break to the quarter hour.
  assert.equal(line.hours, 7.5);
  assert.equal(line.chargeRate, 24.5);
  assert.equal(line.chargeAmount, 183.75);

  const pay = Math.round(7.5 * 13.9 * 100) / 100; // 104.25 gross
  const holiday = Math.round((pay * 12.07) / 100 * 100) / 100;
  const expectedPay = Math.round((pay + holiday) * 100) / 100;
  assert.equal(line.payAmount, expectedPay);
  assert.equal(line.marginAmount, Math.round((line.chargeAmount - expectedPay) * 100) / 100);
});

test("sleep-in shifts bill as a flat allowance", () => {
  const { startAt, endAt } = TUE_0900_1700();
  const line = computeInvoiceLine(
    baseTimesheet({
      shift: { id: "s-2", title: "Sleep-in — Sofia", startAt, endAt, chargeRate: 24.5, isSleepIn: true, sleepInRate: 45 },
      staff: { id: "p-2", baseRate: 12.71, holidayAccrualPct: 12.07 },
    }),
  );
  assert.equal(line.chargeAmount, 45);
  // Pay mirrors the payroll engine: flat allowance plus holiday accrual.
  assert.equal(line.payAmount, Math.round((45 + (45 * 12.07) / 100) * 100) / 100);
  assert.equal(line.marginAmount, Math.round((45 - line.payAmount) * 100) / 100);
});

test("rounding is consistent with the payroll engine:", () => {
  // 0 break minutes still rounds to the quarter hour.
  const line = computeInvoiceLine(baseTimesheet({ breakMins: 0 }));
  assert.equal(line.hours, 8);
  assert.equal(line.chargeAmount, 196);
});

test("expenses are included in worker cost (reduces margin)", () => {
  const without = computeInvoiceLine(baseTimesheet());
  const withExpense = computeInvoiceLine(baseTimesheet({ expenses: 12.4 }));
  assert.equal(withExpense.payAmount, Math.round((without.payAmount + 12.4) * 100) / 100);
  assert.equal(
    withExpense.marginAmount,
    Math.round((without.marginAmount - 12.4) * 100) / 100,
  );
});

test("invoiceTotals sums lines and applies VAT", () => {
  const a = computeInvoiceLine(baseTimesheet());
  const b = computeInvoiceLine(baseTimesheet({ expenses: 10 }));
  const totals = invoiceTotals([a, b], 20);
  assert.equal(totals.chargeTotal, Math.round((a.chargeAmount + b.chargeAmount) * 100) / 100);
  assert.equal(totals.payTotal, Math.round((a.payAmount + b.payAmount) * 100) / 100);
  assert.equal(totals.marginTotal, Math.round((totals.chargeTotal - totals.payTotal) * 100) / 100);
  assert.equal(totals.vatTotal, Math.round((totals.chargeTotal * 0.2) * 100) / 100);
  assert.equal(totals.grandTotal, Math.round((totals.chargeTotal + totals.vatTotal) * 100) / 100);
});

test("zero VAT leaves grand total equal to charge", () => {
  const totals = invoiceTotals([computeInvoiceLine(baseTimesheet())], 0);
  assert.equal(totals.vatTotal, 0);
  assert.equal(totals.grandTotal, totals.chargeTotal);
});

test("reference numbering pads the sequence", () => {
  assert.equal(defaultInvoiceReference(new Date(2026, 8, 30), 1), "INV-202609-0001");
  assert.equal(defaultInvoiceReference(new Date(2026, 8, 30), 214), "INV-202609-0214");
});