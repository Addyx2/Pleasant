import Link from "next/link";
import { Plus } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatTime, shiftDurationMins } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Td, Th, buttonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Shifts" };
export const dynamic = "force-dynamic";

const FILTERS = ["ALL", "OPEN", "ASSIGNED", "COMPLETED"] as const;

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status } = await searchParams;
  const active = FILTERS.includes((status ?? "ALL") as never) ? (status ?? "ALL") : "ALL";

  const shifts = await prisma.shift.findMany({
    where: {
      agencyId: user.agencyId,
      ...(active !== "ALL" ? { status: active as never } : {}),
    },
    include: { client: true, staff: true, site: true },
    orderBy: { startAt: "desc" },
    take: 100,
  });

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
                <Th>Charge</Th>
                <Th>Status</Th>
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
                      {shift.client
                        ? `${shift.client.firstName} ${shift.client.lastName}`
                        : shift.site?.name ?? "No client"}
                    </p>
                  </Td>
                  <Td>{formatDate(shift.startAt)}</Td>
                  <Td>
                    {formatTime(shift.startAt)} – {formatTime(shift.endAt)}
                  </Td>
                  <Td>{Math.round(shiftDurationMins(shift.startAt, shift.endAt) / 60)}h</Td>
                  <Td>
                    {shift.staff ? (
                      `${shift.staff.firstName} ${shift.staff.lastName}`
                    ) : (
                      <span className="text-amber-700">Unassigned</span>
                    )}
                  </Td>
                  <Td>{formatCurrency(Number(shift.chargeRate))}/h</Td>
                  <Td>
                    <StatusBadge status={shift.status} />
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
