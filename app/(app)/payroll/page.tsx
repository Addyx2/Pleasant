import Link from "next/link";
import { endOfMonth, startOfMonth } from "date-fns";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, toDateInputValue } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { NewPayrollRunForm } from "./NewPayrollRunForm";

export const metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const user = await requireUser();

  const runs = await prisma.payrollRun.findMany({
    where: { agencyId: user.agencyId },
    include: { _count: { select: { payslips: true } } },
    orderBy: { periodEnd: "desc" },
  });

  const now = new Date();
  const defaultStart = toDateInputValue(startOfMonth(now));
  const defaultEnd = toDateInputValue(endOfMonth(now));
  const defaultPayDate = toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Run payroll from approved timesheets and issue compliant payslips."
      />

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
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
