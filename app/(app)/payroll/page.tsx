import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, mondayOf, nextCutoff, payDayForCutoff, toISODate, weekdayName } from "@/lib/week";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { NewPayrollRunForm } from "./NewPayrollRunForm";

export const metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const user = await requireAdmin();

  const runs = await prisma.payrollRun.findMany({
    where: { agencyId: user.agencyId },
    include: { _count: { select: { payslips: true } } },
    orderBy: { periodEnd: "desc" },
  });
  const waiting = await prisma.payAddition.aggregate({
    where: { agencyId: user.agencyId, payrollRunId: null },
    _count: true,
    _sum: { amount: true },
  });

  // Weekly cycle: Mon–Sun period, Monday 4pm cutoff, Friday pay day.
  const monday = mondayOf(new Date());
  const sunday = addDays(monday, 6);
  const defaultStart = toISODate(monday);
  const defaultEnd = toISODate(sunday);
  const defaultPayDate = toISODate(addDays(sunday, 5));

  const cycle = {
    cutoffWeekday: user.agency.cutoffWeekday,
    cutoffTime: user.agency.cutoffTime,
    payWeekday: user.agency.payWeekday,
  };
  const cutoff = nextCutoff(cycle);
  const payDay = payDayForCutoff(cycle, cutoff);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description={`Approved, client-authorised timesheets only. Next cutoff ${weekdayName(user.agency.cutoffWeekday)} ${formatDateTime(cutoff)} for pay day ${formatDate(payDay)}.`}
      />

      {waiting._count > 0 ? (
        <p role="status" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
          {waiting._count} Peak reward{waiting._count === 1 ? "" : "s"} ({formatCurrency(Number(waiting._sum.amount ?? 0))}) will be added to the next run, as taxable pay, for carers who have approved timesheets in it.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-x-auto p-0 lg:col-span-2">
          {runs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No payroll runs yet"
                description="Approve some timesheets, then generate your first run."
              />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Reference</Th>
                  <Th>Period</Th>
                  <Th>Pay date</Th>
                  <Th>Cares</Th>
                  <Th>Gross</Th>
                  <Th>Net</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <Td>
                      <Link href={`/payroll/${run.id}`} className="font-medium text-brand-700 hover:underline">
                        {run.reference}
                      </Link>
                      <p className="text-xs text-slate-500">{run.taxYear}</p>
                    </Td>
                    <Td>{formatDate(run.periodStart)} – {formatDate(run.periodEnd)}</Td>
                    <Td>{formatDate(run.payDate)}</Td>
                    <Td>{run._count.payslips}</Td>
                    <Td>{formatCurrency(Number(run.grossTotal))}</Td>
                    <Td>{formatCurrency(Number(run.netTotal))}</Td>
                    <Td>
                      <StatusBadge status={run.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-slate-900">New payroll run</h2>
          <div className="mt-4">
            <NewPayrollRunForm
              defaultStart={defaultStart}
              defaultEnd={defaultEnd}
              defaultPayDate={defaultPayDate}
              defaultPeriod={user.agency.payFrequency ?? "WEEKLY"}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
