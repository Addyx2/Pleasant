import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>;
}) {
  const { id, payslipId } = await params;
  const user = await requireAdmin();

  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, payrollRunId: id, payrollRun: { agencyId: user.agencyId } },
    include: {
      staff: true,
      lines: { orderBy: { sortOrder: "asc" } },
      payrollRun: true,
    },
  });

  if (!payslip) notFound();

  const run = payslip.payrollRun;
  const earnings = payslip.lines.filter((line) => line.type === "EARNING");
  const deductions = payslip.lines.filter((line) => line.type === "DEDUCTION");
  const employerCosts = payslip.lines.filter((line) => line.type === "EMPLOYER_COST");
  const totalDeductions = deductions.reduce((sum, line) => sum + Number(line.amount), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/payroll/${run.id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Back to run {run.reference}
        </Link>
        <PrintButton />
      </div>

      <Card className="p-8 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
                P
              </span>
              <span className="text-lg font-semibold tracking-tight">{user.agency.name}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {user.agency.address ?? "—"}
              {user.agency.postcode ? `, ${user.agency.postcode}` : ""}
            </p>
            {user.agency.payrollRef ? (
              <p className="text-xs text-slate-500">PAYE ref: {user.agency.payrollRef}</p>
            ) : null}
          </div>
          <div className="text-right">
            <h1 className="text-xl font-semibold tracking-tight">Payslip</h1>
            <p className="text-sm text-slate-600">Tax year {run.taxYear}</p>
            <p className="text-sm text-slate-600">Pay date {formatDate(run.payDate)}</p>
          </div>
        </div>

        {payslip.taxCode === "LTD" ? (
          <p className="mt-6 rounded-xl bg-sky-50 px-5 py-3 text-sm text-sky-800">
            Ltd-company engagement{payslip.staff.ltdCompanyName ? ` · ${payslip.staff.ltdCompanyName}` : ""} —
            paid gross with no PAYE deductions.
          </p>
        ) : null}

        <div className="grid gap-4 py-6 sm:grid-cols-3">
          <Field label="Employee" value={`${payslip.staff.firstName} ${payslip.staff.lastName}`} />
          <Field label="Job title" value={payslip.staff.jobTitle} />
          <Field label="NI number" value={payslip.niNumber ?? "—"} />
          <Field label="Tax code" value={payslip.taxCode} />
          <Field label="Pay period" value={`${formatDate(run.periodStart)} – ${formatDate(run.periodEnd)}`} />
          <Field label="Hours paid" value={Number(payslip.timesheetHours).toFixed(2)} />
        </div>

        <Section title="Earnings">
          {earnings.map((line) => (
            <Row
              key={line.id}
              label={line.label}
              detail={
                line.rate
                  ? `${Number(line.quantity ?? 0).toFixed(0)} mins @ ${formatCurrency(Number(line.rate))}`
                  : undefined
              }
              amount={Number(line.amount)}
            />
          ))}
          <Row label="Taxable pay" amount={Number(payslip.taxablePay)} strong />
        </Section>

        <Section title="Deductions">
          {deductions.map((line) => (
            <Row key={line.id} label={line.label} amount={-Number(line.amount)} />
          ))}
          <Row label="Total deductions" amount={-totalDeductions} strong />
        </Section>

        <div className="mt-6 flex items-center justify-between rounded-xl bg-brand-50 px-5 py-4">
          <span className="text-sm font-semibold text-brand-900">Net pay</span>
          <span className="text-2xl font-bold text-brand-900">
            {formatCurrency(Number(payslip.netPay))}
          </span>
        </div>

        {employerCosts.length > 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Employer contributions (not deducted from pay)
            </p>
            <div className="mt-2 space-y-1">
              {employerCosts.map((line) => (
                <div key={line.id} className="flex justify-between text-sm text-slate-600">
                  <span>{line.label}</span>
                  <span>{formatCurrency(Number(line.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
          This payslip is generated by Pleasant from approved timesheets. Deductions are
          calculated using published HMRC thresholds for {run.taxYear}.
        </p>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-2 divide-y divide-slate-100 border-y border-slate-100">{children}</div>
    </div>
  );
}

function Row({
  label,
  detail,
  amount,
  strong,
}: {
  label: string;
  detail?: string;
  amount: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className={strong ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-700"}>
          {label}
        </p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
      </div>
      <p
        className={
          strong
            ? "text-sm font-semibold text-slate-900"
            : amount < 0
              ? "text-sm text-slate-700"
              : "text-sm text-slate-700"
        }
      >
        {formatCurrency(amount)}
      </p>
    </div>
  );
}
