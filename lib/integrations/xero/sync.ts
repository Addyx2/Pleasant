import type { Integration } from "@prisma/client";

import type { XeroSalesInvoice, ZeroRateTreatment } from "@/lib/billing/xero";
import { toXeroSalesInvoice, XERO_INVOICE_INCLUDE, type InvoiceForXero } from "@/lib/billing/xero-invoice";
import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";

import { getIntegration, logIntegration } from "../store";

import { parseXeroDate, XeroApiError, xeroClient, type XeroClient, type XeroConfig } from "./api";

// Xero's UK tax rate codes for sales, by the names the CSV import uses.
export const XERO_TAX_CODES: Record<string, string> = {
  "20% (VAT on Income)": "OUTPUT2",
  "Exempt Income": "EXEMPTOUTPUT",
  "Zero Rated Income": "ZERORATEDOUTPUT",
  "No VAT": "NONE",
};

const isoDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** The body Xero's Invoices endpoint takes for one Pleasant invoice. */
export function xeroInvoicePayload(
  invoice: XeroSalesInvoice,
  contactId: string,
  options: { status: "AUTHORISED" | "DRAFT"; accountCode: string },
) {
  return {
    Type: "ACCREC",
    Contact: { ContactID: contactId },
    InvoiceNumber: invoice.invoiceNumber,
    Reference: invoice.reference ?? undefined,
    Date: isoDate(invoice.invoiceDate),
    DueDate: isoDate(invoice.dueDate),
    CurrencyCode: invoice.currency || "GBP",
    LineAmountTypes: "Exclusive",
    Status: options.status,
    LineItems: invoice.lines.map((line) => ({
      Description: line.description,
      Quantity: line.quantity,
      UnitAmount: line.unitAmount,
      AccountCode: options.accountCode,
      TaxType: XERO_TAX_CODES[invoice.taxType] ?? "NONE",
    })),
  };
}

interface XeroContact {
  ContactID: string;
  Name: string;
}
interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber?: string;
  Status: string;
  FullyPaidOnDate?: string;
  AmountDue?: number;
}

