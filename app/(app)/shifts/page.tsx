import Link from "next/link";
import { Calendar, List, Plus } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatTime, shiftDurationMins } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, Td, Th, buttonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Shifts" };
export const dynamic = "force-dynamic";

const FILTERS = ["ALL", "OPEN", "ASSIGNED", "COMPLETED"] as const;

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAdmin();
  const { status } = await searchParams;
  const active = FILTERS.includes((status ?? "ALL") as never) ? (status ?? "ALL") : "ALL";

  const shifts = await prisma.shift.findMany({
    where: {
      agencyId: user.agencyId,
      ...(active !== "ALL" ? { status: active as never } : {}),
    },
    include: { client: true, staff: true, site: true, rotaTemplate: true } as any,
    orderBy: { startAt: "desc" },
    take: 100,
  });

  const calendarHref =
    active === "ALL" ? "/shifts/calendar" : `/shifts/calendar?status=${active}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        description="Your rota across every client and site."
        action={
          <Link href="/shifts/new" className={buttonClass}>
            <Plus className="h-4 w-4" /> New shift
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Link
              key={filter}
              href={filter === "ALL" ? "/shifts" : `/shifts?status=${filter}`}
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
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href={active === "ALL" ? "/shifts" : `/shifts?status=${active}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-900"
          >
            <List className="h-3.5 w-3.5" /> List
          </Link>
          <Link
            href={calendarHref}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </Link>
        </div>
      </div>

      {shifts.length === 0 ? (
        <EmptyState
          title="No shifts yet"
          description="Create your first shift to start building the rota."
          action={
            <Link href="/shifts/new" className={buttonClass}>
              <Plus className="h-4 w-4" /> New shift
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50">
              <tr>
                <Th>Shift</Th>
                <Th>Date</Th>
                <Th>Time</Th>
                <Th>Duration</Th>
                <Th>Carer</Th>
                <Th>Source</Th>
                <Th>Charge</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-slate-50">
                  <Td>
                    <Link href={`/shifts/${shift.id}`} className="font-medium text-slate-900 hover:underline">
                      {shift.title}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {(shift as any).client
                        ? `${(shift as any).client.firstName} ${(shift as any).client.lastName}`
                        : (shift as any).site?.name ?? "No client"}
                    </p>
                  </Td>
                  <Td>{formatDate(shift.startAt)}</Td>
                  <Td>
                    {formatTime(shift.startAt)} – {formatTime(shift.endAt)}
                  </Td>
                  <Td>{Math.round(shiftDurationMins(shift.startAt, shift.endAt) / 60)}h</Td>
                  <Td>
                    {(shift as any).staff ? (
                      `${(shift as any).staff.firstName} ${(shift as any).staff.lastName}`
                    ) : (
                      <span className="text-amber-700">Unassigned</span>
                    )}
                  </Td>
                  <Td>
                    {(shift as any).rotaTemplate ? (
                      <Badge tone="blue">{(shift as any).rotaTemplate.title}</Badge>
                    ) : (
                      <Badge tone="slate">One-off</Badge>
                    )}
                  </Td>
                  <Td>{formatCurrency(Number(shift.chargeRate))}/h</Td>
                  <Td>
                    <StatusBadge status={shift.status} />
                  </Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(shift as any).status === "OPEN" && !(shift as any).staffId ? (
                        <Link href={`/dispatch?tab=to-cover`} className="text-sm font-medium text-brand-700 hover:underline">
                          Assign
                        </Link>
                      ) : null}
                      <Link href={`/shifts/${shift.id}`} className="text-sm font-medium text-brand-700 hover:underline">
                        View
                      </Link>
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
