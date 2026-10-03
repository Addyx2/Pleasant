import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PrintButton } from "@/app/billing-pack/PrintButton";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

export default async function PrintableInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAdmin();

  const invoice = await prisma.invoice.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      client: true,
      agency: true,
      lines: { include: { staff: true }, orderBy: { date: "asc" } },
    },
  });

  if (!invoice) notFound();
  if (invoice.status === "DRAFT") notFound();

  const { client, agency } = invoice;
  const vatRate = Number(invoice.vatRatePct);
  const showVat = vatRate > 0;

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-slate-900 print:px-0 print:py-0">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/billing/${invoice.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Back to invoice
          </Link>
          <PrintButton />
        </div>

        <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                P
              </div>
              <p className="font-display text-lg font-bold tracking-tight">Pleasant</p>
            </div>
            <div className="mt-3 space-y-0.5 text-xs leading-5 text-slate-600">
              <p className="font-semibold text-slate-900">{agency.name}</p>
              {agency.address ? <p>{agency.address}</p> : null}
              {agency.postcode ? <p>{agency.postcode}</p> : null}
              {agency.email ? <p>{agency.email}</p> : null}
              {agency.phone ? <p>{agency.phone}</p> : null}
              {agency.companyNo ? <p>Company no. {agency.companyNo}</p> : null}
              {agency.vatNumber ? <p>VAT no. {agency.vatNumber}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold tracking-tight">INVOICE</p>
            <p className="mt-1 text-sm font-semibold">{invoice.reference}</p>
            <p className="mt-2 text-xs text-slate-600">
              Issued {invoice.issueDate ? formatDate(invoice.issueDate) : "—"}
            </p>
            {invoice.dueDate ? (
              <p className="text-xs text-slate-600">Payment due {formatDate(invoice.dueDate)}</p>
            ) : null}
            {invoice.status === "PAID" && invoice.paidAt ? (
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                Paid {formatDate(invoice.paidAt)}
              </p>
            ) : null}
          </div>
        </header>

        <section className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Billed to</p>
            <p className="mt-1.5 text-sm font-semibold">
              {client.companyName || `${client.firstName} ${client.lastName}`}
            </p>
            <div className="mt-1 space-y-0.5 text-xs leading-5 text-slate-600">
              {client.companyName ? (
                <p>
                  {client.firstName} {client.lastName}
                </p>
              ) : null}
              {client.address ? <p>{client.address}</p> : null}
              {client.postcode ? <p>{client.postcode}</p> : null}
              {client.vatNumber ? <p>VAT no. {client.vatNumber}</p> : null}
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Period</span> {formatDate(invoice.periodStart)} –{" "}
              {formatDate(invoice.periodEnd)}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-900">Payment terms</span>{" "}
              {invoice.dueDate ? `${formatDate(invoice.dueDate)}` : "On receipt"}
            </p>
          </div>
        </section>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-300 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-2 font-semibold">Date</th>
              <th className="py-2 pr-2 font-semibold">Description</th>
              <th className="py-2 pr-2 text-right font-semibold">Hours</th>
              <th className="py-2 pr-2 text-right font-semibold">Rate</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-100">
                <td className="py-2.5 pr-2 tabular whitespace-nowrap text-slate-600">{formatDate(line.date)}</td>
                <td className="py-2.5 pr-2 text-slate-900">
                  {line.title}
                  <span className="text-slate-500"> — {line.staff.firstName} {line.staff.lastName}</span>
                </td>
                <td className="tabular py-2.5 pr-2 text-right text-slate-600">{Number(line.hours).toFixed(2)}</td>
                <td className="tabular py-2.5 pr-2 text-right text-slate-600">
                  {formatCurrency(Number(line.chargeRate))}
                </td>
                <td className="tabular py-2.5 text-right font-medium text-slate-900">
                  {formatCurrency(Number(line.chargeAmount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="ml-auto max-w-xs space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular">{formatCurrency(Number(invoice.chargeTotal))}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>{showVat ? `VAT at ${invoice.vatRatePct}%` : "VAT"}</span>
            <span className="tabular">{showVat ? formatCurrency(Number(invoice.vatTotal)) : "£0.00"}</span>
          </div>
          <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-slate-900">
            <span>Total due</span>
            <span className="tabular">{formatCurrency(Number(invoice.grandTotal))}</span>
          </div>
          {invoice.paidAt ? (
            <div className="flex justify-between text-xs font-semibold text-emerald-700">
              <span>Paid</span>
              <span className="tabular">{formatCurrency(Number(invoice.grandTotal))}</span>
            </div>
          ) : null}
        </section>

        <footer className="space-y-2 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-400">
          {invoice.notes ? <p>{invoice.notes}</p> : null}
          <p>
            Hours are taken from approved timesheets. Care services provided to care homes are VAT
            exempt unless stated otherwise above.
          </p>
          <p>
            Please quote {invoice.reference} with your remittance. Queries to {agency.invoiceEmail ?? agency.email ?? "your account manager"}.
          </p>
        </footer>
      </div>
    </main>
  );
}