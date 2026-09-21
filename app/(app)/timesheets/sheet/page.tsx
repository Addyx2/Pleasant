import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeShiftEarnings } from "@/lib/payroll/engine";
import { addDays, mondayOf, parseISODate, toISODate } from "@/lib/week";
import { formatCurrency, formatDate, formatHours, formatTime, shiftDurationMins } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Td, Th, inputClass, labelClass, subtleButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Weekly timesheet sheet" };
export const dynamic = "force-dynamic";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function WeeklySheetPage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string; week?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const staffList = await prisma.staffProfile.findMany({
    where: { agencyId: user.agencyId },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
  });

  const staffId = params.staffId ?? staffList.find((s) => s.status === "ACTIVE")?.id ?? "";
  const monday = mondayOf(parseISODate(params.week) ?? new Date());
  const weekStart = monday;
  const weekEnd = addDays(monday, 7);
  const weekParam = toISODate(monday);

  const staff = staffId
    ? await prisma.staffProfile.findFirst({ where: { id: staffId, agencyId: user.agencyId } })
    : null;

  const shifts = staff
    ? await prisma.shift.findMany({
        where: {
          agencyId: user.agencyId,
          staffId: staff.id,
          startAt: { gte: weekStart, lt: weekEnd },
        },
        include: { client: true, site: true, timesheet: true },
        orderBy: { startAt: "asc" },
      })
    : [];

  const byDay: (typeof shifts)[] = Array.from({ length: 7 }, () => []);
  for (const shift of shifts) {
    const dayIndex = Math.floor((shift.startAt.getTime() - weekStart.getTime()) / 86400000);
    if (dayIndex >= 0 && dayIndex < 7) byDay[dayIndex].push(shift);
  }

  let weekMins = 0;
  let weekGross = 0;
  for (const shift of shifts) {
    const ts = shift.timesheet;
    weekMins += ts && ts.workedMins > 0 ? ts.workedMins : shiftDurationMins(shift.startAt, shift.endAt) - shift.breakMins;
    if (staff) {
      weekGross += computeShiftEarnings({
        startAt: shift.startAt,
        endAt: shift.endAt,
        breakMins: ts?.breakMins ?? shift.breakMins,
        rates: {
          baseRate: Number(staff.baseRate),
          nightRate: staff.nightRate ? Number(staff.nightRate) : null,
          weekendRate: staff.weekendRate ? Number(staff.weekendRate) : null,
          bankHolidayRate: staff.bankHolidayRate ? Number(staff.bankHolidayRate) : null,
        },
        isSleepIn: shift.isSleepIn,
        sleepInRate: Number(shift.sleepInRate),
        roundingMins: user.agency.roundingMins ?? 15,
      }).totalEarnings;
    }
  }

  const prevWeek = toISODate(addDays(monday, -7));
  const nextWeek = toISODate(addDays(monday, 7));
  const sheetLink = (week: string) =>
    `/timesheets/sheet?${new URLSearchParams({ staffId, week }).toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly timesheet sheet"
        description="The Mon–Sun sheet per carer — modelled on the agency paper timesheet."
        action={<PrintButton />}
      />

      <Card className="p-5">
        <form method="GET" action="/timesheets/sheet" className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass} htmlFor="staffId">Carer</label>
            <select id="staffId" name="staffId" defaultValue={staffId} className={inputClass}>
              <option value="">Choose a carer…</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} · {s.jobTitle} ({s.status.toLowerCase()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="week">Week commencing (Monday)</label>
            <input id="week" name="week" type="date" defaultValue={weekParam} className={inputClass} />
          </div>
          <button type="submit" className={subtleButtonClass}>Load sheet</button>
        </form>
      </Card>

      {!staff ? (
        <EmptyState title="No carer selected" description="Choose a carer above to load their weekly sheet." />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {staff.firstName} {staff.lastName} · {staff.jobTitle}
              </h2>
              <p className="text-sm text-slate-600">
                Week commencing Monday {formatDate(weekStart)} · {formatHours(Math.max(0, weekMins))} ·{" "}
                {formatCurrency(weekGross)} est.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={sheetLink(prevWeek)} className={subtleButtonClass}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Link>
              <Link
                href={`/timesheets/sheet?${new URLSearchParams({ staffId, week: toISODate(mondayOf(new Date())) }).toString()}`}
                className={subtleButtonClass}
              >
                This week
              </Link>
              <Link href={sheetLink(nextWeek)} className={subtleButtonClass}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Day</Th>
                  <Th>Date</Th>
                  <Th>Start</Th>
                  <Th>Finish</Th>
                  <Th>Break</Th>
                  <Th>Total</Th>
                  <Th>Sleep in</Th>
                  <Th>Client sign</Th>
                  <Th>Info</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byDay.map((dayShifts, index) => {
                  const date = addDays(weekStart, index);
                  if (dayShifts.length === 0) {
                    return (
                      <tr key={index}>
                        <Td className="font-medium">{DAY_NAMES[index]}</Td>
                        <Td>{formatDate(date)}</Td>
                        <Td colSpan={7} className="text-slate-400">—</Td>
                      </tr>
                    );
                  }
                  return dayShifts.map((shift, row) => {
                    const ts = shift.timesheet;
                    const total =
                      ts && ts.workedMins > 0
                        ? ts.workedMins
                        : shiftDurationMins(shift.startAt, shift.endAt) - shift.breakMins;
                    return (
                      <tr key={shift.id} className="hover:bg-slate-50">
                        <Td className="font-medium">
                          {row === 0 ? DAY_NAMES[index] : ""}
                          <Link href={`/shifts/${shift.id}`} className="block text-xs font-normal text-brand-700 hover:underline">
                            {shift.title}
                          </Link>
                        </Td>
                        <Td>{row === 0 ? formatDate(date) : ""}</Td>
                        <Td>{formatTime(shift.startAt)}</Td>
                        <Td>{formatTime(shift.endAt)}</Td>
                        <Td>{ts?.breakMins ?? shift.breakMins} min</Td>
                        <Td className="font-medium">{formatHours(Math.max(0, total))}</Td>
                        <Td>{shift.isSleepIn ? "✓" : "—"}</Td>
                        <Td>
                          {ts?.clientAuthAt ? (
                            <span className="text-emerald-700">✓ {ts.clientAuthName}</span>
                          ) : (
                            <span className="text-amber-700">Pending</span>
                          )}
                        </Td>
                        <Td className="max-w-[220px]">
                          <StatusBadge status={ts?.status ?? shift.status} />
                          {shift.notes ? <p className="mt-1 text-xs text-slate-500">{shift.notes}</p> : null}
                        </Td>
                      </tr>
                    );
                  });
                })}
                <tr className="bg-slate-50 font-semibold">
                  <Td colSpan={5}>Week total hours</Td>
                  <Td>{formatHours(Math.max(0, weekMins))}</Td>
                  <Td colSpan={3}>{formatCurrency(weekGross)} est. gross</Td>
                </tr>
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-slate-500">
            Hours round to the nearest {user.agency.roundingMins ?? 15} minutes. Unsigned shifts can
            be signed from the shift page.
          </p>
        </>
      )}
    </div>
  );
}
