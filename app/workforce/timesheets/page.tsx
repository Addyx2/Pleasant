import { format, startOfWeek } from "date-fns";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Timesheets" };
export const dynamic = "force-dynamic";

export default async function WorkforceTimesheetsPage() {
  const user = await requireUser();
  const profile = user.staff;
  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No carer profile linked yet.
      </div>
    );
  }

  const all = await prisma.timesheet.findMany({
    where: { agencyId: user.agencyId, staffId: profile.id },
    include: { shift: { include: { client: true, site: true } } },
    orderBy: { clockIn: "desc" },
    take: 30,
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = all.filter((t) => t.clockIn >= weekStart);
  const weekHours = thisWeek.reduce((acc, t) => acc + t.workedMins / 60, 0);
  const needsSignOff = all.filter((t) => t.clockOut && !t.candidateSignedAt).length;
  const awaitingApproval = all.filter((t) => t.status === "PENDING").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">Timesheets</h1>
        <p className="mt-0.5 text-sm text-slate-500">{profile.firstName} {profile.lastName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium text-slate-500">This week</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{weekHours.toFixed(1)} h</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium text-slate-500">Awaiting sign-off</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{needsSignOff}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Recent shifts
        </h2>
        {all.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-600">No timesheets yet — clock in on a shift to get started.</p>
          </div>
        ) : (
          all.map((ts) => {
            const where =
              ts.shift.client != null
                ? `${ts.shift.client.firstName} ${ts.shift.client.lastName}`
                : (ts.shift.site?.name ?? "Location TBC");
            return (
              <div key={ts.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{ts.shift.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{where}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {format(ts.clockIn, "EEE d MMM")} ·{" "}
                      {ts.workedMins > 0 ? `${(ts.workedMins / 60).toFixed(1)} h worked` : "not clocked out"}
                    </p>
                    {Number(ts.expenses) > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        Expenses {formatCurrency(Number(ts.expenses))}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={ts.status} />
                </div>
              </div>
            );
          })
        )}
      </section>

      {awaitingApproval > 0 ? (
        <p className="text-center text-xs text-slate-400">
          {awaitingApproval} timesheet{awaitingApproval > 1 ? "s" : ""} awaiting agency approval
        </p>
      ) : null}
    </div>
  );
}