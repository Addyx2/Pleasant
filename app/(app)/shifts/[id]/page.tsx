import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeShiftEarnings } from "@/lib/payroll/engine";
import { formatCurrency, formatDateTime, formatHours, shiftDurationMins } from "@/lib/utils";
import { Card, PageHeader, StatCard, Td, Th, buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { assignShiftFormAction, deleteShiftAction, updateShiftStatusAction } from "../actions";
import { clockInFormAction, clockOutAction, decideTimesheetAction } from "../../timesheets/actions";

export const dynamic = "force-dynamic";

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [shift, staff] = await Promise.all([
    prisma.shift.findFirst({
      where: { id, agencyId: user.agencyId },
      include: { client: true, site: true, staff: true, timesheet: { include: { approvedBy: true } } },
    }),
    prisma.staffProfile.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
    }),
  ]);

  if (!shift) notFound();

  const duration = shiftDurationMins(shift.startAt, shift.endAt);
  const earnings =
    shift.staff &&
    computeShiftEarnings({
      startAt: shift.startAt,
      endAt: shift.endAt,
      breakMins: shift.breakMins,
      rates: {
        baseRate: Number(shift.staff.baseRate),
        nightRate: shift.staff.nightRate ? Number(shift.staff.nightRate) : null,
        weekendRate: shift.staff.weekendRate ? Number(shift.staff.weekendRate) : null,
        bankHolidayRate: shift.staff.bankHolidayRate ? Number(shift.staff.bankHolidayRate) : null,
      },
    });

  const locked = shift.status === "COMPLETED" || shift.status === "CANCELLED";
  const charge = Number(shift.chargeRate) * (duration / 60);

  return (
    <div className="space-y-6">
      <PageHeader
        title={shift.title}
        description={`${shift.role} · ${formatDateTime(shift.startAt)}`}
        action={
          <Link href="/shifts" className="text-sm font-medium text-brand-700 hover:underline">
            Back to shifts
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Duration" value={formatHours(duration)} hint={`${shift.breakMins} min unpaid break`} />
        <StatCard
          label="Carer cost (est.)"
          value={earnings ? formatCurrency(earnings.totalEarnings) : "—"}
          hint={shift.staff ? "Before tax and NI" : "Assign a carer"}
        />
        <StatCard label="Client charge (est.)" value={formatCurrency(charge)} hint={`${formatCurrency(Number(shift.chargeRate))}/hr`} />
        <StatCard
          label="Margin (est.)"
          value={earnings ? formatCurrency(charge - earnings.totalEarnings) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Shift details</h2>
            <StatusBadge status={shift.status} />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Detail label="Client" value={shift.client ? `${shift.client.firstName} ${shift.client.lastName}` : "—"} />
            <Detail label="Site" value={shift.site?.name ?? "—"} />
            <Detail label="Starts" value={formatDateTime(shift.startAt)} />
            <Detail label="Ends" value={formatDateTime(shift.endAt)} />
            <Detail label="Carer" value={shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : "Unassigned"} />
            <Detail label="Charge rate" value={`${formatCurrency(Number(shift.chargeRate))}/hr`} />
          </dl>
          {shift.notes ? (
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{shift.notes}</p>
          ) : null}

          {earnings && earnings.breakdown.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">Carer earnings breakdown</h3>
              <table className="mt-2 w-full">
                <thead>
                  <tr>
                    <Th>Component</Th>
                    <Th>Hours</Th>
                    <Th>Rate</Th>
                    <Th>Amount</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {earnings.breakdown.map((line) => (
                    <tr key={line.label}>
                      <Td>{line.label}</Td>
                      <Td>{(line.mins / 60).toFixed(2)}</Td>
                      <Td>{formatCurrency(line.rate)}</Td>
                      <Td>{formatCurrency(line.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <div className="space-y-6">
          {!locked ? (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-slate-900">Assign a carer</h2>
              <form action={assignShiftFormAction} className="mt-3 space-y-3">
                <input type="hidden" name="shiftId" value={shift.id} />
                <select name="staffId" defaultValue={shift.staffId ?? ""} className={inputClass} required>
                  <option value="">Choose a carer…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} · {s.jobTitle}
                    </option>
                  ))}
                </select>
                <button type="submit" className={buttonClass}>
                  {shift.staffId ? "Reassign" : "Assign"}
                </button>
              </form>
            </Card>
          ) : null}

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Timesheet</h2>
            {shift.timesheet ? (
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status={shift.timesheet.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Clocked in</span>
                  <span>{formatDateTime(shift.timesheet.clockIn)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Clocked out</span>
                  <span>{shift.timesheet.clockOut ? formatDateTime(shift.timesheet.clockOut) : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Worked</span>
                  <span className="font-medium">{formatHours(shift.timesheet.workedMins)}</span>
                </div>

                {!shift.timesheet.clockOut ? (
                  <form action={clockOutAction}>
                    <input type="hidden" name="timesheetId" value={shift.timesheet.id} />
                    <button type="submit" className={subtleButtonClass}>Clock out now</button>
                  </form>
                ) : null}

                {shift.timesheet.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <form action={decideTimesheetAction}>
                      <input type="hidden" name="timesheetId" value={shift.timesheet.id} />
                      <input type="hidden" name="decision" value="APPROVED" />
                      <button type="submit" className={buttonClass}>Approve</button>
                    </form>
                    <form action={decideTimesheetAction}>
                      <input type="hidden" name="timesheetId" value={shift.timesheet.id} />
                      <input type="hidden" name="decision" value="REJECTED" />
                      <button type="submit" className={subtleButtonClass}>Reject</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : shift.staffId ? (
              <form action={clockInFormAction} className="mt-3 space-y-3">
                <input type="hidden" name="shiftId" value={shift.id} />
                <div>
                  <label className={labelClass} htmlFor="breakMins">Break (minutes)</label>
                  <input id="breakMins" name="breakMins" type="number" min="0" step="5" defaultValue={shift.breakMins} className={inputClass} />
                </div>
                <button type="submit" className={buttonClass}>Clock in</button>
              </form>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Assign a carer to enable timesheets.</p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Status</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {["ASSIGNED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"].map((status) => (
                <form key={status} action={updateShiftStatusAction}>
                  <input type="hidden" name="shiftId" value={shift.id} />
                  <input type="hidden" name="status" value={status} />
                  <button
                    type="submit"
                    disabled={shift.status === status}
                    className={subtleButtonClass + " disabled:opacity-40"}
                  >
                    {status.replace("_", " ").toLowerCase()}
                  </button>
                </form>
              ))}
            </div>
            {["DRAFT", "OPEN", "CANCELLED"].includes(shift.status) ? (
              <form action={deleteShiftAction} className="mt-4 border-t border-slate-100 pt-4">
                <input type="hidden" name="shiftId" value={shift.id} />
                <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
                  Delete shift
                </button>
              </form>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}
