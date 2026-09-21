import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import { CalendarClock, ClipboardCheck, PoundSterling, Users } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextCutoff, payDayForCutoff, weekdayName } from "@/lib/week";
import { formatCurrency, formatDate, formatDateTime, formatHours, formatTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader, StatCard, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const agencyId = user.agencyId;

  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [openShifts, shiftsToday, pendingTimesheets, activeStaff, upcoming, approvals, latestRun] =
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
    ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good to see you, ${user.firstName}`}
        description="A live view of your agency's rota, approvals and payroll."
      />

      <CutoffBanner
        cutoffWeekday={user.agency.cutoffWeekday}
        cutoffTime={user.agency.cutoffTime}
        payWeekday={user.agency.payWeekday}
        pending={pendingTimesheets}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open shifts" value={String(openShifts)} hint="Need a carer assigned" icon={CalendarClock} />
        <StatCard label="Shifts today" value={String(shiftsToday)} icon={CalendarClock} />
        <StatCard label="Awaiting approval" value={String(pendingTimesheets)} hint="Timesheets to review" icon={ClipboardCheck} />
        <StatCard label="Active carers" value={String(activeStaff)} icon={Users} />
      </div>

      {latestRun ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <PoundSterling className="h-5 w-5 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Latest payroll run · {latestRun.reference}
              </p>
              <p className="text-xs text-slate-500">
                {formatCurrency(latestRun.netTotal)} net · {formatCurrency(latestRun.grossTotal)} gross
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={latestRun.status} />
            <Link href={`/payroll/${latestRun.id}`} className="text-sm font-medium text-brand-700 hover:underline">
              View run
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming shifts</h2>
            <Link href="/shifts" className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No upcoming shifts" description="Create a shift to fill your rota." />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Shift</Th>
                  <Th>When</Th>
                  <Th>Carer</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upcoming.map((shift) => (
                  <tr key={shift.id}>
                    <Td>
                      <Link href={`/shifts/${shift.id}`} className="font-medium text-slate-900 hover:underline">
                        {shift.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {shift.client ? `${shift.client.firstName} ${shift.client.lastName}` : "No client"}
                      </p>
                    </Td>
                    <Td>
                      <p>{formatTime(shift.startAt)} – {formatTime(shift.endAt)}</p>
                      <p className="text-xs text-slate-500">{shift.startAt.toDateString()}</p>
                    </Td>
                    <Td>
                      {shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : (
                        <span className="text-amber-700">Unassigned</span>
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
            <h2 className="text-sm font-semibold text-slate-900">Timesheets to approve</h2>
            <Link href="/timesheets" className="text-xs font-medium text-brand-700 hover:underline">
              Review
            </Link>
          </div>
          {approvals.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Nothing to approve" description="All timesheets are up to date." />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Carer</Th>
                  <Th>Shift</Th>
                  <Th>Hours</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvals.map((ts) => (
                  <tr key={ts.id}>
                    <Td>
                      <span className="font-medium text-slate-900">
                        {ts.staff.firstName} {ts.staff.lastName}
                      </span>
                    </Td>
                    <Td>{ts.shift.title}</Td>
                    <Td>{formatHours(ts.workedMins)}</Td>
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

function CutoffBanner({
  cutoffWeekday,
  cutoffTime,
  payWeekday,
  pending,
}: {
  cutoffWeekday: number;
  cutoffTime: string;
  payWeekday: number;
  pending: number;
}) {
  const cycle = { cutoffWeekday, cutoffTime, payWeekday };
  const cutoff = nextCutoff(cycle);
  const payDay = payDayForCutoff(cycle, cutoff);

  return (
    <Card className="border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
      Timesheets are due <strong>{weekdayName(cutoffWeekday)} {formatDateTime(cutoff)}</strong>{" "}
      to be paid on <strong>{formatDate(payDay)}</strong>.
      {pending > 0 ? (
        <> <strong>{pending}</strong> awaiting sign-off and approval.</>
      ) : (
        <> Nothing outstanding.</>
      )}
    </Card>
  );
}
