import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildXeroBillsCsv, type XeroBillsInvoice } from "@/lib/billing/xero";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireAdmin();

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");

  const invoices = await prisma.invoice.findMany({
    where: {
      agencyId: user.agencyId,
      status: statusParam && statusParam !== "ALL" ? (statusParam as never) : { in: ["ISSUED", "PAID"] },
    },
    include: { client: true, lines: { include: { staff: true }, orderBy: { date: "asc" } } },
    orderBy: { issueDate: "desc" },
  });

  const payload: XeroBillsInvoice[] = invoices.map((invoice) => ({
    reference: invoice.reference,
    status: invoice.status,
    contactName: invoice.client.companyName || `${invoice.client.firstName} ${invoice.client.lastName}`,
    contactEmail: invoice.client.email,
    contactAddress: invoice.client.address,
    contactPostcode: invoice.client.postcode,
    contactVatNumber: invoice.client.vatNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: "GBP",
    subtotal: Number(invoice.chargeTotal),
    vat: Number(invoice.vatTotal),
    total: Number(invoice.grandTotal),
    lines: invoice.lines.map((line) => ({
      description: `${line.title} — ${line.staff.firstName} ${line.staff.lastName}`,
      quantity: Number(line.hours),
      unitAmount: Number(line.chargeRate),
      accountCode: "200",
      taxType: Number(invoice.vatRatePct) > 0 ? "TAX" : "None",
    })),
  }));

  const csv = buildXeroBillsCsv(payload);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pleasant-xero-bills-${stamp}.csv"`,
    },
  });
}