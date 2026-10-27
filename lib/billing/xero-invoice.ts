import { addDays } from "date-fns";
import type { Prisma } from "@prisma/client";

import { lineBasis } from "@/lib/billing";
import { clientName } from "@/lib/clients";
import { formatDate } from "@/lib/utils";

import { xeroTaxType, type XeroSalesInvoice, type ZeroRateTreatment } from "./xero";

/** What an invoice needs loaded to be sent to Xero (CSV export or live sync). */
export const XERO_INVOICE_INCLUDE = {
  client: true,
  lines: { include: { staff: true, shift: { select: { isSleepIn: true } } }, orderBy: { date: "asc" } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceForXero = Prisma.InvoiceGetPayload<{ include: typeof XERO_INVOICE_INCLUDE }>;

export function toXeroSalesInvoice(invoice: InvoiceForXero, zeroRate: ZeroRateTreatment): XeroSalesInvoice {
  const invoiceDate = invoice.issueDate ?? invoice.createdAt;
  return {
    invoiceNumber: invoice.reference,
    reference: invoice.client.frameworkRef,
    contactName: clientName(invoice.client),
    contactEmail: invoice.client.email,
    contactAddress: invoice.client.address,
    contactPostcode: invoice.client.postcode,
    invoiceDate,
    dueDate: invoice.dueDate ?? addDays(invoiceDate, invoice.client.paymentTermsDays),
    currency: "GBP",
    taxType: xeroTaxType(Number(invoice.vatRatePct), zeroRate),
    lines: invoice.lines.map((line) => {
      const basis = lineBasis({
        hours: Number(line.hours),
        chargeRate: Number(line.chargeRate),
        chargeAmount: Number(line.chargeAmount),
        isSleepIn: line.shift?.isSleepIn ?? false,
      });
      const sleepInNote = basis.flat && !/sleep-in/i.test(line.title) ? " (sleep-in)" : "";
      return {
        description: `${formatDate(line.date)} · ${line.title}${sleepInNote} — ${line.staff.firstName} ${line.staff.lastName}`,
        quantity: basis.quantity,
        unitAmount: basis.unitAmount,
      };
    }),
  };
}
