import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, IconTile, PageHeader, StatCard, Td, Th, buttonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { deleteInvoiceAction, setInvoiceStatusAction } from "../actions";
import { Landmark, PackageCheck, Receipt, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();

  const invoice = await prisma.invoice.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      client: true,
      lines: {
        include: { staff: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!invoice) notFound();

  const charge = Number(invoice.chargeTotal);
  const margin = Number(invoice.marginTotal);
  const marginPct = charge > 0 ? (margin / charge) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.reference}`}
        description={`${invoice.client.firstName} ${invoice.client.lastName} · ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}${invoice.dueDate ? ` · due ${formatDate(invoice.dueDate)}` : ""}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={invoice.status} />
            <Link href="/billing" className="text-sm font-medium text-brand-700 hover:underline">
              Back to billing
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Billable hours" value={`${Number(invoice.hoursTotal).toFixed(2)}h`} icon={PackageCheck} tone="blue" />
        <StatCard label="Bill to client" value={formatCurrency(charge)} icon={Receipt} tone="brand" />
        <StatCard
          label="Gross margin"
          value={formatCurrency(margin)}
          hint={`${marginPct.toFixed(1)}% of bill`}
          icon={TrendingUp}
          tone={margin < 0 ? "red" : "green"}
        />
        <StatCard
          label="Grand total"
          value={formatCurrency(Number(invoice.grandTotal))}
          hint={
            Number(invoice.vatRatePct) > 0
              ? `incl. VAT ${formatCurrency(Number(invoice.vatTotal))}`
              : "VAT exempt / zero-rated"
          }
          icon={Landmark}
          tone="slate"
        />
      </div>

      <Card className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Lines ({invoice.lines.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "DRAFT" ? (
              <form action={setInvoiceStatusAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="status" value="ISSUED" />
                <button type="submit" className={buttonClass}>Issue invoice</button>
              </form>
            ) : null}
            {invoice.status === "ISSUED" ? (
              <form action={setInvoiceStatusAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="status" value="PAID" />
                <button type="submit" className={buttonClass}>Mark as paid</button>
              </form>
            ) : null}
            {invoice.status !== "VOID" ? (
              <form action={setInvoiceStatusAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="status" value="VOID" />
                <button
                  type="submit"
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Void
                </button>
              </form>
            ) : null}
            {invoice.status === "DRAFT" ? (
              <form action={deleteInvoiceAction}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
                  Delete draft
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <table className="w-full min-w-[1000px]">
          <thead className="bg-slate-50">
            <tr>
              <Th>Date</Th>
              <Th>Shift</Th>
              <Th>Carer</Th>
              <Th>Hours</Th>
              <Th>Rate</Th>
              <Th>Charge</Th>
              <Th>Worker cost</Th>
              <Th>Margin</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lines.map((line) => (
              <tr key={line.id} className="hover:bg-slate-50">
                <Td className="tabular">{formatDate(line.date)}</Td>
                <Td className="text-slate-900">{line.title}</Td>
                <Td className="text-slate-900">
                  {line.staff.firstName} {line.staff.lastName}
                </Td>
                <Td className="tabular">{Number(line.hours).toFixed(2)}</Td>
                <Td className="tabular">{formatCurrency(Number(line.chargeRate))}/h</Td>
                <Td className="tabular font-semibold text-slate-900">
                  {formatCurrency(Number(line.chargeAmount))}
                </Td>
                <Td className="tabular">{formatCurrency(Number(line.payAmount))}</Td>
                <Td
                  className={
                    Number(line.marginAmount) < 0
                      ? "tabular font-semibold text-red-600"
                      : "tabular font-semibold text-emerald-600"
                  }
                >
                  {formatCurrency(Number(line.marginAmount))}
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/70">
              <Td colSpan={3} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Totals
              </Td>
              <Td className="tabular font-semibold text-slate-900">
                {Number(invoice.hoursTotal).toFixed(2)}
              </Td>
              <Td />
              <Td className="tabular font-semibold text-slate-900">
                {formatCurrency(Number(invoice.chargeTotal))}
              </Td>
              <Td className="tabular font-semibold text-slate-900">
                {formatCurrency(Number(invoice.payTotal))}
              </Td>
              <Td
                className={
                  margin < 0
                    ? "tabular font-semibold text-red-600"
                    : "tabular font-semibold text-emerald-600"
                }
              >
                {formatCurrency(margin)}
              </Td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <IconTile icon={Receipt} tone="brand" className="h-8 w-8" />
        <p className="max-w-2xl text-xs text-slate-500">
          Margin is the difference between the bill to the client and direct worker pay
          (gross shift earnings, statutory holiday accrual and non-taxable expenses). It is
          shown before employer on-costs (NI &amp; pension) and agency overheads. Sleep-in
          shifts are billed as a flat allowance exactly as they are paid.
        </p>
      </div>
    </div>
  );
}