async function contactFor(xero: XeroClient, client: InvoiceForXero["client"]): Promise<string> {
  if (client.xeroContactId) return client.xeroContactId;
  const name = clientName(client);
  // Xero contact names are unique: reuse one the agency already has.
  const where = encodeURIComponent(`Name=="${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  const found = await xero.request<{ Contacts: XeroContact[] }>("GET", `/Contacts?where=${where}`);
  let contactId = found.Contacts?.[0]?.ContactID;
  if (!contactId) {
    const created = await xero.request<{ Contacts: XeroContact[] }>("POST", "/Contacts", {
      Contacts: [
        {
          Name: name,
          EmailAddress: client.email ?? undefined,
          TaxNumber: client.vatNumber ?? undefined,
          CompanyNumber: client.companyNo ?? undefined,
          Addresses: client.address || client.postcode
            ? [{ AddressType: "POBOX", AddressLine1: client.address ?? undefined, PostalCode: client.postcode ?? undefined, Country: "United Kingdom" }]
            : undefined,
          Phones: client.phone ? [{ PhoneType: "DEFAULT", PhoneNumber: client.phone }] : undefined,
        },
      ],
    });
    contactId = created.Contacts[0].ContactID;
  }
  await prisma.client.update({ where: { id: client.id }, data: { xeroContactId: contactId } });
  return contactId;
}

export interface XeroSyncResult {
  ok: boolean;
  sent: number;
  voided: number;
  paid: number;
  errors: string[];
}

/** How many invoices one sync sends, to stay inside Xero's 60 calls a minute. */
const BATCH = 20;

/**
 * Sends issued invoices Xero doesn't have yet, voids ones voided here, and
 * marks invoices paid when Xero shows them paid. Safe to run repeatedly.
 */
export async function syncXero(integration: Integration, options: { invoiceIds?: string[] } = {}): Promise<XeroSyncResult> {
  const xero = xeroClient(integration);
  const config = xero.config as Partial<XeroConfig>;
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: integration.agencyId }, select: { vatNumber: true } });
  const zeroRate: ZeroRateTreatment = agency.vatNumber ? "exempt" : "noVat";
  const result: XeroSyncResult = { ok: true, sent: 0, voided: 0, paid: 0, errors: [] };
  const scope = options.invoiceIds ? { id: { in: options.invoiceIds } } : {};

  try {
    // 1. New invoices.
    // Older invoices were probably entered in Xero another way (e.g. the CSV
    // import), so only those issued since the chosen date are sent.
    const since = config.syncFrom ? new Date(`${config.syncFrom}T00:00:00Z`) : integration.createdAt;
    const toSend = await prisma.invoice.findMany({
      where: {
        agencyId: integration.agencyId,
        status: { in: ["ISSUED", "PAID"] },
        xeroInvoiceId: null,
        issueDate: { gte: since },
        lines: { some: {} },
        ...scope,
      },
      include: XERO_INVOICE_INCLUDE,
      orderBy: { issueDate: "asc" },
      take: BATCH,
    });
    for (const invoice of toSend) {
      try {
        const contactId = await contactFor(xero, invoice.client);
        const payload = xeroInvoicePayload(toXeroSalesInvoice(invoice, zeroRate), contactId, {
          status: config.invoiceStatus ?? "AUTHORISED",
          accountCode: config.accountCode || "200",
        });
        let created: XeroInvoice | undefined;
        try {
          created = (await xero.request<{ Invoices: XeroInvoice[] }>("POST", "/Invoices", { Invoices: [payload] })).Invoices[0];
        } catch (error) {
          // Already in Xero with this number (e.g. imported from CSV): link to it.
          if (!(error instanceof XeroApiError) || error.status !== 400 || !/unique|already/i.test(error.message)) throw error;
          const existing = await xero.request<{ Invoices: XeroInvoice[] }>(
            "GET",
            `/Invoices?InvoiceNumbers=${encodeURIComponent(invoice.reference)}`,
          );
          created = existing.Invoices?.find((i) => i.Status !== "DELETED" && i.Status !== "VOIDED");
          if (!created) throw error;
        }
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { xeroInvoiceId: created.InvoiceID, xeroStatus: created.Status, xeroSyncedAt: new Date() },
        });
        result.sent++;
      } catch (error) {
        if (error instanceof XeroApiError && (error.status === 401 || error.status === 429)) throw error;
        result.errors.push(`${invoice.reference}: ${error instanceof Error ? error.message : "not sent"}`);
      }
    }

    // 2. Invoices voided in Pleasant after they reached Xero.
    const toVoid = await prisma.invoice.findMany({
      where: { agencyId: integration.agencyId, status: "VOID", xeroInvoiceId: { not: null }, xeroStatus: { notIn: ["VOIDED", "DELETED"] }, ...scope },
      take: BATCH,
    });
    for (const invoice of toVoid) {
      // Xero deletes drafts and voids approved invoices.
      const status = invoice.xeroStatus === "DRAFT" ? "DELETED" : "VOIDED";
      try {
        await xero.request("POST", `/Invoices/${invoice.xeroInvoiceId}`, { Invoices: [{ InvoiceID: invoice.xeroInvoiceId, Status: status }] });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { xeroStatus: status, xeroSyncedAt: new Date() } });
        result.voided++;
      } catch (error) {
        if (error instanceof XeroApiError && (error.status === 401 || error.status === 429)) throw error;
        result.errors.push(`${invoice.reference}: couldn't void in Xero (${error instanceof Error ? error.message : "error"})`);
      }
    }

    // 3. Payments recorded in Xero.
    const awaiting = await prisma.invoice.findMany({
      where: { agencyId: integration.agencyId, status: "ISSUED", xeroInvoiceId: { not: null }, ...scope },
      select: { id: true, xeroInvoiceId: true },
      take: 100,
    });
    for (let i = 0; i < awaiting.length; i += 50) {
      const chunk = awaiting.slice(i, i + 50);
      const res = await xero.request<{ Invoices: XeroInvoice[] }>("GET", `/Invoices?IDs=${chunk.map((c) => c.xeroInvoiceId).join(",")}`);
      for (const remote of res.Invoices ?? []) {
        const local = chunk.find((c) => c.xeroInvoiceId === remote.InvoiceID);
        if (!local) continue;
        if (remote.Status === "PAID") {
          await prisma.invoice.update({
            where: { id: local.id },
            data: { status: "PAID", paidAt: parseXeroDate(remote.FullyPaidOnDate) ?? new Date(), xeroStatus: "PAID", xeroSyncedAt: new Date() },
          });
          result.paid++;
        } else {
          await prisma.invoice.update({ where: { id: local.id }, data: { xeroStatus: remote.Status, xeroSyncedAt: new Date() } });
        }
      }
    }
  } catch (error) {
    result.ok = false;
    result.errors.unshift(error instanceof Error ? error.message : "Xero sync failed");
  }

  const summary = [
    `${result.sent} sent`,
    result.voided ? `${result.voided} voided` : null,
    `${result.paid} marked paid`,
    result.errors.length ? `${result.errors.length} problem(s): ${result.errors.slice(0, 3).join("; ")}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  // Per-invoice problems are logged but leave the connection healthy.
  await logIntegration(integration, "sync", result.ok, summary, { sync: result.ok });
  return result;
}

/** Sends one invoice right after it's issued or voided, if Xero is connected. Never throws. */
export async function syncInvoiceToXero(agencyId: string, invoiceId: string): Promise<void> {
  try {
    const integration = await getIntegration(agencyId, "xero");
    if (integration) await syncXero(integration, { invoiceIds: [invoiceId] });
  } catch (error) {
    console.error("xero invoice sync failed", error);
  }
}
