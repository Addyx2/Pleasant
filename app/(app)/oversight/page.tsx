import { Suspense } from "react";
import Link from "next/link";
import { differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  ClipboardCheck,
  PoundSterling,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { asLedgerRow, creditBandTone, creditHealth, type HomeCreditHealth } from "@/lib/credit";
import { prisma } from "@/lib/db";
import { nextCutoff, payDayForCutoff } from "@/lib/week";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatHours,
  formatTime,
} from "@/lib/utils";
import { Card, EmptyState, IconTile, SkeletonCard, SkeletonTable, StatCard, Td } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { setInvoiceStatusAction } from "@/app/(app)/billing/actions";

export const metadata = { title: "Oversight" };
export const dynamic = "force-dynamic";

function headerCopy() {
  return {
    greeting: "Oversight",
    description: "A live view of the rota, approvals, billing and payroll.",
  };
}

async function OversightHeader({ user }: { user: Awaited<ReturnType<typeof requireAdmin>> }) {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [shiftsToday, pendingTimesheets, unattended] = await Promise.all([
    prisma.shift.count({
      where: { agencyId: user.agencyId, startAt: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    }),
    prisma.timesheet.count({ where: { agencyId: user.agencyId, status: "PENDING" } }),
    prisma.shift.count({ where: { agencyId: user.agencyId, status: "UNATTENDED" } }),
  ]);

  const cutoff = nextCutoff({
    cutoffWeekday: user.agency.cutoffWeekday,
    cutoffTime: user.agency.cutoffTime,
    payWeekday: user.agency.payWeekday,
  });
  const payDay = payDayForCutoff(
    {
      cutoffWeekday: user.agency.cutoffWeekday,
      cutoffTime: user.agency.cutoffTime,
      payWeekday: user.agency.payWeekday,
    },
    cutoff,
  );

  const copy = headerCopy();

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {formatDate(today)}
      </p>
      <h1 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {copy.greeting}, {user.firstName}.
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {user.agency.name} · {copy.description}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
          {shiftsToday} shift{shiftsToday === 1 ? "" : "s"} today
        </span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
          Pay on {formatDate(payDay)}
        </span>
        {pendingTimesheets > 0 ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-semibold text-amber-800">
            {pendingTimesheets} timesheet{pendingTimesheets === 1 ? "" : "s"} to approve
          </span>
        ) : null}
        {unattended > 0 ? (
          <Link href="/shifts/unattended">
            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 font-semibold text-red-800">
              {unattended} unattended shift{unattended === 1 ? "" : "s"} — needs a carer
            </span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

async function AsyncStatCards({ agencyId }: { agencyId: string }) {
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [openShifts, shiftsToday, pendingTimesheets, activeStaff] = await Promise.all([
    prisma.shift.count({ where: { agencyId, status: "OPEN" } }),
    prisma.shift.count({
      where: { agencyId, startAt: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    }),
    prisma.timesheet.count({ where: { agencyId, status: "PENDING" } }),
    prisma.staffProfile.count({ where: { agencyId, status: "ACTIVE" } }),
  ]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Open shifts"
        value={String(openShifts)}
        hint="Need a carer assigned"
        icon={CalendarClock}
        tone="amber"
      />
      <StatCard label="Shifts today" value={String(shiftsToday)} icon={CalendarClock} tone="brand" />
      <StatCard
        label="Awaiting approval"
        value={String(pendingTimesheets)}
        hint="Timesheets to review"
        icon={ClipboardCheck}
        tone="blue"
      />
      <StatCard label="Active carers" value={String(activeStaff)} icon={Users} tone="green" />
    </div>
  );
}

async function AsyncUnattendedAlert({ agencyId }: { agencyId: string }) {
  const unattended = await prisma.shift.findMany({
    where: { agencyId, status: "UNATTENDED" },
    include: { client: true },
    orderBy: { updatedAt: "asc" },
    take: 5,
  });

  if (unattended.length === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50/60">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <IconTile icon={AlertTriangle} tone="red" />
          <div>
            <p className="text-sm font-semibold text-red-900">
              {unattended.length} unattended shift{unattended.length === 1 ? "" : "s"} need a carer now
            </p>
            <p className="mt-0.5 text-xs text-red-700">
              {unattended
                .map((s) => (s.client ? `${s.client.firstName} ${s.client.lastName}` : "Unassigned"))
                .join(" · ")}
            </p>
          </div>
        </div>
        <Link
          href="/shifts/unattended"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
        >
          Open triage queue <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

async function AsyncLatestPayroll({ agencyId }: { agencyId: string }) {
  const latestRun = await prisma.payrollRun.findFirst({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestRun) return null;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-4">
        <IconTile icon={PoundSterling} tone="brand" />
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Latest payroll run · {latestRun.reference}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="tabular font-semibold text-slate-700">
              {formatCurrency(latestRun.netTotal)} net
            </span>{" "}
            · {formatCurrency(latestRun.grossTotal)} gross
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={latestRun.status} />
        <Link
          href={`/payroll/${latestRun.id}`}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15 transition hover:bg-brand-100"
        >
          View run <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

async function AsyncBilling({ agencyId }: { agencyId: string }) {
  const billing = await prisma.invoice.aggregate({
    where: { agencyId, status: { in: ["ISSUED", "PAID"] } },
    _sum: { chargeTotal: true, marginTotal: true },
    _count: true,
  });

  if (billing._count === 0) return null;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-4">
        <IconTile icon={Receipt} tone="blue" />
        <div>
          <p className="text-sm font-semibold text-slate-900">Client billing</p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="tabular font-semibold text-slate-700">
              {formatCurrency(Number(billing._sum.chargeTotal ?? 0))} billed
            </span>{" "}
            ·{" "}
            <span className="tabular font-semibold text-emerald-600">
              {formatCurrency(Number(billing._sum.marginTotal ?? 0))} margin
            </span>{" "}
            · {billing._count} invoice{billing._count === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15 transition hover:bg-brand-100"
        >
          View billing <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}

interface AgingBuckets {
  current: number;
  d0_30: number;
  d31_60: number;
  d60: number;
}

function bucketLabel(bucket: keyof AgingBuckets): string {
  switch (bucket) {
    case "current":
      return "Not yet due";
    case "d0_30":
      return "1–30d";
    case "d31_60":
      return "31–60d";
    case "d60":
      return "60d+";
  }
}

function CreditBadge({ health }: { health: HomeCreditHealth }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
    amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/15",
  } as const;
  const tone = creditBandTone(health.band);
  return (
    <span
      title={`Home ${health.band} · ${health.detail}`}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-inset ${tones[tone]}`}
    >
      {health.band}
    </span>
  );
}

async function AsyncReceivables({ agencyId }: { agencyId: string }) {
  const [unpaid, ledger] = await Promise.all([
    prisma.invoice.findMany({
      where: { agencyId, status: "ISSUED" },
      include: {
        client: true,
        lines: { include: { timesheet: { select: { clientAuthAt: true } } } },
      },
      orderBy: { dueDate: "asc" },
      take: 100,
    }),
    prisma.invoice.findMany({
      where: { agencyId, status: { in: ["ISSUED", "PAID"] } },
      select: {
        id: true,
        clientId: true,
        status: true,
        issueDate: true,
        dueDate: true,
        paidAt: true,
        grandTotal: true,
      },
    }),
  ]);

  if (unpaid.length === 0) return null;

  const ledgerByClient = new Map<string, ReturnType<typeof asLedgerRow>[]>();
  for (const row of ledger) {
    const list = ledgerByClient.get(row.clientId) ?? [];
    list.push(asLedgerRow(row));
    ledgerByClient.set(row.clientId, list);
  }
  const healthByClient = new Map<string, HomeCreditHealth>();
  for (const [clientId, rows] of ledgerByClient) {
    healthByClient.set(clientId, creditHealth(rows));
  }

  let totalLines = 0;
  let signedLines = 0;
  for (const invoice of unpaid) {
    totalLines += invoice.lines.length;
    signedLines += invoice.lines.filter((l) => l.timesheet?.clientAuthAt).length;
  }
  const signedCoveragePct = totalLines > 0 ? Math.round((signedLines / totalLines) * 100) : 0;

  const today = startOfDay(new Date());
  const buckets: AgingBuckets = { current: 0, d0_30: 0, d31_60: 0, d60: 0 };
  let outstanding = 0;
  let overdueCount = 0;

  const rows = unpaid.map((invoice) => {
    const due = startOfDay(invoice.dueDate ?? invoice.issueDate ?? invoice.periodEnd);
    const overdueDays = differenceInCalendarDays(today, due);
    const amount = Number(invoice.grandTotal);
    outstanding += amount;
    const bucket: keyof AgingBuckets = overdueDays <= 0 ? "current" : overdueDays <= 30 ? "d0_30" : overdueDays <= 60 ? "d31_60" : "d60";
    buckets[bucket] += amount;
    if (overdueDays > 0) overdueCount += 1;
    return { invoice, overdueDays, amount };
  });

  const hasOverdue = overdueCount > 0;

  return (
    <Card className={hasOverdue ? "overflow-hidden border-red-200" : "overflow-hidden"}>
      <div className={`flex items-center justify-between border-b px-5 py-4 ${hasOverdue ? "border-red-100" : "border-slate-200"}`}>
        <div className="flex items-center gap-2.5">
          <IconTile icon={Banknote} tone={hasOverdue ? "red" : "blue"} className="h-8 w-8" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Accounts receivable</h2>
            <p className="text-xs text-slate-500">
              {unpaid.length} open invoice{unpaid.length === 1 ? "" : "s"} ·{" "}
              <span className={`font-semibold ${hasOverdue ? "text-red-700" : "text-slate-700"}`}>
                {formatCurrency(outstanding)}
              </span>{" "}
              outstanding
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Funding ready when invoices carry client sign-off —{" "}
              <span
                className={
                  signedCoveragePct === 100
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-amber-700"
                }
              >
                {signedCoveragePct}%
              </span>{" "}
              of open lines signed by the home
            </p>
          </div>
        </div>
        <Link
          href="/billing"
          className="text-xs font-semibold text-brand-700 transition hover:text-brand-800"
        >
          Billing →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
        {(Object.keys(buckets) as Array<keyof AgingBuckets>).map((key) => (
          <span
            key={key}
            className={
              key === "current"
                ? "rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200"
                : "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200"
            }
          >
            {bucketLabel(key)}: {formatCurrency(buckets[key])}
          </span>
        ))}
        <span
          title="Share of open invoice lines with a recorded client sign-off via Pleasant Link"
          className={
            signedCoveragePct === 100
              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15"
              : "rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20"
          }
        >
          {signedCoveragePct}% client-signed
        </span>
      </div>

      <table className="w-full">
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ invoice, overdueDays, amount }) => {
            const health = healthByClient.get(invoice.clientId);
            return (
              <tr key={invoice.id} className="transition duration-100 hover:bg-slate-50/70">
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Link
                      href={`/billing/${invoice.id}`}
                      className="font-medium text-slate-900 transition hover:text-brand-700"
                    >
                      {invoice.reference}
                    </Link>
                    {health ? <CreditBadge health={health} /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {invoice.client.firstName} {invoice.client.lastName}
                  </p>
                  <Link
                    href={`/billing-pack/${invoice.id}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 transition hover:text-brand-800"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Lender pack
                  </Link>
                </Td>
                <Td>
                  <p className="tabular text-sm text-slate-700">{formatDate(invoice.dueDate ?? invoice.issueDate ?? invoice.periodEnd)}</p>
                  <p className={`mt-0.5 text-xs font-medium ${overdueDays > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {overdueDays > 0
                      ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`
                      : overdueDays === 0
                        ? "Due today"
                        : `Due in ${Math.abs(overdueDays)}d`}
                  </p>
                </Td>
                <Td>
                  <span className="tabular text-sm font-semibold text-slate-900">{formatCurrency(amount)}</span>
                </Td>
                <Td>
                  <form action={setInvoiceStatusAction}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <input type="hidden" name="status" value="PAID" />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15 transition hover:bg-emerald-100"
                    >
                      Mark paid
                    </button>
                  </form>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

async function AsyncUpcomingShifts({ agencyId }: { agencyId: string }) {
  const today = new Date();
  const upcoming = await prisma.shift.findMany({
    where: { agencyId, startAt: { gte: today }, status: { not: "CANCELLED" } },
    include: { client: true, staff: true },
    orderBy: { startAt: "asc" },
    take: 6,
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <IconTile icon={CalendarClock} tone="brand" className="h-8 w-8" />
          <h2 className="text-sm font-semibold text-slate-900">Upcoming shifts</h2>
        </div>
        <Link
          href="/shifts"
          className="text-xs font-semibold text-brand-700 transition hover:text-brand-800"
        >
          View all →
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No upcoming shifts" description="Create a shift to fill your rota." />
        </div>
      ) : (
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {upcoming.map((shift) => (
              <tr key={shift.id} className="transition duration-100 hover:bg-slate-50/70">
                <Td>
                  <Link
                    href={`/shifts/${shift.id}`}
                    className="font-medium text-slate-900 transition hover:text-brand-700"
                  >
                    {shift.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {shift.client
                      ? `${shift.client.firstName} ${shift.client.lastName}`
                      : "No client"}
                  </p>
                </Td>
                <Td>
                  <p className="tabular">{formatTime(shift.startAt)} – {formatTime(shift.endAt)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{shift.startAt.toDateString()}</p>
                </Td>
                <Td>
                  {shift.staff ? (
                    `${shift.staff.firstName} ${shift.staff.lastName}`
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/15">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                      Unassigned
                    </span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={shift.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

async function AsyncTimesheetApprovals({ agencyId }: { agencyId: string }) {
  const approvals = await prisma.timesheet.findMany({
    where: { agencyId, status: "PENDING" },
    include: { staff: true, shift: true },
    orderBy: { clockIn: "asc" },
    take: 5,
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <IconTile icon={ClipboardCheck} tone="blue" className="h-8 w-8" />
          <h2 className="text-sm font-semibold text-slate-900">Timesheets to approve</h2>
        </div>
        <Link
          href="/timesheets"
          className="text-xs font-semibold text-brand-700 transition hover:text-brand-800"
        >
          Review →
        </Link>
      </div>
      {approvals.length === 0 ? (
        <div className="p-5">
          <EmptyState title="Nothing to approve" description="All timesheets are up to date." />
        </div>
      ) : (
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {approvals.map((ts) => (
              <tr key={ts.id} className="transition duration-100 hover:bg-slate-50/70">
                <Td>
                  <span className="font-medium text-slate-900">
                    {ts.staff.firstName} {ts.staff.lastName}
                  </span>
                  <p className="mt-0.5 text-xs text-slate-500">{ts.shift.title}</p>
                </Td>
                <Td>
                  <p className="tabular text-sm font-semibold text-slate-900">
                    {formatHours(ts.workedMins)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(ts.clockIn)}
                  </p>
                </Td>
                <Td>
                  <StatusBadge status={ts.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

async function AsyncAgentActivity({ agencyId }: { agencyId: string }) {
  const events = await prisma.agentLog.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  if (events.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
        <IconTile icon={Activity} tone="slate" className="h-8 w-8" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Automation activity</h2>
          <p className="text-xs text-slate-500">Audited events from the platform.</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-800">
                <span className="font-semibold text-slate-900">{event.agentName}</span> · {event.action}
                {event.details ? <span className="text-slate-500"> — {event.details}</span> : null}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(event.createdAt)}</p>
            </div>
            <StatusBadge status={event.status} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function OversightPage() {
  const user = await requireAdmin();

  return (
    <div className="space-y-6">
      <OversightHeader user={user} />

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        }
      >
        <AsyncStatCards agencyId={user.agencyId} />
      </Suspense>

      <Suspense fallback={null}>
        <AsyncUnattendedAlert agencyId={user.agencyId} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={null}>
          <AsyncLatestPayroll agencyId={user.agencyId} />
        </Suspense>

        <Suspense fallback={null}>
          <AsyncBilling agencyId={user.agencyId} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <AsyncReceivables agencyId={user.agencyId} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<SkeletonTable rows={4} />}>
          <AsyncUpcomingShifts agencyId={user.agencyId} />
        </Suspense>

        <Suspense fallback={<SkeletonTable rows={4} />}>
          <AsyncTimesheetApprovals agencyId={user.agencyId} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <AsyncAgentActivity agencyId={user.agencyId} />
      </Suspense>
    </div>
  );
}