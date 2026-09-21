import assert from "node:assert/strict";
import { test } from "node:test";

import {
  annualIncomeTax,
  calculatePayslip,
  computeShiftEarnings,
  employeeNi,
  parseTaxCode,
  roundMinutes,
} from "./engine";
import { getTaxYearConfig } from "./rates";

const config = getTaxYearConfig("2026/27");

test("parseTaxCode understands standard and special codes", () => {
  assert.equal(parseTaxCode("1257L", config).allowance, 12570);
  assert.equal(parseTaxCode("0T", config).allowance, 0);
  assert.equal(parseTaxCode("BR", config).flatRate, 0.2);
  assert.equal(parseTaxCode("D0", config).flatRate, 0.4);
  assert.equal(parseTaxCode("NT", config).flatRate, 0);
  assert.equal(parseTaxCode("K475", config).allowance, -4750);
});

test("annual income tax for £45,000 on 1257L is £6,486", () => {
  assert.equal(annualIncomeTax(45000, "1257L", config), 6486);
});

test("personal allowance tapers above £100,000", () => {
  // £110,000 -> allowance reduced by £5,000 to £7,570.
  const tax = annualIncomeTax(110000, "1257L", config);
  const expected = (110000 - 7570) * 0.2 - 37700 * 0.2 + 37700 * 0.2; // sanity
  assert.ok(tax > 0);
  assert.ok(Number.isFinite(expected));
  // Taxable £102,430: 37,700 @ 20% + 64,730 @ 40% = 7,540 + 25,892
  assert.equal(tax, 33432);
});

test("monthly payslip for £3,750 gross with pension", () => {
  const result = calculatePayslip({
    grossEarnings: 3750,
    period: "MONTHLY",
    taxYear: "2026/27",
    staff: {
      taxCode: "1257L",
      pensionEnrolled: true,
      pensionEmployeePct: 5,
      pensionEmployerPct: 3,
      holidayAccrualPct: 0,
    },
  });

  assert.equal(result.paye, 540.5);
  assert.equal(result.niEmployee, 216.2);
  assert.equal(result.pensionEmployee, 161.5);
  assert.equal(result.pensionEmployer, 96.9);
  assert.equal(result.employerNi, 500);
  assert.equal(result.netPay, 2831.8);
  assert.equal(result.employerTotalCost, 4346.9);
});

test("holiday pay accrues at the staff member's percentage", () => {
  const result = calculatePayslip({
    grossEarnings: 1000,
    period: "WEEKLY",
    taxYear: "2026/27",
    staff: {
      taxCode: "1257L",
      pensionEnrolled: false,
      pensionEmployeePct: 0,
      pensionEmployerPct: 0,
      holidayAccrualPct: 12.07,
    },
  });
  assert.equal(result.holidayPay, 120.7);
  assert.equal(result.taxablePay, 1120.7);
});

test("employee NI is capped at the upper earnings limit", () => {
  // £10,000 in a month: 8% on (4,189.17 - 1,047.50) + 2% above 4,189.17
  const expected = (50270 / 12 - 12570 / 12) * 0.08 + (10000 - 50270 / 12) * 0.02;
  assert.equal(employeeNi(10000, "MONTHLY", config), Math.round(expected * 100) / 100);
});

test("weekday daytime shift pays base rate", () => {
  const result = computeShiftEarnings({
    startAt: new Date("2026-09-22T09:00:00"),
    endAt: new Date("2026-09-22T17:00:00"),
    breakMins: 0,
    rates: { baseRate: 12.71 },
  });
  assert.equal(result.paidMins, 480);
  assert.equal(result.normalMins, 480);
  assert.equal(result.totalEarnings, 101.68);
});

test("evening shift uses the night rate", () => {
  const result = computeShiftEarnings({
    startAt: new Date("2026-09-23T20:00:00"),
    endAt: new Date("2026-09-23T23:00:00"),
    breakMins: 0,
    rates: { baseRate: 12.71, nightRate: 2 },
  });
  assert.equal(result.nightMins, 180);
  assert.equal(result.totalEarnings, 6);
});

test("weekend shift uses the weekend rate", () => {
  const result = computeShiftEarnings({
    startAt: new Date("2026-09-26T12:00:00"),
    endAt: new Date("2026-09-26T14:00:00"),
    breakMins: 0,
    rates: { baseRate: 12.71, weekendRate: 15 },
  });
  assert.equal(result.weekendMins, 120);
  assert.equal(result.totalEarnings, 30);
});

test("bank holiday shift uses the bank holiday rate", () => {
  const result = computeShiftEarnings({
    startAt: new Date("2026-12-25T10:00:00"),
    endAt: new Date("2026-12-25T12:00:00"),
    breakMins: 0,
    rates: { baseRate: 12.71, bankHolidayRate: 20 },
  });
  assert.equal(result.bankHolidayMins, 120);
  assert.equal(result.totalEarnings, 40);
});

test("paid minutes round to the nearest quarter hour", () => {
  assert.equal(roundMinutes(487, 15), 480);
  assert.equal(roundMinutes(493, 15), 495);
  assert.equal(roundMinutes(480, 15), 480);
  assert.equal(roundMinutes(487, 0), 487);

  const result = computeShiftEarnings({
    startAt: new Date("2026-09-22T09:00:00"),
    endAt: new Date("2026-09-22T17:07:00"),
    breakMins: 0,
    rates: { baseRate: 10 },
    roundingMins: 15,
  });
  assert.equal(result.paidMins, 480);
  assert.equal(result.totalEarnings, 80);
});

test("sleep-in shifts pay a flat allowance", () => {
  const result = computeShiftEarnings({
    startAt: new Date("2026-09-26T22:00:00"),
    endAt: new Date("2026-09-27T06:00:00"),
    breakMins: 0,
    rates: { baseRate: 12.71 },
    isSleepIn: true,
    sleepInRate: 45,
  });
  assert.equal(result.totalEarnings, 45);
  assert.equal(result.breakdown[0].label, "Sleep-in allowance (flat)");
});

test("expenses are added to net pay without tax", () => {
  const result = calculatePayslip({
    grossEarnings: 1000,
    period: "WEEKLY",
    taxYear: "2026/27",
    staff: {
      taxCode: "1257L",
      pensionEnrolled: false,
      pensionEmployeePct: 0,
      pensionEmployerPct: 0,
      holidayAccrualPct: 0,
    },
    expenses: 25,
  });
  assert.equal(result.expenses, 25);
  assert.equal(result.taxablePay, 1000);
  // £1,000/week crosses the higher-rate and UEL thresholds:
  // PAYE £158.31, NI £58 + £0.67 — expenses still land in net pay untaxed.
  assert.equal(result.paye, 158.31);
  assert.equal(result.niEmployee, 58.67);
  assert.equal(result.netPay, 808.02);
});

test("unpaid breaks reduce paid minutes", () => {
  const result = computeShiftEarnings({
    startAt: new Date("2026-09-22T09:00:00"),
    endAt: new Date("2026-09-22T17:00:00"),
    breakMins: 60,
    rates: { baseRate: 10 },
  });
  assert.equal(result.paidMins, 420);
  assert.equal(result.totalEarnings, 70);
});
