import { addDays } from "date-fns";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatTime, shiftDurationMins } from "@/lib/utils";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Open shifts" };
export const dynamic = "force-dynamic";

export default async function OpenShiftsPage() {
  const user = await requireUser();

  const shifts = await prisma.shift.findMany({
    where: {
      agencyId: user.agencyId,
      staffId: null,
      status: "OPEN",
      startAt: { gte: new Date(), lte: addDays(new Date(), 30) },
    },
    include: { client: true, site: true },
    orderBy: { startAt: "asc" },
    take: 30,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">Open shifts</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Unscheduled shifts your agency needs covering.
        </p>
      </div>

      {shifts.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing open right now</p>
          <p className="mt-1 text-xs text-slate-500">
            No unscheduled shifts in the next 30 days. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => {
            const where =
              shift.client != null
                ? `${shift.client.firstName} ${shift.client.lastName}`
                : (shift.site?.name ?? "Location TBC");
            return (
              <div key={shift.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{shift.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{where}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(shift.startAt)} · {formatTime(shift.startAt)} –{" "}
                      {formatTime(shift.endAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {Math.round(shiftDurationMins(shift.startAt, shift.endAt) / 60)} h · {shift.role}
                    </p>
                    {shift.isSleepIn ? (
                      <p className="mt-1 text-xs font-medium text-indigo-700">
                        Sleep-in · {formatCurrency(Number(shift.sleepInRate))} flat
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={shift.status} />
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-4 w-full rounded-full bg-slate-100 px-4 py-3 text-base font-semibold text-slate-400"
                >
                  Request shift — coming soon
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        All open shifts across the agency · up to 30 days ahead
      </p>
    </div>
  );
}