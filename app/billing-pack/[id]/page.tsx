import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PrintButton } from "../PrintButton";

export const metadata = { title: "Funding evidence pack" };
export const dynamic = "force-dynamic";

export default async function FundingPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();

  const invoice = await prisma.invoice.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      client: true,
      agency: true,
      lines: {
        include: { staff: true, timesheet: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!invoice) notFound();

  const signedLines = invoice.lines.filter((l) => l.timesheet?.clientAuthAt).length;
  const signedPct =
    invoice.lines.length > 0 ? Math.round((signedLines / invoice.lines.length) * 100) : 0;
  const generatedAt = new Date();
  const { client, agency } = invoice;

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-slate-900 print:px-0 print:py-0">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 print:hidden">
          <Link href={`/billing/${invoice.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">
            ← Back to invoice
          </Link>
          <PrintButton />
        </div>

        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
              P
            </div>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">Pleasant</p>
              <p className="text-xs text-slate-500">Funding evidence pack</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">{invoice.reference}</p>
            <p className="text-xs text-slate-500">Generated {formatDateTime(generatedAt)}</p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Billed to — care home
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {client.firstName} {client.lastName}
            </p>
            {client.address ? <p className="mt-1 text-xs leading-5 text-slate-600">{client.address}</p> : null}
            {client.postcode ? <p className="text-xs text-slate-600">{client.postcode}</p> : null}
            {client.phone ? <p className="text-xs text-slate-600">{client.phone}</p> : null}
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Supplied by — agency
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{agency.name}</p>
            {agency.address ? <p className="mt-1 text-xs leading-5 text-slate-600">{agency.address}</p> : null}
            {agency.postcode ? <p className="text-xs text-slate-600">{agency.postcode}</p> : null}
            {agency.phone ? <p className="text-xs text-slate-600">{agency.phone}</p> : null}
            {agency.payrollRef ? (
              <p className="mt-1 text-xs text-slate-500">PAYE ref {agency.payrollRef}</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Period", `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`],
              ["Issued", invoice.issueDate ? formatDate(invoice.issueDate) : "—"],
              ["Due", invoice.dueDate ? formatDate(invoice.dueDate) : "—"],
              ["Paid", invoice.paidAt ? formatDate(invoice.paidAt) : "—"],
              ["VAT", Number(invoice.vatRatePct) > 0 ? `${invoice.vatRatePct}%` : "Exempt"],
              ["Status", invoice.status],
            ].map(([label, value]) => (
              <div key={label} className="bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4">
            <p className="text-xs text-slate-500">
              Overall margin on this invoice is{" "}
              <span className="font-semibold text-slate-700">{formatCurrency(Number(invoice.marginTotal))}</span>
            </p>
            <p className="text-lg font-bold text-slate-900">
              Invoice total: {formatCurrency(Number(invoice.grandTotal))}
            </p>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-700">
              Lines &amp; client authorisation
            </h1>
            <p className="text-xs text-slate-500">
              {signedLines} of {invoice.lines.length} lines client-signed ({signedPct}%)
            </p>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-2 font-semibold">Date</th>
                <th className="py-2 pr-2 font-semibold">Shift</th>
                <th className="py-2 pr-2 font-semibold">Carer</th>
                <th className="py-2 pr-2 text-right font-semibold">Hours</th>
                <th className="py-2 pr-2 text-right font-semibold">Charge</th>
                <th className="py-2 font-semibold">Home sign-off</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => {
                const ts = line.timesheet;
                const signed = Boolean(ts?.clientAuthAt);
                return (
                  <tr key={line.id} className="break-inside-avoid border-b border-slate-100 align-top">
                    <td className="py-3 pr-2 tabular whitespace-nowrap text-slate-600">
                      {formatDate(line.date)}
                    </td>
                    <td className="py-3 pr-2 text-slate-900">{line.title}</td>
                    <td className="py-3 pr-2 text-slate-900">
                      {line.staff.firstName} {line.staff.lastName}
                    </td>
                    <td className="py-3 pr-2 tabular text-right text-slate-600">
                      {Number(line.hours).toFixed(2)}
                    </td>
                    <td className="py-3 pr-2 tabular text-right font-semibold text-slate-900">
                      {formatCurrency(Number(line.chargeAmount))}
                    </td>
                    <td className="py-3">
                      {signed ? (
                        <div className="text-xs">
                          <p className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <BadgeCheck className="h-3.5 w-3.5" /> Signed by {ts?.clientAuthName ?? "the home"}
                          </p>
                          {ts?.clientAuthPosition ? (
                            <p className="mt-0.5 text-slate-500">{ts?.clientAuthPosition}</p>
                          ) : null}
                          {ts?.clientAuthAt ? (
                            <p className="mt-0.5 text-slate-500">{formatDateTime(ts.clientAuthAt)}</p>
                          ) : null}
                          <p className="mt-0.5 text-slate-400">Digital sign-off via Pleasant Link</p>
                        </div>
                      ) : (
                        <p className="inline-flex items-center gap-1 font-medium text-amber-700">
                          <ShieldAlert className="h-3.5 w-3.5" /> No client sign-off recorded
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <footer className="space-y-1 text-[11px] leading-5 text-slate-400">
          <p>
            Prepared by {agency.name} on {formatDate(generatedAt)}. Carer hours and charges derive
            from approved timesheets; client authorisation is recorded digitally when the home
            confirms role and hours via Pleasant Link.
          </p>
          <p>
            This pack summarises one invoice ({invoice.reference}) for the period{" "}
            {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}. Overdue or unpaid
            amounts are highlighted by the agency&#39;s live receivables ledger before submission.
          </p>
        </footer>
      </div>
    </main>
  );
}