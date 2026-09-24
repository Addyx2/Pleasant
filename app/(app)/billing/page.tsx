import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, mondayOf, toISODate } from "@/lib/week";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, EmptyState, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { NewInvoiceForm } from "./NewInvoiceForm";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await requireAdmin();
  const agencyId = user.agencyId;

  const [invoices, clients, openAgg, outstandingAgg] = await Promise.all([
    prisma.invoice.findMany({
      where: { agencyId },
      orderBy: { periodEnd: "desc" },
      include: {
        client: true,
        _count: { select: { lines: true } },
      },
      take: 100,
    }),
    prisma.client.findMany({
      where: { agencyId, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
    }),
    prisma.invoice.aggregate({
      where: { agencyId, status: { in: ["DRAFT", "ISSUED"] } },
      _sum: { chargeTotal: true, marginTotal: true, grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { agencyId, status: { in: ["ISSUED", "PAID"] } },
      _sum: { chargeTotal: true, marginTotal: true, grandTotal: true },
    }),
  ]);

  const monday = mondayOf(new Date());
  const sunday = addDays(monday, 6);
  const defaultStart = toISODate(monday);
  const defaultEnd = toISODate(sunday);
  const defaultDueDate = toISODate(addDays(sunday, 14));

  const billed = Number(outstandingAgg._sum.chargeTotal ?? 0);
  const margin = Number(outstandingAgg._sum.marginTotal ?? 0);
  const collectable = Number(openAgg._sum.grandTotal ?? 0);

  const clientOptions = clients.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & margins"
        description="Invoices are built from approved, client-authorised timesheets at each shift's charge-out rate."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Billed (issued + paid)" value={formatCurrency(billed)} hint="Gross bill to clients" />
        <StatCard label="Gross margin" value={formatCurrency(margin)} hint="Before employer on-costs" />
        <StatCard label="Outstanding" value={formatCurrency(collectable)} hint="Draft + issued, not yet paid" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-x-auto p-0 lg:col-span-2">
          {invoices.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No invoices yet"
                description="Approve some timesheets, then generate your first client invoice."
              />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Reference</Th>
                  <Th>Client</Th>
                  <Th>Period</Th>
                  <Th>Hours</Th>
                  <Th>Bill</Th>
                  <Th>Margin</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/billing/${invoice.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {invoice.reference}
                      </Link>
                      <p className="text-xs text-slate-500">{invoice._count.lines} lines</p>
                    </Td>
                    <Td className="text-slate-900">
                      {invoice.client.firstName} {invoice.client.lastName}
                    </Td>
                    <Td>
                      {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                    </Td>
                    <Td className="tabular">{Number(invoice.hoursTotal).toFixed(2)}</Td>
                    <Td className="tabular font-semibold text-slate-900">
                      {formatCurrency(Number(invoice.chargeTotal))}
                    </Td>
                    <Td
                      className={
                        Number(invoice.marginTotal) < 0
                          ? "tabular font-semibold text-red-600"
                          : "tabular font-semibold text-emerald-600"
                      }
                    >
                      {formatCurrency(Number(invoice.marginTotal))}
                    </Td>
                    <Td>
                      <StatusBadge status={invoice.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="h-fit p-6">
          <h2 className="text-sm font-semibold text-slate-900">New invoice</h2>
          <div className="mt-4">
            <NewInvoiceForm
              clients={clientOptions}
              defaultStart={defaultStart}
              defaultEnd={defaultEnd}
              defaultDueDate={defaultDueDate}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}