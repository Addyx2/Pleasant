import { NextResponse } from "next/server";
import { addDays } from "date-fns";

import { requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { lineBasis } from "@/lib/billing";
import {
  buildXeroSalesInvoicesCsv,
  xeroTaxType,
  type XeroSalesInvoice,
  type ZeroRateTreatment,
} from "@/lib/billing/xero";
import { clientName } from "@/lib/clients";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ZERO_RATE: ZeroRateTreatment[] = ["exempt", "zeroRated", "noVat"];

export async function GET(request: Request) {
  const user = await requireAdmin();
  const params = new URL(request.url).searchParams;

  const includePaid = params.get("paid") === "1";
  const sinceRaw = params.get("since");
  const since = sinceRaw && /^\d{4}-\d{2}-\d{2}$/.test(sinceRaw) ? new Date(`${sinceRaw}T00:00:00`) : null;
  const accountCode = /^[A-Za-z0-9.-]{1,10}$/.test(params.get("account") ?? "") ? params.get("account")! : "200";
  const zeroParam = params.get("zero") as ZeroRateTreatment | null;
  // Default: VAT-registered agencies' 0% supplies are exempt; unregistered agencies charge no VAT.
  const zeroRate: ZeroRateTreatment =
    zeroParam && ZERO_RATE.includes(zeroParam) ? zeroParam : user.agency.vatNumber ? "exempt" : "noVat";

  const invoices = await prisma.invoice.findMany({
    where: {
      agencyId: user.agencyId,
      status: { in: includePaid ? ["ISSUED", "PAID"] : ["ISSUED"] },
      ...(since ? { issueDate: { gte: since } } : {}),
      lines: { some: {} },
    },
    include: {
      client: true,
      lines: { include: { staff: true, shift: { select: { isSleepIn: true } } }, orderBy: { date: "asc" } },
    },
    orderBy: { issueDate: "asc" },
  });

  const payload: XeroSalesInvoice[] = invoices.map((invoice) => {
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
  });

  await recordAudit(user, {
    action: "invoice.export",
    summary: `Exported ${payload.length} invoice${payload.length === 1 ? "" : "s"} to Xero CSV`,
    metadata: { includePaid, since: sinceRaw, accountCode, zeroRate },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(buildXeroSalesInvoicesCsv(payload, { accountCode }), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pleasant-xero-sales-invoices-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
