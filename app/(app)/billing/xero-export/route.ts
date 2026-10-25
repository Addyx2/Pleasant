import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildXeroSalesInvoicesCsv, type ZeroRateTreatment } from "@/lib/billing/xero";
import { toXeroSalesInvoice, XERO_INVOICE_INCLUDE } from "@/lib/billing/xero-invoice";

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
    include: XERO_INVOICE_INCLUDE,
    orderBy: { issueDate: "asc" },
  });

  const payload = invoices.map((invoice) => toXeroSalesInvoice(invoice, zeroRate));

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
