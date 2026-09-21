import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, PageHeader, StatCard, Td, Th, buttonClass, subtleButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { deletePayrollRunAction, setPayrollStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

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

        <table className="w-full min-w-[900px]">
          <thead className="bg-slate-50">
            <tr>
              <Th>Carer</Th>
              <Th>Hours</Th>
              <Th>Gross</Th>
              <Th>Holiday</Th>
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
