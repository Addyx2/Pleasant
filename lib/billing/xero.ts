/**
 * Xero bills CSV export.
 *
 * Exports invoices in the column layout Xero's "Import bills" CSV accepts,
 * so an agency can bring Pleasant invoices into Xero without an API key.
 * One row per invoice line, grouped by invoice reference — which is how
 * Xero groups imported lines into a single bill.
 */

export interface XeroBillsInvoice {
  reference: string;
  status: string;
  contactName: string;
  contactEmail: string | null;
  contactAddress: string | null;
  contactPostcode: string | null;
  contactVatNumber: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  currency: string;
  subtotal: number;
  vat: number;
  total: number;
  lines: {
    description: string;
    quantity: number;
    unitAmount: number;
    accountCode: string;
    taxType: string;
  }[];
}

const HEADERS = [
  "Contact",
  "Contact Email",
  "Contact Address",
  "Contact Postcode",
  "InvoiceNumber",
  "Date",
  "DueDate",
  "Status",
  "Currency",
  "LineAmount",
  "LineDescription",
  "LineQuantity",
  "LineUnitAmount",
  "LineAccountCode",
  "LineTaxType",
  "SubTotal",
  "TotalTax",
  "Total",
];

function iso(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function cell(value: string | number | null): string {
  const raw = value === null || value === undefined ? "" : `${value}`;
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/**
 * Xero only recognises these as bill statuses. Anything still in DRAFT is
 * exported as DRAFT so it stays a draft in Xero too.
 */
export function mapStatus(status: string): "DRAFT" | "SUBMITTED" | "PAID" | "VOID" {
  switch (status) {
    case "ISSUED":
      return "SUBMITTED";
    case "PAID":
      return "PAID";
    case "VOID":
      return "VOID";
    default:
      return "DRAFT";
  }
}

export function buildXeroBillsCsv(
  invoices: XeroBillsInvoice[],
  options: { revenueAccountCode?: string } = {},
): string {
  const accountCode = options.revenueAccountCode?.trim() || "200";
  const rows: string[] = [HEADERS.join(",")];

  for (const invoice of invoices) {
    const status = mapStatus(invoice.status);
    const date = invoice.issueDate ? iso(invoice.issueDate) : "";
    const due = invoice.dueDate ? iso(invoice.dueDate) : "";

    const contact = [
      cell(invoice.contactName),
      cell(invoice.contactEmail),
      cell(invoice.contactAddress),
      cell(invoice.contactPostcode),
    ].join(",");

    const shared = [
      contact,
      cell(invoice.reference),
      date,
      due,
      status,
      invoice.currency || "GBP",
    ];

    if (invoice.lines.length === 0) {
      rows.push(
        [...shared, "0", cell("Invoice total"), "1", cell(invoice.subtotal.toFixed(2)), accountCode, "None",
          cell(invoice.subtotal.toFixed(2)), cell(invoice.vat.toFixed(2)), cell(invoice.total.toFixed(2))].join(","),
      );
      continue;
    }

    for (const line of invoice.lines) {
      rows.push(
        [
          ...shared,
          cell(line.quantity.toFixed(2)),
          cell(line.description),
          cell(line.quantity.toFixed(2)),
          cell(line.unitAmount.toFixed(2)),
          accountCode,
          line.taxType || "None",
          cell(invoice.subtotal.toFixed(2)),
          cell(invoice.vat.toFixed(2)),
          cell(invoice.total.toFixed(2)),
        ].join(","),
      );
    }
  }

  return rows.join("\r\n");
}