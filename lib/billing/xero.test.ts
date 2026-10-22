import assert from "node:assert/strict";
import { test } from "node:test";

import {
  XERO_SALES_HEADERS,
  buildXeroSalesInvoicesCsv,
  ukDate,
  xeroTaxType,
  type XeroSalesInvoice,
} from "./xero";

function invoice(overrides: Partial<XeroSalesInvoice> = {}): XeroSalesInvoice {
  return {
    invoiceNumber: "INV-202609-0001",
    reference: "MV-FA-2026",
    contactName: "Meadow View Care Home",
    contactEmail: "accounts@meadowview.example",
    contactAddress: "1 High St",
    contactPostcode: "SW1A 1AA",
    invoiceDate: new Date(2026, 8, 1),
    dueDate: new Date(2026, 8, 15),
    currency: "GBP",
    taxType: "Exempt Income",
    lines: [{ description: "Day shift — Jane Hughes", quantity: 12, unitAmount: 100 }],
    ...overrides,
  };
}

/** Parse one exported row into header → value (no quoted commas in these fixtures). */
function row(csv: string, index = 1): Record<string, string> {
  const values = csv.split("\r\n")[index].split(",");
  return Object.fromEntries(XERO_SALES_HEADERS.map((h, i) => [h, values[i]]));
}

test("the header row is Xero's sales invoice template", () => {
  const header = buildXeroSalesInvoicesCsv([]).split("\r\n")[0];
  assert.equal(
    header,
    "*ContactName,EmailAddress,POAddressLine1,POAddressLine2,POAddressLine3,POAddressLine4,POCity,PORegion,POPostalCode,POCountry,*InvoiceNumber,Reference,*InvoiceDate,*DueDate,Total,InventoryItemCode,*Description,*Quantity,*UnitAmount,Discount,*AccountCode,*TaxType,TaxAmount,TrackingName1,TrackingOption1,TrackingName2,TrackingOption2,Currency,BrandingTheme",
  );
});

test("a line exports contact, invoice, quantity and unit amount in the right columns", () => {
  const r = row(buildXeroSalesInvoicesCsv([invoice()]));
  assert.equal(r["*ContactName"], "Meadow View Care Home");
  assert.equal(r.EmailAddress, "accounts@meadowview.example");
  assert.equal(r.POAddressLine1, "1 High St");
  assert.equal(r.POPostalCode, "SW1A 1AA");
  assert.equal(r["*InvoiceNumber"], "INV-202609-0001");
  assert.equal(r.Reference, "MV-FA-2026");
  assert.equal(r["*Description"], "Day shift — Jane Hughes");
  assert.equal(r["*Quantity"], "12.00");
  assert.equal(r["*UnitAmount"], "100.00");
  assert.equal(r["*AccountCode"], "200");
  assert.equal(r["*TaxType"], "Exempt Income");
  assert.equal(r.Currency, "GBP");
});

test("dates use the UK DD/MM/YYYY format Xero expects for UK organisations", () => {
  assert.equal(ukDate(new Date(2026, 0, 5)), "05/01/2026");
  const r = row(buildXeroSalesInvoicesCsv([invoice()]));
  assert.equal(r["*InvoiceDate"], "01/09/2026");
  assert.equal(r["*DueDate"], "15/09/2026");
});

test("multi-line invoices emit one row per line sharing the invoice number", () => {
  const csv = buildXeroSalesInvoicesCsv([
    invoice({
      lines: [
        { description: "Mon", quantity: 7.5, unitAmount: 24.5 },
        { description: "Sleep-in", quantity: 1, unitAmount: 85 },
      ],
    }),
  ]);
  assert.equal(row(csv, 1)["*InvoiceNumber"], "INV-202609-0001");
  assert.equal(row(csv, 2)["*InvoiceNumber"], "INV-202609-0001");
  assert.equal(row(csv, 2)["*Quantity"], "1.00");
  assert.equal(row(csv, 2)["*UnitAmount"], "85.00");
});

test("unit amounts that aren't whole pence keep four decimal places", () => {
  const r = row(buildXeroSalesInvoicesCsv([invoice({ lines: [{ description: "x", quantity: 3, unitAmount: 33.3333 }] })]));
  assert.equal(r["*UnitAmount"], "33.3333");
});

test("xeroTaxType maps VAT rates onto Xero's UK tax rate names", () => {
  assert.equal(xeroTaxType(20, "exempt"), "20% (VAT on Income)");
  assert.equal(xeroTaxType(0, "exempt"), "Exempt Income");
  assert.equal(xeroTaxType(0, "zeroRated"), "Zero Rated Income");
  assert.equal(xeroTaxType(0, "noVat"), "No VAT");
});

test("text is escaped and can't run as a spreadsheet formula", () => {
  const csv = buildXeroSalesInvoicesCsv([
    invoice({
      contactName: '=HYPERLINK("x")',
      lines: [{ description: 'Day shift, "Meadow View"', quantity: 1, unitAmount: 10 }],
    }),
  ]);
  assert.ok(csv.includes('"Day shift, ""Meadow View"""'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
});

test("the revenue account code can be overridden", () => {
  assert.equal(row(buildXeroSalesInvoicesCsv([invoice()], { accountCode: "4000" }))["*AccountCode"], "4000");
});

test("invoices without lines produce no rows", () => {
  assert.equal(buildXeroSalesInvoicesCsv([invoice({ lines: [] })]).split("\r\n").filter(Boolean).length, 1);
});
