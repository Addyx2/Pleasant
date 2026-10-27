import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBacsStd18,
  buildPaymentsCsv,
  isValidBankDetails,
  normalizeAccount,
  normalizeSortCode,
  type BacsFileInput,
} from "./bacs";

const PAY_DATE = new Date(2026, 8, 30);

function input(overrides: Partial<BacsFileInput> = {}): BacsFileInput {
  return {
    runReference: "2026-09-W4",
    paymentDate: PAY_DATE,
    originator: { sortCode: "40-47-71", bankAcct: "12345678", name: "Pleasant Care Ltd" },
    payees: [
      {
        reference: "PAY2026W4",
        staffName: "Ada Lovelace",
        accountName: "Ada Lovelace",
        sortCode: "20-00-00",
        bankAcct: "11223344",
        amount: 468.75,
      },
      {
        reference: "PAY2026W4",
        staffName: "Alan Turing",
        accountName: "Alan Turing",
        sortCode: "30-00-00",
        bankAcct: "55667788",
        amount: 512.1,
      },
    ],
    ...overrides,
  };
}

test("normalisation strips non-digits and enforces widths", () => {
  assert.equal(normalizeSortCode("20-00-00"), "200000");
  assert.equal(normalizeSortCode("20 00 0"), "20000");
  assert.equal(normalizeAccount("11223344"), "11223344");
  assert.equal(normalizeAccount("1122 3344"), "11223344");
  assert.equal(isValidBankDetails("20-00-00", "11223344"), true);
  assert.equal(isValidBankDetails("2000", "11223344"), false);
  assert.equal(isValidBankDetails("20-00-00", "112233"), false);
});

test("payments CSV contains a header and one row per eligible payee", () => {
  const result = buildPaymentsCsv(input());
  assert.equal(result.count, 2);
  assert.equal(result.skipped, 0);
  const lines = result.csv.split("\r\n");
  assert.equal(lines[0], "Sort code,Account number,Account name,Amount,Reference,Payment date");
  assert.equal(lines.length, 3);
  assert.match(lines[1], /^200000,11223344,Ada Lovelace,468\.75,PAY2026W4,2026-09-30$/);
  assert.equal(result.total, 980.85);
});

test("payees without bank details are skipped, never dropped or rebanked", () => {
  const result = buildPaymentsCsv(
    input({
      payees: [
        ...input().payees,
        { reference: "PAY2026W4", staffName: "Grace Hopper", accountName: "", sortCode: "", bankAcct: "", amount: 300 },
      ],
    }),
  );
  assert.equal(result.count, 2);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.missingBank, ["Grace Hopper"]);
  assert.ok(!result.csv.includes("Grace Hopper"));
});

test("STD18 records are fixed-width 96 columns with zero-padded pence", () => {
  const result = buildBacsStd18(input());
  assert.equal(result.count, 2);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].length, 96);
  const first = result.records[0];
  assert.equal(first.slice(0, 6), "200000");
  assert.equal(first.slice(6, 14), "11223344");
  assert.equal(first.slice(14, 15), "1");
  assert.equal(first.slice(15, 17), "99");
  assert.equal(first.slice(17, 28), "00000046875");
  assert.equal(first.slice(28, 46).trimEnd(), "Ada Lovelace");
  assert.equal(first.slice(46, 52), "404771");
  assert.equal(first.slice(52, 60), "12345678");
  assert.equal(first.slice(60, 78).trimEnd(), "PAY2026W4");
  assert.equal(first.slice(78, 96).trimEnd(), "Pleasant Care Ltd");
});

test("total is the sum of included payees only", () => {
  const result = buildBacsStd18(input());
  assert.equal(result.total, Math.round((468.75 + 512.1) * 100) / 100);
});