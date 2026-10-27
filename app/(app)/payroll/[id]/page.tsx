import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, Download, FileText } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, IconTile, PageHeader, StatCard, Td, Th, buttonClass, subtleButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { deletePayrollRunAction, setPayrollStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();

  const run = await prisma.payrollRun.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      payslips: {
        include: { staff: true },
        orderBy: { staff: { lastName: "asc" } },
      },
    },
  });

  if (!run) notFound();

  const employerPension = run.payslips.reduce((sum, p) => sum + Number(p.pensionEmployer), 0);
  const employerNi = Number(run.employerNiTotal);
  const employerCost = Number(run.grossTotal) + employerPension + employerNi;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payroll run ${run.reference}`}
        description={`${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)} · tax year ${run.taxYear} · pay date ${formatDate(run.payDate)}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={run.status} />
            <Link href="/payroll" className="text-sm font-medium text-brand-700 hover:underline">
              Back to payroll
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross pay" value={formatCurrency(Number(run.grossTotal))} />
        <StatCard label="PAYE" value={formatCurrency(Number(run.payeTotal))} />
        <StatCard label="Employee NI" value={formatCurrency(Number(run.niTotal))} />
        <StatCard label="Employee pension" value={formatCurrency(Number(run.pensionTotal))} />
        <StatCard label="Net pay" value={formatCurrency(Number(run.netTotal))} />
        <StatCard label="Employer NI" value={formatCurrency(employerNi)} hint="Incl. employment allowance not applied" />
        <StatCard label="Employer pension" value={formatCurrency(employerPension)} />
        <StatCard label="Total employer cost" value={formatCurrency(employerCost)} />
      </div>

      {run.status !== "DRAFT" ? (
        <Card className="p-5">
          <div className="flex items-center gap-2.5">
            <IconTile icon={FileText} tone="brand" className="h-8 w-8" />
            <h2 className="text-sm font-semibold text-slate-900">Payday checklist · {run.reference}</h2>
          </div>
          <ol className="mt-4 space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                ✓
              </span>
              <span>
                Run closed — {run.payslips.length} payslip{run.payslips.length === 1 ? "" : "s"} frozen at final amounts.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400">2</span>
              <span>
                Download the RTI file (above) and file it — or send it to your accountant —
                before paying. Continued on the HMRC gateway by you or your accountant.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${run.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                {run.status === "PAID" ? "✓" : "3"}
              </span>
              <span>
                Pay carers by {formatDate(run.payDate)} and mark the run as paid.
              </span>
            </li>
          </ol>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Payslips ({run.payslips.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {run.status === "DRAFT" ? (
              <form action={setPayrollStatusAction}>
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="status" value="FINALISED" />
                <button type="submit" className={buttonClass}>Finalise run</button>
              </form>
            ) : null}
            {run.status === "FINALISED" ? (
              <form action={setPayrollStatusAction}>
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="status" value="PAID" />
                <button type="submit" className={buttonClass}>Mark as paid</button>
              </form>
            ) : null}
            {run.status === "DRAFT" ? (
              <form action={deletePayrollRunAction}>
                <input type="hidden" name="runId" value={run.id} />
                <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
                  Delete run
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {run.status !== "DRAFT" ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">
            <Link href={`/payroll/${run.id}/export`} className={subtleButtonClass}>
              <Download className="h-4 w-4" /> Download RTI file (FPS-ready CSV)
            </Link>
            <Link href={`/payroll/${run.id}/payments`} className={subtleButtonClass}>
              <Banknote className="h-4 w-4" /> Download bank payments CSV
            </Link>
            <Link href={`/payroll/${run.id}/std18`} className={subtleButtonClass}>
              <FileText className="h-4 w-4" /> Download BACS STD18
            </Link>
            <p className="max-w-md text-xs text-slate-500">
              Accountant-friendly Full Payment Submission file covering every PAYE carer on
              this run. Ltd-company engagements are paid gross and excluded. File it — or hand
              it to your accountant — before you pay.
            </p>
          </div>
        ) : null}

        <table className="w-full min-w-[1000px]">
          <thead className="bg-slate-50">
            <tr>
              <Th>Carer</Th>
              <Th>Hours</Th>
              <Th>Gross</Th>
              <Th>Holiday</Th>
              <Th>Expenses</Th>
              <Th>PAYE</Th>
              <Th>NI</Th>
              <Th>Pension</Th>
              <Th>Net</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {run.payslips.map((payslip) => (
              <tr key={payslip.id} className="hover:bg-slate-50">
                <Td>
                  <p className="font-medium text-slate-900">
                    {payslip.staff.firstName} {payslip.staff.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{payslip.taxCode}</p>
                </Td>
                <Td>{Number(payslip.timesheetHours).toFixed(2)}</Td>
                <Td>{formatCurrency(Number(payslip.grossPay))}</Td>
                <Td>{formatCurrency(Number(payslip.holidayPay))}</Td>
                <Td>{formatCurrency(Number(payslip.expenses))}</Td>
                <Td>{formatCurrency(Number(payslip.paye))}</Td>
                <Td>{formatCurrency(Number(payslip.niEmployee))}</Td>
                <Td>{formatCurrency(Number(payslip.pensionEmployee))}</Td>
                <Td className="font-semibold">{formatCurrency(Number(payslip.netPay))}</Td>
                <Td>
                  <Link
                    href={`/payroll/${run.id}/payslips/${payslip.id}`}
                    className={subtleButtonClass}
                  >
                    View payslip
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-500">
        Figures are calculated from published HMRC thresholds for {run.taxYear} and must be
        validated before submission to HMRC.
      </p>
    </div>
  );
}
