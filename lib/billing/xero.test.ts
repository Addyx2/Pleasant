import assert from "node:assert/strict";
import { test } from "node:test";

import { buildXeroBillsCsv, mapStatus, type XeroBillsInvoice } from "./xero";

function invoice(overrides: Partial<XeroBillsInvoice> = {}): XeroBillsInvoice {
  return {
    reference: "INV-202609-0001",
    status: "ISSUED",
    contactName: "Meadow View Care Home",
    contactEmail: "accounts@meadowview.example",
    contactAddress: "1 High St",
    contactPostcode: "SW1A 1AA",
    contactVatNumber: "GB123456789",
    issueDate: new Date(2026, 8, 1),
    dueDate: new Date(2026, 8, 15),
    currency: "GBP",
    subtotal: 1200,
    vat: 0,
    total: 1200,
    lines: [
      { description: "Day shift — Jane Hughes", quantity: 12, unitAmount: 100, accountCode: "200", taxType: "None" },
    ],
    ...overrides,
  };
}

test("mapStatus maps Pleasant statuses onto Xero bill statuses", () => {
  assert.equal(mapStatus("DRAFT"), "DRAFT");
  assert.equal(mapStatus("ISSUED"), "SUBMITTED");
  assert.equal(mapStatus("PAID"), "PAID");
  assert.equal(mapStatus("VOID"), "VOID");
});

test("the header row is the expected Xero column list", () => {
  const header = buildXeroBillsCsv([]).split("\r\n")[0];
  assert.equal(
    header,
    "Contact,Contact Email,Contact Address,Contact Postcode,InvoiceNumber,Date,DueDate,Status,Currency,LineAmount,LineDescription,LineQuantity,LineUnitAmount,LineAccountCode,LineTaxType,SubTotal,TotalTax,Total",
  );
});

test("a single-line invoice exports one row with the contact block repeated", () => {
  const rows = buildXeroBillsCsv([invoice()]).split("\r\n");
  assert.equal(rows.length, 2);
  assert.equal(
    rows[1],
    "Meadow View Care Home,accounts@meadowview.example,1 High St,SW1A 1AA,INV-202609-0001,2026-09-01,2026-09-15,SUBMITTED,GBP,12.00,Day shift — Jane Hughes,12.00,100.00,200,None,1200.00,0.00,1200.00",
  );
});

test("multi-line invoices emit one row per line sharing the invoice number", () => {
  const csv = buildXeroBillsCsv([
    invoice({
      lines: [
        { description: "Mon", quantity: 8, unitAmount: 20, accountCode: "200", taxType: "None" },
        { description: "Tue", quantity: 8, unitAmount: 20, accountCode: "200", taxType: "None" },
      ],
    }),
  ]);
  const rows = csv.split("\r\n").slice(1);
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.ok(row.includes("INV-202609-0001"));
  }
  assert.ok(rows[0].includes(",Mon,"));
  assert.ok(rows[1].includes(",Tue,"));
});

test("dates are exported as YYYY-MM-DD", () => {
  const csv = buildXeroBillsCsv([invoice({ issueDate: new Date(2026, 0, 5), dueDate: null })]);
  assert.ok(csv.includes(",2026-01-05,,SUBMITTED,"));
});

test("an invoice with no issue date exports a blank date cell", () => {
  const csv = buildXeroBillsCsv([invoice({ issueDate: null })]);
  assert.ok(csv.includes("INV-202609-0001,,2026-09-15,SUBMITTED"));
});

test("commas and quotes in descriptions are escaped", () => {
  const csv = buildXeroBillsCsv([
    invoice({
      lines: [
        { description: 'Day shift, "Meadow View"', quantity: 1, unitAmount: 10, accountCode: "200", taxType: "None" },
      ],
    }),
  ]);
  assert.ok(csv.includes('"Day shift, ""Meadow View"""'));
});

test("multiple invoices are all included", () => {
  const csv = buildXeroBillsCsv([invoice(), invoice({ reference: "INV-202609-0002" })]);
  assert.equal(csv.split("\r\n").length, 3);
});

test("the revenue account code can be overridden", () => {
  const csv = buildXeroBillsCsv([invoice()], { revenueAccountCode: "400" });
  assert.ok(csv.includes(",400,None,"));
});

test("an invoice with no lines still exports a placeholder row", () => {
  const csv = buildXeroBillsCsv([invoice({ lines: [] })]);
  const rows = csv.split("\r\n");
  assert.equal(rows.length, 2);
  assert.ok(rows[1].includes("Invoice total"));
});

test("an empty invoice list still produces a valid header", () => {
  const csv = buildXeroBillsCsv([]);
  assert.equal(csv.split("\r\n").length, 1);
  assert.ok(csv.startsWith("Contact,Contact Email"));
});