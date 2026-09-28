import assert from "node:assert/strict";
import { test } from "node:test";

import { buildFpsCsv, type RtiPayslip } from "./rti";

const paye = (overrides: Partial<RtiPayslip> = {}): RtiPayslip => ({
  employee: { firstName: "Jane", lastName: "Doe" },
  niNumber: "QQ123456C",
  taxCode: "1257L",
  hours: 35,
  grossPay: 525,
  holidayPay: 63.37,
  expenses: 0,
  taxablePay: 588.37,
  paye: 94.7,
  niEmployee: 52.45,
  niEmployer: 41.1,
  pensionEmployee: 24.12,
  pensionEmployer: 14.47,
  studentLoan: 0,
  otherDeductions: 0,
  netPay: 417.1,
  ...overrides,
});

test("excludes LTD engagements from the FPS file and reports them in the summary", () => {
  const { csv, summary } = buildFpsCsv({
    runReference: "2026-09-M1",
    taxYear: "2026/27",
    payFrequency: "MONTHLY",
    paymentDate: new Date(2026, 8, 25),
    employerPayeRef: "123/AB45678",
    payslips: [
      paye(),
      paye({ employee: { firstName: "Elena", lastName: "Popescu" }, taxCode: "LTD", hours: 40 }),
    ],
  });

  assert.equal(summary.totalPayslips, 2);
  assert.equal(summary.excludedLtd, 1);
  assert.equal(summary.included, 1);
  assert.ok(csv.includes("Jane,Doe"));
  assert.ok(!csv.includes("Elena,Popescu"));
});

test("csv escapes commas and quotes inside names", () => {
  const { csv } = buildFpsCsv({
    runReference: "2026-09-M1",
    taxYear: "2026/27",
    payFrequency: "WEEKLY",
    paymentDate: new Date(2026, 8, 4),
    employerPayeRef: "123/AB45678",
    payslips: [paye({ employee: { firstName: "O'Neil, Jr.", lastName: "Smith" } })],
  });
  assert.ok(csv.includes(`"O'Neil, Jr.",Smith`));
});

test("summary totals only include PAYE workers", () => {
  const { summary } = buildFpsCsv({
    runReference: "2026-09-M1",
    taxYear: "2026/27",
    payFrequency: "MONTHLY",
    paymentDate: new Date(2026, 8, 25),
    payslips: [paye(), paye({ employee: { firstName: "A", lastName: "Ltd" }, taxCode: "LTD", grossPay: 9999 })],
  });

  assert.equal(summary.totalGross, 525);
  assert.equal(summary.totalTaxable, 588.37);
  assert.equal(summary.totalNet, 417.1);
  assert.equal(summary.totalHours, 35);
});

test("empty set yields empty data rows but still a valid header", () => {
  const { csv, summary } = buildFpsCsv({
    runReference: "x",
    taxYear: "2026/27",
    payFrequency: "WEEKLY",
    paymentDate: new Date(2026, 8, 4),
    payslips: [],
  });
  assert.equal(summary.included, 0);
  assert.equal(csv.split("\n").length, 1); // header only
  assert.ok(csv.includes("employee_last_name"));
});

test("header row lists the expected columns", () => {
  const { csv } = buildFpsCsv({
    runReference: "x",
    taxYear: "2026/27",
    payFrequency: "WEEKLY",
    paymentDate: new Date(2026, 8, 4),
    payslips: [paye()],
  });
  const header = csv.split("\n")[0];
  for (const col of ["run_reference", "ni_number", "tax_code", "paye", "ni_employee", "hours_worked"]) {
    assert.ok(header.includes(col), `missing column ${col}`);
  }
});