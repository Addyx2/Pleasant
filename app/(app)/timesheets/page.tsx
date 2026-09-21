import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime, formatHours } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Td, Th, buttonClass, subtleButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { clockOutAction, decideTimesheetAction } from "./actions";

export const metadata = { title: "Timesheets" };
export const dynamic = "force-dynamic";

const FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED", "DISPUTED"] as const;

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAdmin();
  const { status } = await searchParams;
  const active = FILTERS.includes((status ?? "ALL") as never) ? (status ?? "ALL") : "ALL";

  const timesheets = await prisma.timesheet.findMany({
    where: {
      agencyId: user.agencyId,
      ...(active !== "ALL" ? { status: active as never } : {}),
    },
    include: { staff: true, shift: { include: { client: true } } },
    orderBy: { clockIn: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        description="Review the hours carers have worked and approve them for payroll."
        action={
          <Link href="/timesheets/sheet" className={subtleButtonClass}>
            Weekly sheet view
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={filter === "ALL" ? "/timesheets" : `/timesheets?status=${filter}`}
            className={
              filter === active
                ? "rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      {timesheets.length === 0 ? (
        <EmptyState
          title="No timesheets here"
          description="Carers clock in against an assigned shift and their hours will appear here."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead className="bg-slate-50">
              <tr>
                <Th>Carer</Th>
                <Th>Shift</Th>
                <Th>Clocked in</Th>
                <Th>Clocked out</Th>
                <Th>Worked</Th>
                <Th>Sign-off</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {timesheets.map((ts) => (
                <tr key={ts.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="font-medium text-slate-900">
                      {ts.staff.firstName} {ts.staff.lastName}
                    </span>
                    <p className="text-xs text-slate-500">{ts.staff.jobTitle}</p>
                  </Td>
                  <Td>
                    <Link href={`/shifts/${ts.shiftId}`} className="text-slate-700 hover:underline">
                      {ts.shift.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {ts.shift.client
                        ? `${ts.shift.client.firstName} ${ts.shift.client.lastName}`
                        : "—"}
                    </p>
                  </Td>
                  <Td>{formatDateTime(ts.clockIn)}</Td>
                  <Td>{ts.clockOut ? formatDateTime(ts.clockOut) : "—"}</Td>
                  <Td className="font-medium">{formatHours(ts.workedMins)}</Td>
                  <Td>
                    <div className="flex flex-col gap-1 text-xs">
                      <span className={ts.candidateSignedAt ? "text-emerald-700" : "text-slate-400"}>
                        {ts.candidateSignedAt ? "✓ Carer signed" : "○ Carer unsigned"}
                      </span>
                      <span className={ts.clientAuthAt ? "text-emerald-700" : "text-amber-700"}>
                        {ts.clientAuthAt ? "✓ Client authorised" : "○ Client pending"}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <StatusBadge status={ts.status} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      {!ts.clockOut ? (
                        <form action={clockOutAction}>
                          <input type="hidden" name="timesheetId" value={ts.id} />
                          <button type="submit" className={subtleButtonClass}>Clock out</button>
                        </form>
                      ) : null}
                      {ts.status === "PENDING" && ts.clientAuthAt ? (
                        <>
                          <form action={decideTimesheetAction}>
                            <input type="hidden" name="timesheetId" value={ts.id} />
                            <input type="hidden" name="decision" value="APPROVED" />
                            <button type="submit" className={buttonClass}>Approve</button>
                          </form>
                          <form action={decideTimesheetAction}>
                            <input type="hidden" name="timesheetId" value={ts.id} />
                            <input type="hidden" name="decision" value="REJECTED" />
                            <button type="submit" className={subtleButtonClass}>Reject</button>
                          </form>
                        </>
                      ) : null}
                      {ts.status === "PENDING" && !ts.clientAuthAt ? (
                        <Link href={`/shifts/${ts.shiftId}`} className="text-xs font-medium text-amber-700 hover:underline">
                          Get client sign-off
                        </Link>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
