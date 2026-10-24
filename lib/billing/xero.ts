/**
 * Xero sales invoices CSV export.
 *
 * Pleasant invoices are what the agency bills its clients, so they go into
 * Xero as *sales* invoices (accounts receivable) via Business → Invoices →
 * Import, using Xero's sales invoice template columns. One row per invoice
 * line; Xero groups rows sharing an InvoiceNumber into one invoice and imports
 * them as drafts for review.
 */

export interface XeroSalesInvoice {
  invoiceNumber: string;
  /** Shown on the Xero invoice, e.g. the client's framework / PO reference. */
  reference: string | null;
  contactName: string;
  contactEmail: string | null;
  contactAddress: string | null;
  contactPostcode: string | null;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  /** Xero tax rate name applied to every line, e.g. "20% (VAT on Income)". */
  taxType: string;
  lines: {
    description: string;
    quantity: number;
    unitAmount: number;
  }[];
}

export const XERO_SALES_HEADERS = [
  "*ContactName",
  "EmailAddress",
  "POAddressLine1",
  "POAddressLine2",
  "POAddressLine3",
  "POAddressLine4",
  "POCity",
  "PORegion",
  "POPostalCode",
  "POCountry",
  "*InvoiceNumber",
  "Reference",
  "*InvoiceDate",
  "*DueDate",
  "Total",
  "InventoryItemCode",
  "*Description",
  "*Quantity",
  "*UnitAmount",
  "Discount",
  "*AccountCode",
  "*TaxType",
  "TaxAmount",
  "TrackingName1",
  "TrackingOption1",
  "TrackingName2",
  "TrackingOption2",
  "Currency",
  "BrandingTheme",
] as const;

// Xero's standard UK tax rate names for sales.
export const XERO_TAX_TYPES = {
  standard: "20% (VAT on Income)",
  exempt: "Exempt Income",
  zeroRated: "Zero Rated Income",
  noVat: "No VAT",
} as const;

export type ZeroRateTreatment = "exempt" | "zeroRated" | "noVat";

/** Xero tax rate name for an invoice at the given VAT percentage. */
export function xeroTaxType(vatRatePct: number, zeroRate: ZeroRateTreatment): string {
  return vatRatePct > 0 ? XERO_TAX_TYPES.standard : XERO_TAX_TYPES[zeroRate];
}

/** Xero reads import dates in the organisation's regional format: DD/MM/YYYY for UK. */
export function ukDate(date: Date): string {
  const d = `${date.getDate()}`.padStart(2, "0");
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let raw = `${value}`;
  // Free text (names, descriptions) must not be read as a spreadsheet formula.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(raw)) raw = `'${raw}`;
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

// Unit amounts keep up to 4 decimal places (Xero's limit) so quantity x unit
// amount reproduces the line charge to the penny.
function amount(value: number, places = 2): string {
  return value.toFixed(places);
}

export function buildXeroSalesInvoicesCsv(
  invoices: XeroSalesInvoice[],
  options: { accountCode?: string } = {},
): string {
  const accountCode = options.accountCode?.trim() || "200";
  const rows: string[] = [XERO_SALES_HEADERS.join(",")];

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const values: Record<(typeof XERO_SALES_HEADERS)[number], string> = {
        "*ContactName": cell(invoice.contactName),
        EmailAddress: cell(invoice.contactEmail),
        POAddressLine1: cell(invoice.contactAddress),
        POAddressLine2: "",
        POAddressLine3: "",
        POAddressLine4: "",
        POCity: "",
        PORegion: "",
        POPostalCode: cell(invoice.contactPostcode),
        POCountry: "",
        "*InvoiceNumber": cell(invoice.invoiceNumber),
        Reference: cell(invoice.reference),
        "*InvoiceDate": ukDate(invoice.invoiceDate),
        "*DueDate": ukDate(invoice.dueDate),
        Total: "",
        InventoryItemCode: "",
        "*Description": cell(line.description),
        "*Quantity": amount(line.quantity),
        "*UnitAmount": amount(line.unitAmount, Number.isInteger(line.unitAmount * 100) ? 2 : 4),
        Discount: "",
        "*AccountCode": cell(accountCode),
        "*TaxType": cell(invoice.taxType),
        TaxAmount: "",
        TrackingName1: "",
        TrackingOption1: "",
        TrackingName2: "",
        TrackingOption2: "",
        Currency: cell(invoice.currency || "GBP"),
        BrandingTheme: "",
      };
      rows.push(XERO_SALES_HEADERS.map((h) => values[h]).join(","));
    }
  }

  return rows.join("\r\n") + "\r\n";
}
