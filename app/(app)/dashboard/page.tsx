import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import {
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  PoundSterling,
  Receipt,
  Users,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextCutoff, payDayForCutoff } from "@/lib/week";
import { formatCurrency, formatDate, formatHours, formatTime } from "@/lib/utils";
import { Card, EmptyState, IconTile, StatCard, Td } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAdmin();
  const agencyId = user.agencyId;

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [openShifts, shiftsToday, pendingTimesheets, activeStaff, upcoming, approvals, latestRun, billing] =
    await Promise.all([
      prisma.shift.count({ where: { agencyId, status: "OPEN" } }),
      prisma.shift.count({
        where: { agencyId, startAt: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
      }),
      prisma.timesheet.count({ where: { agencyId, status: "PENDING" } }),
      prisma.staffProfile.count({ where: { agencyId, status: "ACTIVE" } }),
      prisma.shift.findMany({
        where: { agencyId, startAt: { gte: today }, status: { not: "CANCELLED" } },
        include: { client: true, staff: true },
        orderBy: { startAt: "asc" },
        take: 6,
      }),
      prisma.timesheet.findMany({
        where: { agencyId, status: "PENDING" },
        include: { staff: true, shift: true },
        orderBy: { clockIn: "asc" },
        take: 5,
      }),
      prisma.payrollRun.findFirst({
        where: { agencyId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.aggregate({
        where: { agencyId, status: { in: ["ISSUED", "PAID"] } },
        _sum: { chargeTotal: true, marginTotal: true },
        _count: true,
      }),
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {formatDate(today)}
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Good to see you, {user.firstName}.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          A live view of {user.agency.name}&apos;s rota, approvals, billing and payroll.
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
        </div>
      </div>

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

      {latestRun ? (
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
      ) : null}

      {billing._count > 0 ? (
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
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
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
      </div>
    </div>
  );
}