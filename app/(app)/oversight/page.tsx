import { Suspense } from "react";
import Link from "next/link";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CalendarPlus,
  PoundSterling,
  Receipt,
  ShieldCheck,
} from "lucide-react";

import { requireOps } from "@/lib/auth";
import { ActionCentre } from "./ActionCentre";
import { Kpis } from "./Kpis";
import { asLedgerRow, creditBandTone, creditHealth, type HomeCreditHealth } from "@/lib/credit";
import { prisma } from "@/lib/db";
import { nextCutoff, payDayForCutoff } from "@/lib/week";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
} from "@/lib/utils";
import { buttonClass, Card, EmptyState, IconTile, SkeletonCard, SkeletonTable, subtleButtonClass, Td } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { setInvoiceStatusAction } from "@/app/(app)/billing/actions";
import { clientName } from "@/lib/clients";

export const metadata = { title: "Oversight" };
export const dynamic = "force-dynamic";

function headerCopy(role: string) {
  return {
    greeting: "Oversight",
    description:
      role === "ADMIN"
        ? "A live view of the rota, approvals, billing and payroll."
        : "A live view of the rota, open shifts and approvals.",
  };
}

async function OversightHeader({ user }: { user: Awaited<ReturnType<typeof requireOps>> }) {
  const today = new Date();

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

  const copy = headerCopy(user.role);

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
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
          Next pay day {formatDate(payDay)}
        </span>
      </div>
    </div>
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
    <Card id="receivables" className={hasOverdue ? "scroll-mt-6 overflow-hidden border-red-200" : "scroll-mt-6 overflow-hidden"}>
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
                    {clientName(invoice.client)}
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
          <EmptyState
            icon={CalendarPlus}
            title="Your rota is empty"
            description="Add a one-off shift, or set up a recurring rota and Pleasant creates the shifts each week. Then offer them out to carers from Dispatch."
            action={
              <>
                <Link href="/shifts/new" className={buttonClass}>
                  Create a shift
                </Link>
                <Link href="/rota" className={subtleButtonClass}>
                  Set up a recurring rota
                </Link>
              </>
            }
          />
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
                      ? clientName(shift.client)
                      : "No client"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 sm:hidden">
                    {formatDate(shift.startAt)} · {formatTime(shift.startAt)}–{formatTime(shift.endAt)} ·{" "}
                    {shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : <span className="font-semibold text-amber-700">Unassigned</span>}
                  </p>
                </Td>
                <Td className="hidden sm:table-cell">
                  <p className="tabular">{formatTime(shift.startAt)} – {formatTime(shift.endAt)}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDate(shift.startAt)}</p>
                </Td>
                <Td className="hidden md:table-cell">
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

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function OversightPage() {
  const user = await requireOps();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="space-y-8">
      <OversightHeader user={user} />

      {/* The action centre is the page's focal point, so it carries its own heading. */}
      <Suspense fallback={<SkeletonTable rows={3} />}>
        <ActionCentre agencyId={user.agencyId} isAdmin={isAdmin} />
      </Suspense>

      <Group title="Today's operations">
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
          <Kpis agencyId={user.agencyId} />
        </Suspense>
      </Group>

      <Group title="Upcoming">
        <Suspense fallback={<SkeletonTable rows={4} />}>
          <AsyncUpcomingShifts agencyId={user.agencyId} />
        </Suspense>
      </Group>

      {/* Pay and receivables are admin-only; managers see the operational view. */}
      {isAdmin ? (
        <Group title="Business">
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
        </Group>
      ) : null}

      <Suspense fallback={null}>
        <AsyncAgentActivity agencyId={user.agencyId} />
      </Suspense>
    </div>
  );
}
